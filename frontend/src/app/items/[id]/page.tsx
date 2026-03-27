'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { ItemDetail, ZoneWithStats } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { api, type ZoneDetail } from '@/lib/api';
import { formatDateTime, formatNumber, locationLabel, toTitleCase } from '@/lib/utils';
import { useToast } from '@/components/ui/Toast';

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [zoneDetail, setZoneDetail] = useState<ZoneDetail | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [moveOpen, setMoveOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentZoneId = useMemo(() => {
    if (!item?.current_location?.zone_code) {
      return '';
    }

    return zones.find((zone) => zone.code === item.current_location?.zone_code)?.id || '';
  }, [item?.current_location?.zone_code, zones]);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    setLoading(true);
    void Promise.all([api.getItem(params.id), api.getZones()])
      .then(([itemResponse, zoneResponse]) => {
        setItem(itemResponse.data);
        setZones(zoneResponse.data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!selectedZoneId) {
      setZoneDetail(null);
      return;
    }

    void api.getZone(selectedZoneId).then((response) => setZoneDetail(response.data));
  }, [selectedZoneId]);

  const availableSlots = useMemo(
    () =>
      zoneDetail?.racks.flatMap((rack) =>
        rack.shelves
          .filter((shelf) => shelf.current_count < shelf.capacity)
          .map((shelf) => ({ id: shelf.id, label: `${rack.code} > Shelf ${shelf.shelf_number} (${shelf.capacity - shelf.current_count} free)` })),
      ) || [],
    [zoneDetail],
  );

  async function handleMove() {
    if (!item?.current_location?.assignment_id || !selectedSlotId || !workerName) {
      showToast('Worker name and destination are required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.moveItem({
        assignment_id: item.current_location.assignment_id,
        to_shelf_slot_id: selectedSlotId,
        performed_by: workerName,
        notes: moveNotes || undefined,
      });
      const refreshed = await api.getItem(params.id);
      setItem(refreshed.data);
      setMoveOpen(false);
      setSelectedSlotId('');
      setMoveNotes('');
      showToast(`Item moved to ${response.data.to}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Move failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 border border-app-border bg-white p-4">
        <LoadingSpinner />
        <span className="text-xs text-app-textMuted">Loading item...</span>
      </div>
    );
  }

  if (error || !item) {
    return <EmptyState title="Unable to load item" description={error || 'Item not found'} />;
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex flex-col gap-3 border border-app-border bg-white p-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-lg font-bold text-app-text">{item.item_code}</h1>
            <Badge variant="primary">{item.type}</Badge>
          </div>
          <p className="text-sm text-app-text">{item.name}</p>
          <p className="text-xs text-app-textMuted">{item.customer_name || 'No customer assigned'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {item.current_location?.assignment_id ? (
            <Link href={`/check-out/${item.id}`}>
              <Button variant="danger">Check out</Button>
            </Link>
          ) : null}
          {item.current_location?.assignment_id ? (
            <Button variant="secondary" onClick={() => setMoveOpen(true)}>
              Move
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="border border-app-border bg-white">
          <div className="border-b border-app-border bg-app-toolbar px-4 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-text">Item information</h2>
          </div>
          <dl className="grid gap-px bg-app-borderLight md:grid-cols-2">
            {[
              ['Material', item.material || '-'],
              ['Dimensions', item.dimensions || '-'],
              ['Weight', formatNumber(item.weight_kg, ' kg')],
              ['Quantity', String(item.quantity)],
              ['Order number', item.order_number || '-'],
            ].map(([label, value]) => (
              <div key={label} className="bg-white px-4 py-2.5">
                <dt className="text-xs text-app-textMuted">{label}</dt>
                <dd className="mt-0.5 font-mono text-sm text-app-text">{value}</dd>
              </div>
            ))}
            <div className="bg-white px-4 py-2.5">
              <dt className="text-xs text-app-textMuted">Current location</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-sm text-app-text">
                <LocationBadge location={item.current_location} />
                {currentZoneId ? <Link className="text-xs text-app-primary hover:underline" href={`/zones/${currentZoneId}`}>View zone</Link> : null}
              </dd>
            </div>
          </dl>
        </section>

        <section className="border border-app-border bg-white">
          <div className="border-b border-app-border bg-app-toolbar px-4 py-2">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-app-text">Activity timeline</h2>
          </div>
          <div className="max-h-[480px] overflow-y-auto">
            {item.activity_history.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No activity yet" />
              </div>
            ) : (
              item.activity_history.map((entry) => (
                <div key={entry.id} className="border-b border-app-borderLight px-4 py-2.5 last:border-b-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">{entry.action}</Badge>
                    <span className="font-mono text-[11px] text-app-textMuted">{formatDateTime(entry.created_at)}</span>
                  </div>
                  <p className="mt-1 text-xs text-app-text">by {entry.performed_by}</p>
                  <p className="text-xs text-app-textMuted">
                    {entry.action === 'move'
                      ? `${entry.from_location || '-'} \u2192 ${entry.to_location || '-'}`
                      : entry.to_location || entry.from_location || '-'}
                  </p>
                  {entry.notes ? <p className="mt-0.5 text-xs text-app-text">{entry.notes}</p> : null}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <Modal open={moveOpen} title="Move item" confirmLabel={submitting ? 'Moving...' : 'Confirm move'} onConfirm={handleMove} onClose={() => setMoveOpen(false)}>
        <div className="space-y-3">
          <p className="font-mono text-xs text-app-textMuted">Current: {locationLabel(item.current_location)}</p>
          <Select
            label="Zone"
            value={selectedZoneId}
            onChange={(event) => {
              setSelectedZoneId(event.target.value);
              setSelectedSlotId('');
            }}
            options={[{ label: 'Select zone', value: '' }, ...zones.map((zone) => ({ label: `${zone.code} - ${zone.name}`, value: zone.id }))]}
          />
          <Select
            label="Shelf"
            value={selectedSlotId}
            onChange={(event) => setSelectedSlotId(event.target.value)}
            options={[{ label: 'Select shelf', value: '' }, ...availableSlots.map((slot) => ({ label: slot.label, value: slot.id }))]}
          />
          <Input label="Worker name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} />
          <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-app-text">
            <span>Notes</span>
            <textarea className="border border-app-border px-3 py-2 text-sm text-app-text shadow-inset outline-none focus:border-app-primary" value={moveNotes} onChange={(event) => setMoveNotes(event.target.value)} />
          </label>
        </div>
      </Modal>
    </div>
  );
}
