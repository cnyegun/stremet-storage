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
import WarningIcon from '@mui/icons-material/WarningAmberOutlined';
import type { ItemDetail, ItemWithLocation, MachineDetail, MachineDetailItem, MachineWithItemCount, RackWithShelves, RackWithStats, TrackingUnit } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useDebouncedValue } from '@/lib/hooks';
import { api } from '@/lib/api';
import { formatDateTime, machineCategoryLabel, rackDisplayLabel } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

const categoryColors: Record<string, 'primary' | 'secondary' | 'warning' | 'error' | 'success'> = {
  sheet_metal: 'secondary',
  cutting: 'error',
  laser: 'primary',
  robot_bending: 'warning',
  bending: 'success',
};

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

  // Import (move item from shelf to this machine)
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

  // Move (move item from machine to shelf or another machine)
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
          label: `${moveRackDetail.code} / R${cell.row_number} / C${cell.column_number}`,
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

  // Load machine
  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    void api.getMachine(params.id)
      .then((r) => setMachine(r.data))
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  // Load racks/machines when move dialog opens
  useEffect(() => {
    if (!moveOpen) return;
    void Promise.all([api.getRacks(), api.getMachines()]).then(([racksResponse, machinesResponse]) => {
      setRacks(racksResponse.data);
      setMachines(machinesResponse.data.filter((entry) => entry.id !== params.id));
    });
  }, [moveOpen, params.id]);

  // Load rack detail for move dialog
  useEffect(() => {
    if (!moveOpen || moveDestinationType !== 'shelf' || !moveRackId) {
      setMoveRackDetail(null);
      return;
    }
    void api.getRack(moveRackId).then((response) => setMoveRackDetail(response.data));
  }, [moveDestinationType, moveOpen, moveRackId]);

  // Import search
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

  // Auto-select single importable unit
  useEffect(() => {
    if (!importOpen) return;
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
    if (!params.id) return;
    const response = await api.getMachine(params.id);
    setMachine(response.data);
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
    if (!machine || !selectedImportUnit || !importWorkerName.trim()) return;
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
      await refreshMachine();
      setImportOpen(false);
      showToast(`Moved ${moveResponse.data.unit_code} to ${machine.code}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setImportSubmitting(false);
    }
  }

  async function handleMoveUnit() {
    if (!moveUnit || !machine || !moveWorkerName.trim()) return;
    if (moveQuantity <= 0 || moveQuantity > moveUnit.quantity) {
      showToast(`Quantity must be between 1 and ${moveUnit.quantity}`, 'error');
      return;
    }
    if (moveDestinationType === 'shelf' && !moveShelfSlotId) { showToast('Select a destination cell', 'error'); return; }
    if (moveDestinationType === 'machine' && !moveMachineId) { showToast('Select a destination machine', 'error'); return; }

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
      showToast(`Moved ${response.data.unit_code} to ${response.data.to}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Move failed', 'error');
    } finally {
      setMoveSubmitting(false);
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
    <Stack spacing={2}>
      {/* Header */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <PrecisionManufacturingIcon sx={{ fontSize: 28, color: 'text.secondary' }} />
            <Box>
              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                <Typography variant="h3">{machine.name}</Typography>
                <Chip label={machineCategoryLabel(machine.category)} size="small" color={categoryColors[machine.category] || 'default'} variant="outlined" />
              </Stack>
              <Stack direction="row" spacing={1.5} mt={0.25}>
                <Typography variant="body2" fontFamily="monospace" fontWeight={500}>{machine.code}</Typography>
                <Typography variant="body2" color="text.secondary">{machine.description}</Typography>
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button onClick={openImportDialog}>Move item here</Button>
            <Link href="/machines" style={{ fontSize: 13, color: '#1565C0', textDecoration: 'none' }}>All machines</Link>
          </Stack>
        </Stack>
      </Paper>

      {/* Stats — simple row */}
      <Stack direction="row" flexWrap="wrap" gap={1.5}>
        <Paper variant="outlined" sx={{ p: 2, flex: '1 1 0', minWidth: 120, textAlign: 'center' }}>
          <InventoryIcon sx={{ color: 'primary.main', fontSize: 20, mb: 0.25 }} />
          <Typography variant="h2">{machine.stats.active_assignments}</Typography>
          <Typography variant="caption" color="text.secondary">Items here</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: '1 1 0', minWidth: 120, textAlign: 'center' }}>
          <PrecisionManufacturingIcon sx={{ color: 'secondary.main', fontSize: 20, mb: 0.25 }} />
          <Typography variant="h2">{machine.stats.total_pieces}</Typography>
          <Typography variant="caption" color="text.secondary">Total pieces</Typography>
        </Paper>
        <Paper variant="outlined" sx={{ p: 2, flex: '1 1 0', minWidth: 120, textAlign: 'center' }}>
          {oldestDays !== null && oldestDays > 7 ? (
            <WarningIcon sx={{ color: 'warning.main', fontSize: 20, mb: 0.25 }} />
          ) : (
            <ScheduleIcon sx={{ color: 'text.secondary', fontSize: 20, mb: 0.25 }} />
          )}
          <Typography variant="h2">{oldestDays !== null ? `${oldestDays}d` : '-'}</Typography>
          <Typography variant="caption" color="text.secondary">Oldest item</Typography>
        </Paper>
      </Stack>

      {/* Items + Activity side by side */}
      <Stack direction={{ xs: 'column', md: 'row' }} gap={1.5}>

        {/* Items at machine */}
        <Card sx={{ flex: 2, minWidth: 0 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="subtitle1">Items at machine</Typography>
              <Typography variant="caption" color="text.secondary">{machine.items.length} items</Typography>
            </Stack>

            {machine.items.length === 0 ? (
              <Stack spacing={1.5} alignItems="center">
                <EmptyState title="No items" description="No items at this machine." />
                <Button onClick={openImportDialog}>Move an item here</Button>
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
                          <Typography variant="body2" mt={0.25}>{item.item_name}</Typography>
                          <Stack direction="row" spacing={1.5} mt={0.5} flexWrap="wrap">
                            <Typography variant="caption" color="text.secondary">{item.customer_name || 'General stock'}</Typography>
                            <Typography variant="caption" color="text.secondary">{item.material}</Typography>
                            {item.dimensions ? <Typography variant="caption" color="text.secondary">{item.dimensions}</Typography> : null}
                          </Stack>
                          <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>
                            Moved here by {item.assigned_by} on {formatDateTime(item.assigned_at)}
                          </Typography>
                        </Box>
                        <Stack alignItems="flex-end" spacing={0.75} sx={{ minWidth: 140 }}>
                          <Chip label={`${item.quantity} pcs`} size="small" variant="outlined" />
                          {days !== null && days > 7 ? (
                            <Typography variant="caption" color="warning.main" fontWeight={600}>{days} days</Typography>
                          ) : days !== null ? (
                            <Typography variant="caption" color="text.secondary">{days} days</Typography>
                          ) : null}
                          <Stack direction="row" spacing={1}>
                            <Link href={`/check-out/${item.item_id}?assignmentId=${encodeURIComponent(item.assignment_id)}&unitCode=${encodeURIComponent(item.unit_code)}&sourceType=machine`}>
                              <Button variant="danger">Check out</Button>
                            </Link>
                            <Button variant="secondary" onClick={() => openMoveDialog(item)}>Move</Button>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card sx={{ flex: 1, minWidth: 280 }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
              <Typography variant="subtitle1">Recent activity</Typography>
              <Typography variant="caption" color="text.secondary">{machine.activity.length} entries</Typography>
            </Stack>

            <Box sx={{ maxHeight: 480, overflow: 'auto' }}>
              {machine.activity.length === 0 ? (
                <EmptyState title="No activity" description="No recorded moves to or from this machine." />
              ) : (
                <Stack divider={<Divider />}>
                  {machine.activity.map((entry) => (
                    <Box key={entry.id} py={1.25}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Badge variant={entry.to_location === `M/${machine.code}` ? 'warning' : 'success'}>
                          {entry.to_location === `M/${machine.code}` ? 'In' : 'Out'}
                        </Badge>
                        <Typography variant="caption" color="text.secondary">{formatDateTime(entry.created_at)}</Typography>
                      </Stack>
                      <Link href={`/items/${entry.item_id}`} style={{ textDecoration: 'none' }}>
                        <Typography variant="body2" fontWeight={500} mt={0.5} color="primary" sx={{ '&:hover': { textDecoration: 'underline' } }}>
                          {entry.item_code} — {entry.item_name}
                        </Typography>
                      </Link>
                      <Typography variant="caption" color="text.secondary" component="div">
                        {entry.from_location || '-'} → {entry.to_location || '-'}
                      </Typography>
                      {entry.notes ? <Typography variant="caption" mt={0.25} display="block">{entry.notes}</Typography> : null}
                      <Typography variant="caption" color="text.secondary">{entry.performed_by}</Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </Box>
          </CardContent>
        </Card>
      </Stack>

      {/* Move dialog — move item from this machine to a shelf or another machine */}
      <Modal
        open={moveOpen}
        title={moveUnit ? `Move ${moveUnit.unit_code}` : 'Move unit'}
        confirmLabel={moveSubmitting ? 'Moving...' : 'Confirm move'}
        confirmDisabled={!canSubmitMove}
        onConfirm={handleMoveUnit}
        onClose={() => setMoveOpen(false)}
      >
        <Stack spacing={2} pt={0.5}>
          {moveUnit && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{moveUnit.unit_code}</Typography>
              <Typography variant="body2">{moveUnit.item_name} — {moveUnit.quantity} pcs</Typography>
            </Paper>
          )}

          <Select
            label="Destination type"
            value={moveDestinationType}
            onChange={(event) => {
              setMoveDestinationType(event.target.value as 'shelf' | 'machine');
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
            <Stack direction="row" spacing={1.5}>
              <Select
                label="Rack"
                value={moveRackId}
                onChange={(event) => { setMoveRackId(event.target.value); setMoveShelfSlotId(''); }}
                options={[{ value: '', label: 'Select rack' }, ...racks.map((rack) => ({ value: rack.id, label: rackDisplayLabel(rack) }))]}
              />
              <Select
                label="Cell"
                value={moveShelfSlotId}
                onChange={(event) => setMoveShelfSlotId(event.target.value)}
                options={[{ value: '', label: 'Select cell' }, ...availableMoveShelves]}
              />
            </Stack>
          ) : (
            <Select
              label="Destination machine"
              value={moveMachineId}
              onChange={(event) => setMoveMachineId(event.target.value)}
              options={[{ value: '', label: 'Select machine' }, ...machines.map((entry) => ({ value: entry.id, label: `${entry.code} - ${entry.name}` }))]}
            />
          )}

          <Stack direction="row" spacing={1.5}>
            <Input
              label={moveUnit ? `Qty (max ${moveUnit.quantity})` : 'Qty'}
              type="number"
              value={String(moveQuantity)}
              disabled={!moveUnit}
              onChange={(event) => setMoveQuantity(Math.max(1, Math.min(moveUnit?.quantity || 1, Number(event.target.value) || 1)))}
            />
            <Input label="Worker name" value={moveWorkerName} onChange={(event) => setMoveWorkerName(event.target.value)} />
          </Stack>
          <TextField label="Notes (optional)" value={moveNotes} onChange={(event) => setMoveNotes(event.target.value)} multiline minRows={2} fullWidth size="small" />
        </Stack>
      </Modal>

      {/* Import dialog — search for an item in storage and move it to this machine */}
      <Modal
        open={importOpen}
        title={`Move item to ${machine.code}`}
        confirmLabel={importSubmitting ? 'Moving...' : 'Confirm'}
        confirmDisabled={!canImportUnit}
        onConfirm={handleImportUnit}
        onClose={() => setImportOpen(false)}
      >
        <Stack spacing={2} pt={0.5}>
          <Input
            label="Search items in storage"
            value={importQuery}
            onChange={(event) => {
              setImportQuery(event.target.value);
              setSelectedImportItem(null);
              setSelectedImportItemDetail(null);
              setSelectedImportUnit(null);
            }}
            placeholder="Item code, name, or customer..."
          />

          {importSearchLoading && <Typography variant="caption" color="text.secondary">Searching...</Typography>}

          {!selectedImportItem && importResults.length > 0 && (
            <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
              <Stack divider={<Divider />}>
                {importResults.map((item) => (
                  <Box
                    key={item.id}
                    sx={{ p: 1.5, cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => selectImportItem(item)}
                  >
                    <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{item.item_code}</Typography>
                    <Typography variant="caption" color="text.secondary">{item.name} — {item.customer_name || 'General stock'}</Typography>
                  </Box>
                ))}
              </Stack>
            </Paper>
          )}

          {selectedImportItem && (
            <Paper variant="outlined" sx={{ p: 1.5 }}>
              <Typography variant="body2" fontFamily="monospace" fontWeight={600}>{selectedImportItem.item_code}</Typography>
              <Typography variant="body2">{selectedImportItem.name}</Typography>
              <Typography variant="caption" color="text.secondary">{selectedImportItem.customer_name || 'General stock'}</Typography>
            </Paper>
          )}

          {importItemLoading && <Typography variant="caption" color="text.secondary">Loading units...</Typography>}

          {importableUnits.length > 1 && (
            <Select
              label="Select storage unit"
              value={selectedImportUnit?.assignment_id || ''}
              onChange={(event) => {
                const unit = importableUnits.find((u) => u.assignment_id === event.target.value);
                if (unit) {
                  setSelectedImportUnit(unit);
                  setImportQuantity(unit.quantity);
                }
              }}
              options={[
                { value: '', label: 'Select unit' },
                ...importableUnits.map((unit) => ({
                  value: unit.assignment_id,
                  label: `${unit.unit_code} — ${unit.rack_code}/R${unit.row_number}C${unit.column_number} (${unit.quantity} pcs)`,
                })),
              ]}
            />
          )}

          {selectedImportUnit && (
            <Stack direction="row" spacing={1.5}>
              <Input
                label={`Qty (max ${selectedImportUnit.quantity})`}
                type="number"
                value={String(importQuantity)}
                onChange={(event) => setImportQuantity(Math.max(1, Math.min(selectedImportUnit.quantity, Number(event.target.value) || 1)))}
              />
              <Input label="Worker name" value={importWorkerName} onChange={(event) => setImportWorkerName(event.target.value)} />
            </Stack>
          )}

          {selectedImportUnit && (
            <TextField label="Notes (optional)" value={importNotes} onChange={(event) => setImportNotes(event.target.value)} multiline minRows={2} fullWidth size="small" />
          )}
        </Stack>
      </Modal>
    </Stack>
  );
}
