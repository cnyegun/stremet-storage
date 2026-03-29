'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturingOutlined';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import ScheduleIcon from '@mui/icons-material/ScheduleOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUncheckedOutlined';
import type { ItemDetail, ItemWithLocation, MachineDetail, MachineDetailItem, MachineWithItemCount, RackWithShelves, RackWithStats, TrackingUnit } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatDateTime, machineAssignmentStatusLabel, machineCategoryLabel, rackDisplayLabel } from '@/lib/utils';

const categoryColors: Record<string, 'primary' | 'secondary' | 'warning' | 'error' | 'success'> = {
  sheet_metal: 'secondary',
  cutting: 'error',
  laser: 'primary',
  robot_bending: 'warning',
  bending: 'success',
};

const MACHINE_STATUS_OPTIONS = [
  { value: 'queued', label: 'Queued' },
  { value: 'processing', label: 'Processing' },
  { value: 'needs_attention', label: 'Needs attention' },
  { value: 'ready_for_storage', label: 'Ready for storage' },
  { value: 'processed', label: 'Processed' },
] as const;

function machineStatusVariant(status: string): 'default' | 'primary' | 'success' | 'warning' | 'danger' {
  if (status === 'processing') return 'primary';
  if (status === 'ready_for_storage') return 'success';
  if (status === 'needs_attention') return 'danger';
  return 'default';
}

function daysSince(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
}

