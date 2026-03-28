'use client';

import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import MuiButton from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Stepper from '@mui/material/Stepper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import type { CreateItemRequest, Customer, DuplicateWarning, ItemWithLocation, LocationSuggestion, RackWithShelves, RackWithStats } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

type FlowState = 'lookup' | 'duplicate' | 'details' | 'location' | 'confirm' | 'success';

const blankNewItem: CreateItemRequest = { item_code: '', name: '', material: '', type: 'customer_order', quantity: 1 };
const stepLabels = ['Look up', 'Details', 'Location', 'Confirm'] as const;

function getActiveStep(flow: FlowState) {
  return { lookup: 0, duplicate: 0, details: 1, location: 2, confirm: 3, success: 4 }[flow];
}

export default function CheckInPage() {
  const { showToast } = useToast();
  const [flow, setFlow] = useState<FlowState>('lookup');
  const [lookupCode, setLookupCode] = useState('');
  const [existingItem, setExistingItem] = useState<ItemWithLocation | null>(null);
  const [newItem, setNewItem] = useState<CreateItemRequest>(blankNewItem);
  const [duplicate, setDuplicate] = useState<DuplicateWarning | null>(null);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [racks, setRacks] = useState<RackWithStats[]>([]);
  const [rackDetail, setRackDetail] = useState<RackWithShelves | null>(null);
  const [selectedRackId, setSelectedRackId] = useState('');
  const [selectedShelfSlotId, setSelectedShelfSlotId] = useState('');
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [checkInQuantity, setCheckInQuantity] = useState(1);
  const [resultLocation, setResultLocation] = useState('');
  const [resultUnitCode, setResultUnitCode] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);
  const [preselectedRackId, setPreselectedRackId] = useState('');
  const [preselectedCellId, setPreselectedCellId] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setPreselectedRackId(params.get('rack') || '');
    setPreselectedCellId(params.get('cell') || params.get('shelf') || '');
  }, []);

  useEffect(() => {
    void Promise.all([api.getCustomers(), api.getRacks()]).then(([c, r]) => { setCustomers(c.data); setRacks(r.data); });
  }, []);

  useEffect(() => {
    if (!selectedRackId) { setRackDetail(null); return; }
    void api.getRack(selectedRackId).then((r) => setRackDetail(r.data));
  }, [selectedRackId]);

  useEffect(() => {
    if (preselectedRackId) setSelectedRackId(preselectedRackId);
    if (preselectedCellId) setSelectedShelfSlotId(preselectedCellId);
  }, [preselectedCellId, preselectedRackId]);

  const manualShelfOptions = useMemo(
    () =>
      rackDetail?.shelves
        .filter((cell) => cell.current_count < cell.capacity)
        .map((cell) => ({ value: cell.id, label: `${rackDetail.code} / R${cell.row_number} / C${cell.column_number} (${cell.capacity - cell.current_count} free)` })) || [],
    [rackDetail],
  );

  const selectedLocationLabel = useMemo(() => {
    const s = suggestions.find((x) => x.shelf_slot_id === selectedShelfSlotId);
    if (s) return `${s.rack_code} / R${s.row_number} / C${s.column_number}`;
    return manualShelfOptions.find((o) => o.value === selectedShelfSlotId)?.label || 'Select a cell';
  }, [manualShelfOptions, selectedShelfSlotId, suggestions]);

  async function handleLookup() {
    if (!lookupCode.trim()) { showToast('Enter an item code', 'error'); return; }
    setLoading(true);
    setWarning('');
    try {
      const [itemsRes, dupRes] = await Promise.all([
        api.getItems({ search: lookupCode.trim(), per_page: 100, page: 1 }),
        api.getDuplicateWarningByItemCode(lookupCode.trim()),
      ]);
      const exact = itemsRes.data.find((i) => i.item_code.toLowerCase() === lookupCode.trim().toLowerCase()) || null;
      const dup = dupRes.data;
      setExistingItem(exact);
      setCheckInQuantity(exact?.quantity || 1);
      setNewItem((c) => ({ ...c, item_code: lookupCode.trim() }));
      setDuplicate(dup);
      if (dup) { setFlow('duplicate'); return; }
      if (exact) { const sr = await api.getSuggestedLocations(exact.id); setSuggestions(sr.data); }
      setFlow('details');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Lookup failed', 'error');
    } finally { setLoading(false); }
  }

  async function continueFromDetails() {
    if (existingItem) {
      if (suggestions.length === 0) { const sr = await api.getSuggestedLocations(existingItem.id); setSuggestions(sr.data); }
      setFlow('location');
      return;
    }
    if (!newItem.name || !newItem.type) { showToast('Complete the new item form first', 'error'); return; }
    try {
      const created = await api.createItem(newItem);
      const full = await api.getItem(created.data.id);
      setExistingItem(full.data);
      setCheckInQuantity(full.data.quantity || newItem.quantity || 1);
      const sr = await api.getSuggestedLocations(created.data.id);
      setSuggestions(sr.data);
      setFlow('location');
    } catch (err) { showToast(err instanceof Error ? err.message : 'Unable to create item', 'error'); }
  }

  async function confirmCheckIn() {
    if (!existingItem?.id || !selectedShelfSlotId || !workerName) { showToast('Worker name and storage location are required', 'error'); return; }
    setLoading(true);
    try {
      const r = await api.checkInItem({ item_id: existingItem.id, shelf_slot_id: selectedShelfSlotId, quantity: checkInQuantity, checked_in_by: workerName, notes: notes || undefined });
      setResultLocation(r.data.location);
      setResultUnitCode(r.data.unit_code);
      setWarning(r.warning || '');
      setFlow('success');
      showToast('Item checked in successfully');
    } catch (err) { showToast(err instanceof Error ? err.message : 'Check-in failed', 'error'); }
    finally { setLoading(false); }
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h3">Check in item</Typography>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stepper activeStep={getActiveStep(flow)} alternativeLabel>
          {stepLabels.map((label) => (
            <Step key={label}><StepLabel>{label}</StepLabel></Step>
          ))}
        </Stepper>
      </Paper>

      {/* Lookup */}
      <Card>
        <CardContent>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'flex-end' }}>
            <Box flex={1}><Input label="Item code" value={lookupCode} onChange={(e: any) => setLookupCode(e.target.value)} placeholder="KONE-001-PANEL-A" /></Box>
            <Button onClick={handleLookup} disabled={loading}>{loading ? 'Looking up...' : 'Look up'}</Button>
          </Stack>
          {(preselectedRackId || preselectedCellId) ? (
            <Typography variant="caption" color="text.secondary" mt={1} display="block">Grid context is active. Rack or cell was prefilled from the storage grid.</Typography>
          ) : null}
        </CardContent>
      </Card>

      {/* Duplicate warning */}
      {flow === 'duplicate' && duplicate ? (
        <Paper variant="outlined" sx={{ p: 2.5, borderColor: 'warning.main', bgcolor: '#fff8e1' }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
            <WarningIcon color="warning" />
            <Typography variant="subtitle1">This item code already exists in storage</Typography>
          </Stack>
          <Grid container spacing={2}>
            {duplicate.existing_locations.map((loc, i) => (
              <Grid size={{ xs: 12, md: 6 }} key={i}>
                <Paper variant="outlined" sx={{ p: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">Copy {i + 1}</Typography>
                  <Typography variant="body2">{`${loc.rack_code} / R${loc.row_number} / C${loc.column_number}`}</Typography>
                  <Typography variant="caption" color="text.secondary">{loc.quantity} units</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
          <Stack direction="row" spacing={1} mt={2}>
            <Button onClick={() => setFlow('details')}>Continue anyway</Button>
            <Button variant="secondary" onClick={() => setFlow('lookup')}>Cancel</Button>
          </Stack>
        </Paper>
      ) : null}

      {/* Details */}
      {(flow === 'details' || flow === 'location' || flow === 'confirm' || flow === 'success') && (
        <Card>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Item details</Typography>
              {existingItem ? <Typography variant="body2" fontFamily="monospace">{existingItem.item_code}</Typography> : null}
            </Stack>
            {existingItem ? (
              <Grid container spacing={2}>
                {[['Name', existingItem.name], ['Customer', existingItem.customer_name || '-'], ['Material', existingItem.material || '-']].map(([label, value]) => (
                  <Grid size={{ xs: 12, md: 4 }} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2">{value}</Typography>
                  </Grid>
                ))}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="caption" color="text.secondary">Current location</Typography>
                  <Box mt={0.5}><LocationBadge location={existingItem.current_location} /></Box>
                </Grid>
              </Grid>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}><Input label="Name" value={newItem.name} onChange={(e: any) => setNewItem((c) => ({ ...c, name: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><Select label="Customer" value={newItem.customer_id || ''} onChange={(e: any) => setNewItem((c) => ({ ...c, customer_id: e.target.value || undefined }))} options={[{ label: 'No customer', value: '' }, ...customers.map((c) => ({ label: c.name, value: c.id }))]} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><Input label="Material" value={newItem.material} onChange={(e: any) => setNewItem((c) => ({ ...c, material: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 6 }}><Select label="Type" value={newItem.type} onChange={(e: any) => setNewItem((c) => ({ ...c, type: e.target.value as CreateItemRequest['type'] }))} options={[{ label: 'Customer order', value: 'customer_order' }, { label: 'General stock', value: 'general_stock' }]} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Input label="Dimensions" value={newItem.dimensions || ''} onChange={(e: any) => setNewItem((c) => ({ ...c, dimensions: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Input label="Weight (kg)" type="number" value={newItem.weight_kg || ''} onChange={(e: any) => setNewItem((c) => ({ ...c, weight_kg: Number(e.target.value) || 0 }))} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Input label="Order number" value={newItem.order_number || ''} onChange={(e: any) => setNewItem((c) => ({ ...c, order_number: e.target.value }))} /></Grid>
                <Grid size={{ xs: 12, md: 3 }}><Input label="Quantity" type="number" min="1" value={String(newItem.quantity)} onChange={(e: any) => setNewItem((c) => ({ ...c, quantity: Number(e.target.value) || 1 }))} /></Grid>
              </Grid>
            )}
            {flow === 'details' ? (
              <Stack direction="row" justifyContent="flex-end" mt={2}>
                <Button onClick={() => void continueFromDetails()}>Continue to location</Button>
              </Stack>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Location */}
      {(flow === 'location' || flow === 'confirm' || flow === 'success') && existingItem ? (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" mb={2}>Choose location</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 8 }}>
                {suggestions.length > 0 ? (
                  <Stack spacing={1}>
                    {suggestions.map((s) => (
                      <Paper
                        key={s.shelf_slot_id}
                        variant="outlined"
                        onClick={() => { setSelectedShelfSlotId(s.shelf_slot_id); setFlow('confirm'); }}
                        sx={{ p: 2, cursor: 'pointer', borderColor: selectedShelfSlotId === s.shelf_slot_id ? 'primary.main' : 'divider', bgcolor: selectedShelfSlotId === s.shelf_slot_id ? 'primary.50' : 'background.paper', '&:hover': { borderColor: 'primary.light' } }}
                      >
                        <Typography variant="body2" fontFamily="monospace">{`${s.rack_code} / R${s.row_number} / C${s.column_number}`}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.reason}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <EmptyState title="No smart suggestions" description="Pick a cell manually." />
                )}
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
                  <Stack spacing={2}>
                    <Select label="Rack" value={selectedRackId} onChange={(e: any) => setSelectedRackId(e.target.value)} options={[{ label: 'Select rack', value: '' }, ...racks.map((rack) => ({ label: `${rack.code} - ${rack.label}`, value: rack.id }))]} />
                    <Select label="Cell" value={selectedShelfSlotId} onChange={(e: any) => { setSelectedShelfSlotId(e.target.value); if (e.target.value) setFlow('confirm'); }} options={[{ label: 'Select cell', value: '' }, ...manualShelfOptions]} />
                  </Stack>
                </Paper>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : null}

      {/* Confirm */}
      {(flow === 'confirm' || flow === 'success') && existingItem ? (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" mb={2}>Confirm check-in</Typography>
            <Grid container spacing={2} mb={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" color="text.secondary">Item</Typography>
                <Typography variant="body2">{existingItem.name}</Typography>
                <Typography variant="caption" fontFamily="monospace">{existingItem.item_code}</Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="caption" color="text.secondary">Selected location</Typography>
                <Typography variant="body2">{selectedLocationLabel}</Typography>
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}><Input label="Worker name" value={workerName} onChange={(e: any) => setWorkerName(e.target.value)} /></Grid>
              <Grid size={{ xs: 12, md: 2 }}><Input label="Unit quantity" type="number" min="1" value={String(checkInQuantity)} onChange={(e: any) => setCheckInQuantity(Math.max(1, Number(e.target.value) || 1))} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
              </Grid>
            </Grid>
            {flow !== 'success' ? (
              <Stack direction="row" justifyContent="flex-end" mt={2}>
                <Button onClick={() => void confirmCheckIn()} disabled={loading}>{loading ? 'Confirming...' : 'Confirm check-in'}</Button>
              </Stack>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Success */}
      {flow === 'success' ? (
        <Paper variant="outlined" sx={{ p: 3, borderColor: 'success.main', bgcolor: '#e8f5e9' }}>
          <Stack direction="row" spacing={1} alignItems="center" mb={1}>
            <CheckCircleIcon color="success" />
            <Typography variant="subtitle1">Check-in complete</Typography>
          </Stack>
          <Typography variant="body2">Stored at {resultLocation}</Typography>
          {resultUnitCode ? <Typography variant="body2" fontFamily="monospace">Tracking unit {resultUnitCode}</Typography> : null}
          {warning ? <Typography variant="caption" color="warning.main">{warning}</Typography> : null}
          <Stack direction="row" justifyContent="flex-end" mt={2}>
            <Button onClick={() => window.location.reload()}>Check in another item</Button>
          </Stack>
        </Paper>
      ) : null}
    </Stack>
  );
}
