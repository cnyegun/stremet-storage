'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { ItemDetail, MachineWithItemCount, RackWithShelves, RackWithStats, TrackingUnit } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge, MachineLocationBadge } from '@/components/ui/LocationBadge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { actionLabel, formatDateTime, formatNumber, locationLabel, machineCategoryLabel, rackDisplayLabel } from '@/lib/utils';

type MoveSource = {
  type: 'shelf' | 'machine';
  assignment_id: string;
  unit_code: string;
  quantity: number;
  label: string;
};

function trackingUnitLocationLabel(unit: TrackingUnit) {
  if (unit.source_type === 'machine') {
    return unit.machine_code ? `M/${unit.machine_code}` : 'Machine';
  }

  return locationLabel(unit);
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [racks, setRacks] = useState<RackWithStats[]>([]);
  const [machines, setMachines] = useState<MachineWithItemCount[]>([]);
  const [rackDetail, setRackDetail] = useState<RackWithShelves | null>(null);
  const [selectedRackId, setSelectedRackId] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [selectedMachineId, setSelectedMachineId] = useState('');
  const [destType, setDestType] = useState<'storage' | 'machine'>('storage');
  const [workerName, setWorkerName] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [moveQuantity, setMoveQuantity] = useState(1);
  const [moveSource, setMoveSource] = useState<MoveSource | null>(null);
  const [moveOpen, setMoveOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRackId = item?.current_location?.rack_id || '';

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    void Promise.all([api.getItem(params.id), api.getRacks(), api.getMachines()])
      .then(([itemRes, racksRes, machineRes]) => {
        setItem(itemRes.data);
        setRacks(racksRes.data);
        setMachines(machineRes.data);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!selectedRackId) {
      setRackDetail(null);
      return;
    }
    void api.getRack(selectedRackId).then((r) => setRackDetail(r.data));
  }, [selectedRackId]);

  const availableSlots = useMemo(
    () =>
      rackDetail?.shelves
        .filter((cell) => cell.current_count < cell.capacity)
        .map((cell) => ({ id: cell.id, label: `${rackDetail.code} / R${cell.row_number} / C${cell.column_number} (${cell.capacity - cell.current_count} free)` })) || [],
    [rackDetail],
  );

  function openMoveDialog(source: MoveSource) {
    setMoveSource(source);
    setMoveQuantity(source.quantity);
    setDestType('storage');
    setSelectedRackId('');
    setSelectedSlotId('');
    setSelectedMachineId('');
    setMoveNotes('');
    setMoveOpen(true);
  }

  async function handleMove() {
    if (!moveSource || !workerName) {
      showToast('Worker name is required', 'error');
      return;
    }
    if (destType === 'storage' && !selectedSlotId) {
      showToast('Select a destination cell', 'error');
      return;
    }
    if (destType === 'machine' && !selectedMachineId) {
      showToast('Select a destination machine', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.moveItem({
        assignment_id: moveSource.assignment_id,
        source_type: moveSource.type,
        to_shelf_slot_id: destType === 'storage' ? selectedSlotId : undefined,
        to_machine_id: destType === 'machine' ? selectedMachineId : undefined,
        performed_by: workerName,
        notes: moveNotes || undefined,
        quantity: moveQuantity,
      });
      const refreshed = await api.getItem(params.id);
      setItem(refreshed.data);
      setMoveOpen(false);
      const totalQty = moveSource.quantity;
      const label = moveQuantity < totalQty
        ? `Created unit ${response.data.unit_code} with ${moveQuantity} of ${totalQty} at ${response.data.to}`
        : `Moved unit ${response.data.unit_code} to ${response.data.to}`;
      showToast(label);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Move failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <LoadingSpinner />
        <Typography variant="body2" color="text.secondary">Loading item...</Typography>
      </Paper>
    );
  }

  if (error || !item) {
    return <EmptyState title="Unable to load item" description={error || 'Item not found'} />;
  }

  const trackingUnits: TrackingUnit[] = item.tracking_units || [];
  const hasAnyLocation = trackingUnits.length > 0;

  const infoRows: [string, string][] = [
    const summaryItems = [
      ['Tracked units', `${trackingUnits.length}`],
      ['In storage volume', `${trackingUnits.filter((unit) => unit.source_type === 'shelf').reduce((sum, unit) => sum + (unit.quantity * (item.volume_m3 || 0.1)), 0).toFixed(2)} m³`],
      ['At machines volume', `${trackingUnits.filter((unit) => unit.source_type === 'machine').reduce((sum, unit) => sum + (unit.quantity * (item.volume_m3 || 0.1)), 0).toFixed(2)} m³`],
      ['Total Item Volume', `${(item.quantity * (item.volume_m3 || 0.1)).toFixed(2)} m³`],
    ];
  return (
    <Stack spacing={2.5}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2}>
          <Box>
            <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
              <Typography variant="h3">{item.name}</Typography>
              <Badge variant="primary">{item.type === 'customer_order' ? 'Customer order' : 'General stock'}</Badge>
            </Stack>
            <Typography variant="body2" fontFamily="monospace" fontWeight={500} mt={0.5}>{item.item_code}</Typography>
            <Stack direction="row" spacing={3} mt={1} flexWrap="wrap">
              <Box>
                <Typography variant="caption" color="text.secondary">Customer</Typography>
                <Typography variant="body2" fontWeight={500}>{item.customer_name || 'None (general stock)'}</Typography>
              </Box>
              {item.order_number ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">Order number</Typography>
                  <Typography variant="body2" fontWeight={500}>{item.order_number}</Typography>
                </Box>
              ) : null}
              <Box>
                <Typography variant="caption" color="text.secondary">Material</Typography>
                <Typography variant="body2" fontWeight={500}>{item.material || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Dimensions</Typography>
                <Typography variant="body2" fontWeight={500}>{item.dimensions || '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">Weight</Typography>
                <Typography variant="body2" fontWeight={500}>{formatNumber(item.weight_kg, ' kg')}</Typography>
              </Box>
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} flexShrink={0}>
            <Typography variant="caption" color="text.secondary">{trackingUnits.length} active unit{trackingUnits.length === 1 ? '' : 's'}</Typography>
          </Stack>
        </Stack>
      </Paper>

      {/* Content grid */}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">Current record</Typography>
                {currentRackId ? <Link href={`/racks/${currentRackId}`} style={{ fontSize: 13, color: '#1565C0' }}>Open rack</Link> : null}
              </Stack>

              <Paper variant="outlined" sx={{ mb: 2 }}>
                <Stack direction="row" alignItems="center" px={2} py={1.5} borderBottom={1} borderColor="divider">
                  <Typography variant="subtitle2">Tracked units</Typography>
                </Stack>
                {trackingUnits.length === 0 ? (
                  <Box p={2}>
                    <EmptyState title="No active units" description="This item is not currently stored or assigned to a machine." />
                  </Box>
                ) : (
                  <Stack divider={<Divider />}>
                    {trackingUnits.map((unit) => (
                      <Stack key={unit.assignment_id} direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }} px={2} py={1.5}>
                        <Stack spacing={0.5} minWidth={0} flex={1}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="body2" fontFamily="monospace" fontWeight={700}>{unit.unit_code}</Typography>
                            <Badge variant={unit.source_type === 'machine' ? 'warning' : 'default'}>{unit.source_type === 'machine' ? 'Machine' : 'Storage'}</Badge>
                            <Typography variant="caption" color="text.secondary">{unit.quantity} pcs</Typography>
                            {unit.parent_unit_code ? <Typography variant="caption" color="text.secondary">Split from {unit.parent_unit_code}</Typography> : null}
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            {unit.source_type === 'machine' ? (
                              <>
                                <MachineLocationBadge code={unit.machine_code || '-'} name={unit.machine_name || undefined} />
                                {unit.machine_category ? <Typography variant="caption" color="text.secondary">({machineCategoryLabel(unit.machine_category)})</Typography> : null}
                              </>
                            ) : (
                              <LocationBadge location={unit} />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">Assigned by {unit.assigned_by} on {formatDateTime(unit.assigned_at)}</Typography>
                        </Stack>

                        <Stack direction="row" spacing={1} flexShrink={0}>
                          {unit.source_type === 'shelf' ? (
                            <Link href={`/check-out/${item.id}?assignmentId=${unit.assignment_id}&unitCode=${encodeURIComponent(unit.unit_code)}`}>
                              <Button variant="danger">Check out</Button>
                            </Link>
                          ) : null}
                          <Button
                            variant="secondary"
                            onClick={() => openMoveDialog({
                              type: unit.source_type,
                              assignment_id: unit.assignment_id,
                              unit_code: unit.unit_code,
                              quantity: unit.quantity,
                              label: trackingUnitLocationLabel(unit),
                            })}
                          >
                            Move
                          </Button>
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </Paper>

              <Grid container spacing={2}>
                {infoRows.map(([label, value]) => (
                  <Grid size={{ xs: 4 }} key={label}>
                    <Typography variant="caption" color="text.secondary">{label}</Typography>
                    <Typography variant="body2" fontWeight={600} mt={0.25}>{value}</Typography>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">Activity</Typography>
                <Typography variant="caption" color="text.secondary">{item.activity_history.length} entries</Typography>
              </Stack>

              <Box sx={{ maxHeight: 520, overflow: 'auto' }}>
                {item.activity_history.length === 0 ? (
                  <EmptyState title="No activity yet" description="No recorded moves, check-ins, or check-outs." />
                ) : (
                  <Stack divider={<Divider />}>
                    {item.activity_history.map((entry) => (
                      <Box key={entry.id} py={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Badge variant={entry.action === 'check_out' ? 'danger' : entry.action === 'check_in' ? 'success' : 'default'}>{actionLabel(entry.action)}</Badge>
                          <Typography variant="caption" color="text.secondary">{formatDateTime(entry.created_at)}</Typography>
                        </Stack>
                        <Typography variant="body2" fontWeight={500} mt={0.5}>{entry.performed_by}</Typography>
                        <Typography variant="caption" color="text.secondary" component="div">
                          {entry.action === 'move' ? (
                            <>From <Typography variant="caption" component="span" fontWeight={700}>{entry.from_location || '-'}</Typography> to <Typography variant="caption" component="span" fontWeight={700}>{entry.to_location || '-'}</Typography></>
                          ) : entry.action === 'check_in' ? (
                            <>To <Typography variant="caption" component="span" fontWeight={700}>{entry.to_location || '-'}</Typography></>
                          ) : entry.action === 'check_out' ? (
                            <>From <Typography variant="caption" component="span" fontWeight={700}>{entry.from_location || '-'}</Typography></>
                          ) : null}
                        </Typography>
                        {entry.notes ? <Typography variant="body2" mt={0.5}>{entry.notes}</Typography> : null}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Move dialog */}
      <Modal open={moveOpen} title="Move item" confirmLabel={submitting ? 'Moving...' : 'Confirm move'} onConfirm={handleMove} onClose={() => setMoveOpen(false)}>
        <Stack spacing={2.5} pt={1}>
          {moveSource ? (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'grey.50' }}>
              <Typography variant="caption" color="text.secondary">Tracking unit</Typography>
              <Typography variant="body2" mt={0.5} fontFamily="monospace">{moveSource.unit_code}</Typography>
              <Typography variant="body2" mt={0.5}>{moveSource.label} — {moveSource.quantity} pcs</Typography>
            </Paper>
          ) : null}

          {moveSource && moveSource.quantity > 1 ? (
            <Input
              label={`Quantity to move (max ${moveSource.quantity})`}
              type="number"
              value={String(moveQuantity)}
              onChange={(event: any) => setMoveQuantity(Math.max(1, Math.min(moveSource.quantity, Number(event.target.value) || 1)))}
            />
          ) : null}
          {moveSource && moveQuantity < moveSource.quantity ? (
            <Typography variant="caption" color="text.secondary">A new tracking unit will be created for the moved quantity.</Typography>
          ) : null}

          <Box>
            <Typography variant="caption" color="text.secondary" mb={0.5} display="block">Destination type</Typography>
            <ToggleButtonGroup
              value={destType}
              exclusive
              onChange={(_e, val) => { if (val) { setDestType(val); setSelectedSlotId(''); setSelectedMachineId(''); } }}
              size="small"
              fullWidth
            >
              <ToggleButton value="storage">Storage</ToggleButton>
              <ToggleButton value="machine">Machine</ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {destType === 'storage' ? (
            <>
              <Select
                label="Destination rack"
                value={selectedRackId}
                onChange={(event: any) => { setSelectedRackId(event.target.value); setSelectedSlotId(''); }}
                options={[{ label: 'Select rack', value: '' }, ...racks.map((rack) => ({ label: rackDisplayLabel(rack), value: rack.id }))]}
              />
              <Select
                label="Destination cell"
                value={selectedSlotId}
                onChange={(event: any) => setSelectedSlotId(event.target.value)}
                options={[{ label: 'Select cell', value: '' }, ...availableSlots.map((s) => ({ label: s.label, value: s.id }))]}
              />
            </>
          ) : (
            <Select
              label="Destination machine"
              value={selectedMachineId}
              onChange={(event: any) => setSelectedMachineId(event.target.value)}
              options={[{ label: 'Select machine', value: '' }, ...machines.map((m) => ({ label: `${m.code} — ${m.name}`, value: m.id }))]}
            />
          )}

          <Input label="Worker name" value={workerName} onChange={(event: any) => setWorkerName(event.target.value)} />
          <Input label="Move notes" value={moveNotes} onChange={(event: any) => setMoveNotes(event.target.value)} />
        </Stack>
      </Modal>
    </Stack>
  );
}