export default function MachineDetailPage() {
  const params = useParams<{ id: string }>();
  const { showToast } = useToast();
  const [machine, setMachine] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importQuery, setImportQuery] = useState('');
  const [importResults, setImportResults] = useState<ItemWithLocation[]>([]);
  const [importSearchLoading, setImportSearchLoading] = useState(false);
  const [selectedImportItem, setSelectedImportItem] = useState<ItemWithLocation | null>(null);
  const [selectedImportItemDetail, setSelectedImportItemDetail] = useState<ItemDetail | null>(null);
  const [selectedImportUnit, setSelectedImportUnit] = useState<TrackingUnit | null>(null);
  const [importItemLoading, setImportItemLoading] = useState(false);
  const [importQuantity, setImportQuantity] = useState(1);
  const [importWorkerName, setImportWorkerName] = useState('');
  const [importNotes, setImportNotes] = useState('');
  const [importSubmitting, setImportSubmitting] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveUnit, setMoveUnit] = useState<MachineDetailItem | null>(null);
  const [moveDestinationType, setMoveDestinationType] = useState<'shelf' | 'machine'>('shelf');
  const [racks, setRacks] = useState<RackWithStats[]>([]);
  const [moveRackId, setMoveRackId] = useState('');
  const [moveRackDetail, setMoveRackDetail] = useState<RackWithShelves | null>(null);
  const [moveShelfSlotId, setMoveShelfSlotId] = useState('');
  const [machines, setMachines] = useState<MachineWithItemCount[]>([]);
  const [moveMachineId, setMoveMachineId] = useState('');
  const [moveQuantity, setMoveQuantity] = useState(1);
  const [moveWorkerName, setMoveWorkerName] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [pendingSuggestedSlotId, setPendingSuggestedSlotId] = useState<string | null>(null);
  const [recommendedStorage, setRecommendedStorage] = useState<{ rack_id: string; shelf_slot_id: string; label: string; reason?: string } | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [statusUnit, setStatusUnit] = useState<MachineDetailItem | null>(null);
  const [nextStatus, setNextStatus] = useState('processing');
  const [statusWorkerName, setStatusWorkerName] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const debouncedImportQuery = useDebouncedValue(importQuery, 250);

  const importableUnits = useMemo(
    () => selectedImportItemDetail?.tracking_units.filter((unit) => unit.source_type === 'shelf') || [],
    [selectedImportItemDetail],
  );

  const canImportUnit = Boolean(selectedImportUnit && importWorkerName.trim() && !importSubmitting);
  const availableMoveShelves = useMemo(
    () =>
      moveRackDetail?.shelves
        .filter((cell) => cell.current_volume_m3 < cell.max_volume_m3)
        .map((cell) => ({ 
          value: cell.id, 
          label: `${moveRackDetail.code} / R${cell.row_number} / C${cell.column_number} (${(cell.max_volume_m3 - cell.current_volume_m3).toFixed(2)} m³ free)` 
        })) || [],
    [moveRackDetail],
  );
  const canSubmitMove = Boolean(
    moveUnit &&
    moveWorkerName.trim() &&
    moveQuantity >= 1 &&
    moveQuantity <= (moveUnit?.quantity || 0) &&
    ((moveDestinationType === 'shelf' && moveShelfSlotId) || (moveDestinationType === 'machine' && moveMachineId)),
  ) && !moveSubmitting;
  const canSubmitStatus = Boolean(statusUnit && statusWorkerName.trim() && nextStatus) && !statusSubmitting;

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    void api.getMachine(params.id)
      .then((r) => setMachine(r.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!moveOpen) {
      return;
    }

    void Promise.all([api.getRacks(), api.getMachines()]).then(([racksResponse, machinesResponse]) => {
      setRacks(racksResponse.data);
      setMachines(machinesResponse.data.filter((entry) => entry.id !== params.id));
    });
  }, [moveOpen, params.id]);

  useEffect(() => {
    if (!moveOpen || moveDestinationType !== 'shelf' || !moveRackId) {
      setMoveRackDetail(null);
      return;
    }

    void api.getRack(moveRackId).then((response) => {
      setMoveRackDetail(response.data);
      if (pendingSuggestedSlotId && response.data.shelves.some(s => s.id === pendingSuggestedSlotId)) {
        console.log('[DEBUG] Applying pending slot suggestion:', pendingSuggestedSlotId);
        setMoveShelfSlotId(pendingSuggestedSlotId);
        setPendingSuggestedSlotId(null);
      }
    });
  }, [moveDestinationType, moveOpen, moveRackId, pendingSuggestedSlotId]);

  useEffect(() => {
    if (moveOpen && moveDestinationType === 'shelf' && moveUnit?.item_id) {
      setSuggestionLoading(true);
      void api.getSuggestion(moveUnit.item_id)
        .then((response) => {
          if (response.data && response.data.length > 0) {
            const best = response.data[0];
            setRecommendedStorage({
              rack_id: best.rack_id,
              shelf_slot_id: best.shelf_slot_id,
              label: `${best.rack_code} / R${best.row_number}C${best.column_number}`,
              reason: best.reason
            });
            // Automatically select the suggested rack and queue the slot selection
            setMoveRackId(best.rack_id);
            setPendingSuggestedSlotId(best.shelf_slot_id);
          } else {
            setRecommendedStorage(null);
          }
        })
        .catch((err) => {
          setRecommendedStorage(null);
          showToast('Storage auto-suggest unavailable for this item.', 'warning');
        })
        .finally(() => setSuggestionLoading(false));
    } else {
       setRecommendedStorage(null);
    }
  }, [moveOpen, moveDestinationType, moveUnit?.item_id]);

  useEffect(() => {
    if (!importOpen || !debouncedImportQuery.trim()) {
      setImportResults([]);
      return;
    }

    setImportSearchLoading(true);
    void api
      .getItems({ search: debouncedImportQuery.trim(), in_storage: true, page: 1, per_page: 12 })
      .then((response) => setImportResults(response.data))
      .catch(() => setImportResults([]))
      .finally(() => setImportSearchLoading(false));
  }, [debouncedImportQuery, importOpen]);

  useEffect(() => {
    if (!importOpen) {
      return;
    }

    if (selectedImportUnit && !importableUnits.some((unit) => unit.assignment_id === selectedImportUnit.assignment_id)) {
      setSelectedImportUnit(null);
      setImportQuantity(1);
    }

    if (importableUnits.length === 1) {
      setSelectedImportUnit(importableUnits[0]);
      setImportQuantity(importableUnits[0].quantity);
    }
  }, [importOpen, importableUnits, selectedImportUnit]);

  async function refreshMachine() {
    if (!params.id) {
      return;
    }

    const response = await api.getMachine(params.id);
    setMachine(response.data);
  }

  function handleSelectImportUnit(unit: TrackingUnit) {
    setSelectedImportUnit(unit);
    setImportQuantity(unit.quantity);
  }

  function openImportDialog() {
    setImportOpen(true);
    setImportQuery('');
    setImportResults([]);
    setSelectedImportItem(null);
    setSelectedImportItemDetail(null);
    setSelectedImportUnit(null);
    setImportQuantity(1);
    setImportWorkerName('');
    setImportNotes('');
  }

  function openMoveDialog(item: MachineDetailItem) {
    setMoveUnit(item);
    setMoveDestinationType('shelf');
    setMoveRackId('');
    setMoveRackDetail(null);
    setMoveShelfSlotId('');
    setMoveMachineId('');
    setMoveQuantity(item.quantity);
    setMoveWorkerName('');
    setMoveNotes('');
    setMoveOpen(true);
  }

  function openStatusDialog(item: MachineDetailItem, statusOverride?: string) {
    setStatusUnit(item);
    setNextStatus(statusOverride || item.status);
    setStatusWorkerName('');
    setStatusNotes('');
    setStatusOpen(true);
  }

  async function selectImportItem(item: ItemWithLocation) {
    setSelectedImportItem(item);
    setSelectedImportUnit(null);
    setImportQuantity(1);
    setImportItemLoading(true);
    try {
      const response = await api.getItem(item.id);
      setSelectedImportItemDetail(response.data);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Unable to load item units', 'error');
      setSelectedImportItemDetail(null);
    } finally {
      setImportItemLoading(false);
    }
  }

  async function handleImportUnit() {
    if (!machine) {
      showToast('Machine is not available', 'error');
      return;
    }

    if (!selectedImportUnit) {
      showToast('Select a storage unit to import', 'error');
      return;
    }

    if (!importWorkerName.trim()) {
      showToast('Enter worker name', 'error');
      return;
    }

    if (importQuantity <= 0 || importQuantity > selectedImportUnit.quantity) {
      showToast(`Quantity must be between 1 and ${selectedImportUnit.quantity}`, 'error');
      return;
    }

    setImportSubmitting(true);
    try {
      const moveResponse = await api.moveItem({
        assignment_id: selectedImportUnit.assignment_id,
        source_type: 'shelf',
        to_machine_id: machine.id,
        performed_by: importWorkerName.trim(),
        notes: importNotes || undefined,
        quantity: importQuantity,
      });

      const [machineResponse, itemResponse] = await Promise.all([
        api.getMachine(machine.id),
        selectedImportItem ? api.getItem(selectedImportItem.id) : Promise.resolve(null),
      ]);

      setMachine(machineResponse.data);
      if (itemResponse) {
        setSelectedImportItemDetail(itemResponse.data);
      }
      setImportOpen(false);
      setSelectedImportItem(null);
      setSelectedImportItemDetail(null);
      setSelectedImportUnit(null);
      setImportQuantity(1);
      setImportWorkerName('');
      setImportNotes('');

      showToast(
        importQuantity < selectedImportUnit.quantity
          ? `Imported ${importQuantity} pcs as unit ${moveResponse.data.unit_code}`
          : `Imported unit ${moveResponse.data.unit_code} to ${machine.code}`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImportSubmitting(false);
    }
  }

  async function handleMoveUnit() {
    if (!moveUnit || !machine) {
      showToast('Select a unit to move', 'error');
      return;
    }

    if (!moveWorkerName.trim()) {
      showToast('Enter worker name', 'error');
      return;
    }

    if (moveQuantity <= 0 || moveQuantity > moveUnit.quantity) {
      showToast(`Quantity must be between 1 and ${moveUnit.quantity}`, 'error');
      return;
    }

    if (moveDestinationType === 'shelf' && !moveShelfSlotId) {
      showToast('Select a destination cell', 'error');
      return;
    }

    if (moveDestinationType === 'machine' && !moveMachineId) {
      showToast('Select a destination machine', 'error');
      return;
    }

    setMoveSubmitting(true);
    try {
      const response = await api.moveItem({
        assignment_id: moveUnit.assignment_id,
        source_type: 'machine',
        to_shelf_slot_id: moveDestinationType === 'shelf' ? moveShelfSlotId : undefined,
        to_machine_id: moveDestinationType === 'machine' ? moveMachineId : undefined,
        performed_by: moveWorkerName.trim(),
        notes: moveNotes || undefined,
        quantity: moveQuantity,
      });

      await refreshMachine();
      setMoveOpen(false);
      setMoveUnit(null);
      showToast(
        moveQuantity < moveUnit.quantity
          ? `Moved ${moveQuantity} pcs into new unit ${response.data.unit_code}`
          : `Moved unit ${response.data.unit_code} to ${response.data.to}`,
      );
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Move failed', 'error');
    } finally {
      setMoveSubmitting(false);
    }
  }

  async function handleStatusUpdate() {
    if (!machine || !statusUnit) {
      showToast('Select a unit first', 'error');
      return;
    }

    if (!statusWorkerName.trim()) {
      showToast('Enter worker name', 'error');
      return;
    }

    setStatusSubmitting(true);
    try {
      await api.updateMachineAssignmentStatus(machine.id, statusUnit.assignment_id, {
        status: nextStatus,
        performed_by: statusWorkerName.trim(),
        notes: statusNotes || undefined,
      });
      await refreshMachine();
      setStatusOpen(false);
      setStatusUnit(null);
      showToast(`Updated ${statusUnit.unit_code} to ${machineAssignmentStatusLabel(nextStatus)}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Status update failed', 'error');
    } finally {
      setStatusSubmitting(false);
    }
  }

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <LoadingSpinner />
        <Typography variant="body2" color="text.secondary">Loading machine...</Typography>
      </Paper>
    );
  }

  if (error || !machine) {
    return <EmptyState title="Unable to load machine" description={error || 'Machine not found'} />;
  }

  const oldestDays = daysSince(machine.stats.oldest_assignment);

  return (
    <Stack spacing={2.5}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={2}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <PrecisionManufacturingIcon sx={{ fontSize: 32, color: 'text.secondary' }} />
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h3">{machine.name}</Typography>
                <Chip
                  label={machineCategoryLabel(machine.category)}
                  size="small"
                  color={categoryColors[machine.category] || 'default'}
                  variant="outlined"
                />
              </Stack>
              <Stack direction="row" spacing={2} mt={0.5} flexWrap="wrap">
                <Typography variant="body2" fontFamily="monospace" fontWeight={500}>{machine.code}</Typography>
                <Typography variant="body2" color="text.secondary">{machine.description}</Typography>
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button onClick={openImportDialog}>Import units</Button>
            <Link href="/machines" style={{ fontSize: 13, color: '#1565C0', textDecoration: 'none' }}>All machines</Link>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats cards */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <InventoryIcon sx={{ color: 'primary.main', mb: 0.5 }} />
            <Typography variant="h2">{machine.stats.active_assignments}</Typography>
            <Typography variant="caption" color="text.secondary">Items at machine</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <PrecisionManufacturingIcon sx={{ color: 'secondary.main', mb: 0.5 }} />
            <Typography variant="h2">{machine.stats.total_pieces}</Typography>
            <Typography variant="caption" color="text.secondary">Total pieces</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            <CheckCircleIcon sx={{ color: 'success.main', mb: 0.5 }} />
            <Typography variant="h2">{machine.stats.completed_assignments}</Typography>
            <Typography variant="caption" color="text.secondary">Completed jobs</Typography>
          </Paper>
        </Grid>
        <Grid size={{ xs: 6, md: 3 }}>
          <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
            {oldestDays !== null && oldestDays > 7 ? (
              <WarningIcon sx={{ color: 'warning.main', mb: 0.5 }} />
            ) : (
              <ScheduleIcon sx={{ color: 'text.secondary', mb: 0.5 }} />
            )}
            <Typography variant="h2">{oldestDays !== null ? `${oldestDays}d` : '-'}</Typography>
            <Typography variant="caption" color="text.secondary">Oldest item age</Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Content grid */}
      <Grid container spacing={2.5}>
        {/* Items at machine */}
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">Items being processed</Typography>
                <Typography variant="caption" color="text.secondary">{machine.items.length} items</Typography>
              </Stack>

              {machine.items.length === 0 ? (
                <Stack spacing={2}>
                  <EmptyState title="No items" description="This machine has no items assigned to it." />
                  <Stack direction="row" justifyContent="center">
                    <Button onClick={openImportDialog}>Import first unit</Button>
                  </Stack>
                </Stack>
              ) : (
                <Stack divider={<Divider />}>
                  {machine.items.map((item) => {
                    const days = daysSince(item.assigned_at);
                    return (
                      <Box key={item.assignment_id} py={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                          <Box flex={1} minWidth={0}>
                            <Link href={`/items/${item.item_id}`} style={{ textDecoration: 'none' }}>
                              <Typography variant="body2" fontFamily="monospace" fontWeight={600} color="primary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                                {item.item_code}
                              </Typography>
                            </Link>
                            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" mt={0.25}>
                              <Typography variant="caption" color="text.secondary" fontFamily="monospace">{item.unit_code}</Typography>
                              <Badge variant={machineStatusVariant(item.status)}>{machineAssignmentStatusLabel(item.status)}</Badge>
                            </Stack>
                            <Typography variant="body2" mt={0.25}>{item.item_name}</Typography>
                            <Stack direction="row" spacing={1.5} mt={0.5} flexWrap="wrap">
                              <Typography variant="caption" color="text.secondary">{item.customer_name || 'General stock'}</Typography>
                              <Typography variant="caption" color="text.secondary">{item.material}</Typography>
                              {item.dimensions ? <Typography variant="caption" color="text.secondary">{item.dimensions}</Typography> : null}
                            </Stack>
                          </Box>
                          <Stack alignItems="flex-end" spacing={0.75} sx={{ minWidth: 190 }}>
                            <Chip label={`${item.quantity} pcs`} size="small" variant="outlined" />
                            {days !== null && days > 7 ? (
                              <Typography variant="caption" color="warning.main" fontWeight={600}>{days} days</Typography>
                            ) : days !== null ? (
                              <Typography variant="caption" color="text.secondary">{days} days</Typography>
                            ) : null}
                            <Stack direction="row" spacing={1} flexWrap="wrap" justifyContent="flex-end">
                              <Link href={`/check-out/${item.item_id}?assignmentId=${encodeURIComponent(item.assignment_id)}&unitCode=${encodeURIComponent(item.unit_code)}&sourceType=machine`}>
                                <Button variant="danger">Check out</Button>
                              </Link>
                              <Button variant="secondary" onClick={() => openMoveDialog(item)}>Move</Button>
                              <Button variant="secondary" onClick={() => openStatusDialog(item)}>Set status</Button>
                              <Button variant="danger" onClick={() => openStatusDialog(item, 'needs_attention')}>Flag</Button>
                            </Stack>
                          </Stack>
                        </Stack>
                        <Stack direction="row" spacing={1.5} mt={0.5}>
                          <Typography variant="caption" color="text.secondary">Assigned by {item.assigned_by} on {formatDateTime(item.assigned_at)}</Typography>
                        </Stack>
                        {item.notes ? <Typography variant="caption" color="text.secondary" mt={0.5} display="block">Note: {item.notes}</Typography> : null}
                      </Box>
                    );
                  })}
                </Stack>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Activity */}
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle1">Recent activity</Typography>
                <Typography variant="caption" color="text.secondary">{machine.activity.length} entries</Typography>
              </Stack>

              <Box sx={{ maxHeight: 520, overflow: 'auto' }}>
                {machine.activity.length === 0 ? (
                  <EmptyState title="No activity" description="No recorded moves to or from this machine." />
                ) : (
                  <Stack divider={<Divider />}>
                    {machine.activity.map((entry) => (
                      <Box key={entry.id} py={1.5}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Badge variant={entry.to_location === `M/${machine.code}` ? 'warning' : 'success'}>
                            {entry.to_location === `M/${machine.code}` ? 'Received' : 'Sent out'}
                          </Badge>
                          <Typography variant="caption" color="text.secondary">{formatDateTime(entry.created_at)}</Typography>
                        </Stack>
                        <Link href={`/items/${entry.item_id}`} style={{ textDecoration: 'none' }}>
                          <Typography variant="body2" fontWeight={500} mt={0.5} color="primary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                            {entry.item_code} — {entry.item_name}
                          </Typography>
                        </Link>
                        <Typography variant="caption" color="text.secondary" component="div">
                          From <Typography variant="caption" component="span" fontWeight={700}>{entry.from_location || '-'}</Typography> to <Typography variant="caption" component="span" fontWeight={700}>{entry.to_location || '-'}</Typography>
                        </Typography>
                        {entry.notes ? <Typography variant="body2" mt={0.5}>{entry.notes}</Typography> : null}
                        <Typography variant="caption" color="text.secondary" display="block">{entry.performed_by}</Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Modal
        open={moveOpen}
        title={moveUnit ? `Move ${moveUnit.unit_code}` : 'Move unit'}
        confirmLabel={moveSubmitting ? 'Moving...' : 'Confirm move'}
        confirmDisabled={!canSubmitMove}
        onConfirm={handleMoveUnit}
        onClose={() => setMoveOpen(false)}
      >
        <Stack spacing={2.5} pt={0.5}>
          {moveUnit ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Selected unit</Typography>
                <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{moveUnit.unit_code}</Typography>
                <Typography variant="body2">{moveUnit.item_name}</Typography>
                <Typography variant="caption" color="text.secondary">Available quantity: {moveUnit.quantity} pcs</Typography>
              </Stack>
            </Paper>
          ) : null}

          <Select
            label="Destination type"
            value={moveDestinationType}
            onChange={(event) => {
              const value = event.target.value as 'shelf' | 'machine';
              setMoveDestinationType(value);
              setMoveShelfSlotId('');
              setMoveMachineId('');
              setMoveRackId('');
            }}
            options={[
              { value: 'shelf', label: 'Storage cell' },
              { value: 'machine', label: 'Another machine' },
            ]}
          />

          {moveDestinationType === 'shelf' ? (
            <Stack spacing={2}>
              {suggestionLoading && (
                <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <LoadingSpinner /> Analyzing volumetric limits...
                </Typography>
              )}
              {recommendedStorage && (
                <Paper 
                  variant="outlined" 
                  sx={{ p: 2, bgcolor: 'primary.50', borderColor: 'primary.200', cursor: 'pointer', '&:hover': { bgcolor: 'primary.100' } }}
                  onClick={() => {
                    setMoveRackId(recommendedStorage.rack_id);
                    setPendingSuggestedSlotId(recommendedStorage.shelf_slot_id);
                  }}
                >
                  <Typography variant="subtitle2" color="primary.main" mb={0.5}>💡 Recommended storage</Typography>
                  <Typography variant="body2" fontWeight={500}>{recommendedStorage.label}</Typography>
                  {recommendedStorage.reason && <Typography variant="caption" color="text.secondary">{recommendedStorage.reason}</Typography>}
                  <Typography variant="caption" color="primary.main" display="block" mt={1}>Click to apply</Typography>
                </Paper>
              )}
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Select
                    label="Destination rack"
                    value={moveRackId}
                    onChange={(event) => {
                      setMoveRackId(event.target.value);
                      setMoveShelfSlotId('');
                    }}
                    options={[{ value: '', label: 'Select rack' }, ...racks.map((rack) => ({ value: rack.id, label: rackDisplayLabel(rack) }))]}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Select
                    label="Destination cell"
                    value={moveShelfSlotId}
                    onChange={(event) => setMoveShelfSlotId(event.target.value)}
                    options={[{ value: '', label: 'Select cell' }, ...availableMoveShelves]}
                  />
                </Grid>
              </Grid>
            </Stack>
          ) : (
            <Select
              label="Destination machine"
              value={moveMachineId}
              onChange={(event) => setMoveMachineId(event.target.value)}
              options={[{ value: '', label: 'Select machine' }, ...machines.map((entry) => ({ value: entry.id, label: `${entry.code} - ${entry.name}` }))]}
            />
          )}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Input
                label={moveUnit ? `Quantity to move (max ${moveUnit.quantity})` : 'Quantity to move'}
                type="number"
                value={String(moveQuantity)}
                disabled={!moveUnit}
                onChange={(event) => setMoveQuantity(Math.max(1, Math.min(moveUnit?.quantity || 1, Number(event.target.value) || 1)))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Input label="Worker name" value={moveWorkerName} onChange={(event) => setMoveWorkerName(event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Notes"
                value={moveNotes}
                onChange={(event) => setMoveNotes(event.target.value)}
                multiline
                minRows={2}
                fullWidth
                placeholder="Transfer, setup, fault isolation, etc."
              />
            </Grid>
          </Grid>
        </Stack>
      </Modal>

      <Modal
        open={statusOpen}
        title={statusUnit ? `Update status for ${statusUnit.unit_code}` : 'Update status'}
        confirmLabel={statusSubmitting ? 'Saving...' : 'Save status'}
        confirmDisabled={!canSubmitStatus}
        onConfirm={handleStatusUpdate}
        onClose={() => setStatusOpen(false)}
      >
        <Stack spacing={2.5} pt={0.5}>
          {statusUnit ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Selected unit</Typography>
                <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{statusUnit.unit_code}</Typography>
                <Typography variant="body2">{statusUnit.item_name}</Typography>
                <Badge variant={machineStatusVariant(statusUnit.status)}>{machineAssignmentStatusLabel(statusUnit.status)}</Badge>
              </Stack>
            </Paper>
          ) : null}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Select
                label="New status"
                value={nextStatus}
                onChange={(event) => setNextStatus(event.target.value)}
                options={MACHINE_STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label }))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Input label="Worker name" value={statusWorkerName} onChange={(event) => setStatusWorkerName(event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Notes"
                value={statusNotes}
                onChange={(event) => setStatusNotes(event.target.value)}
                multiline
                minRows={2}
                fullWidth
                placeholder="Fault details, operator notes, next action, etc."
              />
            </Grid>
          </Grid>
        </Stack>
      </Modal>

      <Modal
        open={importOpen}
        title={`Import units to ${machine.code}`}
        confirmLabel={importSubmitting ? 'Importing...' : 'Import unit'}
        confirmDisabled={!canImportUnit}
        onConfirm={handleImportUnit}
        onClose={() => setImportOpen(false)}
      >
        <Stack spacing={2.5} pt={0.5}>
          <Input
            label="Search items or unit code"
            value={importQuery}
            onChange={(event) => setImportQuery(event.target.value)}
            placeholder="Item code, item name, customer, or unit code"
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 5 }}>
              <Paper variant="outlined" sx={{ minHeight: 280, maxHeight: 420, overflow: 'auto' }}>
                <Box px={2} py={1.5} borderBottom={1} borderColor="divider">
                  <Typography variant="subtitle2">Search results</Typography>
                </Box>
                {importSearchLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center" px={2} py={2}>
                    <LoadingSpinner />
                    <Typography variant="body2" color="text.secondary">Searching...</Typography>
                  </Stack>
                ) : importResults.length === 0 ? (
                  <Box px={2} py={2}>
                    <Typography variant="body2" color="text.secondary">Search for an item in storage to import units.</Typography>
                  </Box>
                ) : (
                  <Stack divider={<Divider />}>
                    {importResults.map((item) => (
                      <Box
                        key={item.id}
                        px={2}
                        py={1.5}
                        sx={{
                          cursor: 'pointer',
                          bgcolor: selectedImportItem?.id === item.id ? 'primary.50' : 'background.paper',
                          borderLeft: selectedImportItem?.id === item.id ? '3px solid' : '3px solid transparent',
                          borderLeftColor: selectedImportItem?.id === item.id ? 'primary.main' : 'transparent',
                        }}
                        onClick={() => void selectImportItem(item)}
                      >
                        <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{item.item_code}</Typography>
                        <Typography variant="body2">{item.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{item.customer_name || 'General stock'}</Typography>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Paper>
            </Grid>

            <Grid size={{ xs: 12, md: 7 }}>
              <Paper variant="outlined" sx={{ minHeight: 280, maxHeight: 420, overflow: 'auto' }}>
                <Box px={2} py={1.5} borderBottom={1} borderColor="divider">
                  <Typography variant="subtitle2">Storage units</Typography>
                  {selectedImportItem ? <Typography variant="caption" color="text.secondary">{selectedImportItem.name}</Typography> : null}
                </Box>

                {importItemLoading ? (
                  <Stack direction="row" spacing={1} alignItems="center" px={2} py={2}>
                    <LoadingSpinner />
                    <Typography variant="body2" color="text.secondary">Loading storage units...</Typography>
                  </Stack>
                ) : !selectedImportItem ? (
                  <Box px={2} py={2}>
                    <Typography variant="body2" color="text.secondary">Choose an item from the left to see importable units.</Typography>
                  </Box>
                ) : importableUnits.length === 0 ? (
                  <Box px={2} py={2}>
                    <Typography variant="body2" color="text.secondary">This item has no active storage units available for import.</Typography>
                  </Box>
                ) : (
                  <Stack divider={<Divider />}>
                    {importableUnits.map((unit) => {
                      const selected = selectedImportUnit?.assignment_id === unit.assignment_id;
                      return (
                        <Box
                          key={unit.assignment_id}
                          px={2}
                          py={1.5}
                          sx={{
                            cursor: 'pointer',
                            bgcolor: selected ? 'primary.50' : 'background.paper',
                            borderLeft: '3px solid',
                            borderLeftColor: selected ? 'primary.main' : 'transparent',
                          }}
                          onClick={() => handleSelectImportUnit(unit)}
                        >
                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            <Box>
                              <Stack direction="row" spacing={1} alignItems="center">
                                {selected ? <CheckCircleIcon color="primary" sx={{ fontSize: 18 }} /> : <RadioButtonUncheckedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />}
                                <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{unit.unit_code}</Typography>
                                {selected ? <Chip label="Selected" size="small" color="primary" variant="outlined" /> : null}
                              </Stack>
                              <Box mt={0.5}><LocationBadge location={unit} /></Box>
                              {unit.parent_unit_code ? <Typography variant="caption" color="text.secondary">Split from {unit.parent_unit_code}</Typography> : null}
                            </Box>
                            <Typography variant="caption" color="text.secondary">{unit.quantity} pcs</Typography>
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Paper variant="outlined" sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle2">Selected unit</Typography>
                {selectedImportUnit ? (
                  <Stack spacing={0.75} mt={1}>
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{selectedImportUnit.unit_code}</Typography>
                    <LocationBadge location={selectedImportUnit} />
                    <Typography variant="caption" color="text.secondary">Available quantity: {selectedImportUnit.quantity} pcs</Typography>
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary" mt={1}>Select one storage unit from the list above.</Typography>
                )}
              </Box>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Input
                    label={selectedImportUnit ? `Quantity to import (max ${selectedImportUnit.quantity})` : 'Quantity to import'}
                    type="number"
                    disabled={!selectedImportUnit}
                    value={String(importQuantity)}
                    onChange={(event) => setImportQuantity(Math.max(1, Math.min(selectedImportUnit?.quantity || 1, Number(event.target.value) || 1)))}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Input label="Worker name" value={importWorkerName} onChange={(event) => setImportWorkerName(event.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Notes"
                    value={importNotes}
                    onChange={(event) => setImportNotes(event.target.value)}
                    multiline
                    minRows={2}
                    fullWidth
                    placeholder="Setup, batching, priority, etc."
                  />
                </Grid>
              </Grid>

              <Typography variant="caption" color="text.secondary">
                {!selectedImportUnit
                  ? 'Choose a storage unit first.'
                  : !importWorkerName.trim()
                    ? 'Enter worker name to enable import.'
                    : 'Ready to import the selected unit into this machine.'}
              </Typography>
            </Stack>
          </Paper>
        </Stack>
      </Modal>
    </Stack>
  );
}
