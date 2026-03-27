'use client';

import { useEffect, useMemo, useState } from 'react';
import type { CreateItemRequest, Customer, DuplicateWarning, ItemWithLocation, LocationSuggestion, ZoneWithStats } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { Select } from '@/components/ui/Select';
import { api, type ZoneDetail } from '@/lib/api';
import { locationLabel } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

type FlowState = 'lookup' | 'duplicate' | 'details' | 'location' | 'confirm' | 'success';

const blankNewItem: CreateItemRequest = {
  item_code: '',
  name: '',
  material: '',
  type: 'customer_order',
  quantity: 1,
};

export default function CheckInPage() {
  const { showToast } = useToast();
  const [flow, setFlow] = useState<FlowState>('lookup');
  const [lookupCode, setLookupCode] = useState('');
  const [existingItem, setExistingItem] = useState<ItemWithLocation | null>(null);
  const [newItem, setNewItem] = useState<CreateItemRequest>(blankNewItem);
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [zoneDetail, setZoneDetail] = useState<ZoneDetail | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedShelfSlotId, setSelectedShelfSlotId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [resultLocation, setResultLocation] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [preselectedZoneId, setPreselectedZoneId] = useState('');
  const [preselectedRackId, setPreselectedRackId] = useState('');
  const [preselectedShelfSlotId, setPreselectedShelfSlotId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreselectedZoneId(params.get('zone') || '');
    setPreselectedRackId(params.get('rack') || '');
    setPreselectedShelfSlotId(params.get('shelf') || '');
  }, []);

  useEffect(() => {
    void Promise.all([api.getCustomers(), api.getZones()]).then(([customerResponse, zoneResponse]) => {
      setCustomers(customerResponse.data);
      setZones(zoneResponse.data);
    });
  }, []);

  useEffect(() => {
    if (!selectedZoneId) {
      setZoneDetail(null);
      return;
    }
    void api.getZone(selectedZoneId).then((response) => setZoneDetail(response.data));
  }, [selectedZoneId]);

  useEffect(() => {
    if (preselectedZoneId) {
      setSelectedZoneId(preselectedZoneId);
    }
    if (preselectedShelfSlotId) {
      setSelectedShelfSlotId(preselectedShelfSlotId);
    }
  }, [preselectedShelfSlotId, preselectedZoneId]);

  useEffect(() => {
    if (preselectedZoneId || !preselectedRackId) {
      return;
    }

    void api.getRack(preselectedRackId).then((response) => {
      setSelectedZoneId(response.data.zone_id);
    });
  }, [preselectedRackId, preselectedZoneId]);

  const manualShelfOptions = useMemo(
    () =>
      zoneDetail?.racks.flatMap((rack) =>
        rack.shelves
          .filter((shelf) => (preselectedRackId ? rack.id === preselectedRackId : true))
          .filter((shelf) => shelf.current_count < shelf.capacity)
          .map((shelf) => ({ value: shelf.id, label: `${rack.code} > Shelf ${shelf.shelf_number} (${shelf.capacity - shelf.current_count} free)` })),
      ) || [],
    [preselectedRackId, zoneDetail],
  );

  async function handleLookup() {
    if (!lookupCode.trim()) {
      showToast('Enter an item code', 'error');
      return;
    }

    setLoading(true);
    setWarning('');
    try {
      const [itemsResponse, duplicatesResponse] = await Promise.all([
        api.getItems({ search: lookupCode.trim(), per_page: 100, page: 1 }),
        api.getDuplicateWarnings(),
      ]);

      const exactMatch = itemsResponse.data.find((item) => item.item_code.toLowerCase() === lookupCode.trim().toLowerCase()) || null;
      const duplicateMatch = duplicatesResponse.data.find((entry) => entry.item_code.toLowerCase() === lookupCode.trim().toLowerCase()) || null;

      setExistingItem(exactMatch);
      setNewItem((current) => ({ ...current, item_code: lookupCode.trim() }));
      setDuplicate(duplicateMatch);

      if (duplicateMatch) {
        setFlow('duplicate');
        return;
      }

      if (exactMatch) {
        const suggestionResponse = await api.getSuggestedLocations(exactMatch.id);
        setSuggestions(suggestionResponse.data);
        setFlow('details');
      } else {
        setFlow('details');
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lookup failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function continueFromDetails() {
    if (existingItem) {
      const suggestionResponse = await api.getSuggestedLocations(existingItem.id);
      setSuggestions(suggestionResponse.data);
      setFlow('location');
      return;
    }

    if (!newItem.name || !newItem.type) {
      showToast('Complete the new item form first', 'error');
      return;
    }

    try {
      const created = await api.createItem(newItem);
      const fullItem = await api.getItem(created.data.id);
      setExistingItem(fullItem.data);
      const suggestionResponse = await api.getSuggestedLocations(created.data.id);
      setSuggestions(suggestionResponse.data);
      setFlow('location');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to create item', 'error');
    }
  }

  async function confirmCheckIn() {
    if (!existingItem?.id || !selectedShelfSlotId || !workerName) {
      showToast('Worker name and storage location are required', 'error');
      return;
    }

    setLoading(true);
    try {
      const response = await api.checkInItem({
        item_id: existingItem.id,
        shelf_slot_id: selectedShelfSlotId,
        quantity: existingItem.quantity,
        checked_in_by: workerName,
        notes: notes || undefined,
      });
      setResultLocation(response.data.location);
      setWarning(response.warning || '');
      setFlow('success');
      showToast('Item checked in successfully');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-in failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3 py-3">
      <div className="border-b border-app-border bg-app-toolbar px-3 py-2">
        <h1 className="text-sm font-semibold text-app-text">Check in</h1>
      </div>

      <section className="border border-app-border bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Input label="Item code" value={lookupCode} onChange={(event) => setLookupCode(event.target.value)} placeholder="e.g. KONE-001-PANEL-A" />
          <Button onClick={handleLookup} disabled={loading}>
            {loading ? 'Looking up...' : 'Look up'}
          </Button>
        </div>
      </section>

      {flow === 'duplicate' && duplicate ? (
        <section className="border-2 border-app-warning bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <Badge variant="warning">DUPLICATE</Badge>
            <span className="text-sm font-semibold text-app-text">This item already exists in storage</span>
          </div>
          <div className="mt-3 space-y-1 font-mono text-xs text-app-text">
            {duplicate.existing_locations.map((location, index) => (
              <p key={`${location.rack_code}-${index}`}>
                {location.zone_name} &gt; {location.rack_code} &gt; Shelf {location.shelf_number} ({location.quantity})
              </p>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={() => setFlow('details')}>Continue anyway</Button>
            <Button variant="secondary" onClick={() => setFlow('lookup')}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {(flow === 'details' || flow === 'location' || flow === 'confirm' || flow === 'success') && (
        <section className="border border-app-border bg-white">
          <div className="border-b border-app-border bg-app-toolbar px-4 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-text">Item details</h2>
          </div>
          <div className="p-4">
            {existingItem ? (
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs text-app-textMuted">Name</p>
                  <p className="text-sm text-app-text">{existingItem.name}</p>
                </div>
                <div>
                  <p className="text-xs text-app-textMuted">Customer</p>
                  <p className="text-sm text-app-text">{existingItem.customer_name || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-app-textMuted">Material</p>
                  <p className="text-sm text-app-text">{existingItem.material || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-app-textMuted">Existing location</p>
                  <div className="mt-0.5"><LocationBadge location={existingItem.current_location} /></div>
                </div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                <Input label="Name" value={newItem.name} onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} />
                <Select
                  label="Customer"
                  value={newItem.customer_id || ''}
                  onChange={(event) => setNewItem((current) => ({ ...current, customer_id: event.target.value || undefined }))}
                  options={[{ label: 'No customer', value: '' }, ...customers.map((customer) => ({ label: customer.name, value: customer.id }))]}
                />
                <Input label="Material" value={newItem.material} onChange={(event) => setNewItem((current) => ({ ...current, material: event.target.value }))} />
                <Select
                  label="Type"
                  value={newItem.type}
                  onChange={(event) => setNewItem((current) => ({ ...current, type: event.target.value as CreateItemRequest['type'] }))}
                  options={[
                    { label: 'Customer order', value: 'customer_order' },
                    { label: 'General stock', value: 'general_stock' },
                  ]}
                />
                <Input label="Dimensions" value={newItem.dimensions || ''} onChange={(event) => setNewItem((current) => ({ ...current, dimensions: event.target.value }))} />
                <Input label="Weight (kg)" type="number" value={newItem.weight_kg || ''} onChange={(event) => setNewItem((current) => ({ ...current, weight_kg: Number(event.target.value) || 0 }))} />
                <Input label="Order number" value={newItem.order_number || ''} onChange={(event) => setNewItem((current) => ({ ...current, order_number: event.target.value }))} />
                <Input label="Quantity" type="number" min="1" value={String(newItem.quantity)} onChange={(event) => setNewItem((current) => ({ ...current, quantity: Number(event.target.value) || 1 }))} />
              </div>
            )}
            {flow === 'details' ? (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void continueFromDetails()}>Continue to location</Button>
              </div>
            ) : null}
          </div>
        </section>
      )}

      {(flow === 'location' || flow === 'confirm' || flow === 'success') && existingItem ? (
        <section className="border border-app-border bg-white">
          <div className="border-b border-app-border bg-app-toolbar px-4 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-text">Location selection</h2>
          </div>
          <div className="p-4 space-y-3">
            {preselectedZoneId || preselectedRackId || preselectedShelfSlotId ? (
              <div className="border border-blue-300 bg-blue-50 px-3 py-2 text-xs text-app-text">
                Using location context from the map view.
              </div>
            ) : null}
            {suggestions.length > 0 ? (
              <>
                <p className="text-xs font-medium uppercase tracking-wider text-app-textMuted">Smart suggestions</p>
                <div className="grid gap-2 lg:grid-cols-3">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion.shelf_slot_id}
                      type="button"
                      className={`min-h-11 border p-3 text-left ${selectedShelfSlotId === suggestion.shelf_slot_id ? 'border-2 border-app-primary bg-blue-50' : 'border-app-border bg-app-panelMuted hover:bg-gray-100'}`}
                      onClick={() => {
                        setSelectedShelfSlotId(suggestion.shelf_slot_id);
                        setFlow('confirm');
                      }}
                    >
                      <p className="font-mono text-sm font-medium text-app-text">
                        {suggestion.zone_code} &gt; {suggestion.rack_code} &gt; S{suggestion.shelf_number}
                      </p>
                      <p className="mt-1 text-xs text-app-textMuted">{suggestion.reason}</p>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState title="No smart suggestions available" description="Choose a shelf manually." />
            )}

            <p className="text-xs font-medium uppercase tracking-wider text-app-textMuted">Manual selection</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Zone"
                value={selectedZoneId}
                onChange={(event) => setSelectedZoneId(event.target.value)}
                options={[{ label: 'Select zone', value: '' }, ...zones.map((zone) => ({ label: `${zone.code} - ${zone.name}`, value: zone.id }))]}
              />
              <Select
                label="Shelf"
                value={selectedShelfSlotId}
                onChange={(event) => {
                  setSelectedShelfSlotId(event.target.value);
                  if (event.target.value) {
                    setFlow('confirm');
                  }
                }}
                options={[{ label: 'Select shelf', value: '' }, ...manualShelfOptions]}
              />
            </div>
          </div>
        </section>
      ) : null}

      {(flow === 'confirm' || flow === 'success') && existingItem ? (
        <section className="border border-app-border bg-white">
          <div className="border-b border-app-border bg-app-toolbar px-4 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-text">Confirm check-in</h2>
          </div>
          <div className="p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs text-app-textMuted">Item</p>
                <p className="font-mono text-sm text-app-text">{existingItem.item_code} - {existingItem.name}</p>
              </div>
              <div>
                <p className="text-xs text-app-textMuted">Selected location</p>
                <p className="text-sm text-app-text">{selectedShelfSlotId ? 'Shelf selected' : 'Select a shelf above'}</p>
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <Input label="Worker name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} />
              <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-app-text">
                <span>Notes</span>
                <textarea className="border border-app-border px-3 py-2 text-sm text-app-text shadow-inset outline-none focus:border-app-primary" value={notes} onChange={(event) => setNotes(event.target.value)} />
              </label>
            </div>
            {flow !== 'success' ? (
              <div className="mt-4 flex justify-end">
                <Button onClick={() => void confirmCheckIn()} disabled={loading}>
                  {loading ? 'Confirming...' : 'Confirm check-in'}
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {flow === 'success' ? (
        <section className="border-2 border-app-success bg-green-50 p-4">
          <h2 className="text-sm font-bold text-app-success">Check-in complete</h2>
          <p className="mt-1 font-mono text-xs text-app-text">Stored at {resultLocation}</p>
          {warning ? <p className="mt-1 text-xs text-app-warning">{warning}</p> : null}
          <div className="mt-3">
            <Button onClick={() => window.location.reload()}>Check in another item</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
