'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MuiButton from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import { api } from '@/lib/api';
import { rackDisplayLabel } from '@/lib/utils';
import { useWorkerSession } from '@/components/ui/WorkerSession';
import type { UnitLookupResult, RackWithStats, MachineWithItemCount } from '@shared/types';

type ScanState = 'scanning' | 'loading' | 'found' | 'error';
type ActionState = 'idle' | 'picking_destination' | 'confirming' | 'executing' | 'done' | 'action_error';

export default function ScanPage() {
  const { workerName, promptWorker } = useWorkerSession();
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<InstanceType<typeof import('html5-qrcode').Html5Qrcode> | null>(null);
  const [scanState, setScanState] = useState<ScanState>('scanning');
  const [unit, setUnit] = useState<UnitLookupResult | null>(null);
  const [error, setError] = useState('');
  const [actionState, setActionState] = useState<ActionState>('idle');
  const [actionError, setActionError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Move destination state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [destinationType, setDestinationType] = useState<'rack' | 'machine' | null>(null);
  const [racks, setRacks] = useState<RackWithStats[]>([]);
  const [machines, setMachines] = useState<MachineWithItemCount[]>([]);
  const [selectedShelfSlotId, setSelectedShelfSlotId] = useState<string | null>(null);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [destinationLabel, setDestinationLabel] = useState('');

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        const state = html5QrCodeRef.current.getState();
        if (state === 2) { // SCANNING
          await html5QrCodeRef.current.stop();
        }
      } catch {
        // ignore
      }
    }
  }, []);

  const handleScan = useCallback(async (decodedText: string) => {
    // Only process unit codes (contain -U)
    const code = decodedText.trim();
    if (!code) return;

    await stopScanner();
    setScanState('loading');
    setError('');
    setUnit(null);
    setActionState('idle');
    setSuccessMessage('');
    setActionError('');

    try {
      const result = await api.lookupUnit(code);
      setUnit(result.data);
      setScanState('found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unit not found');
      setScanState('error');
    }
  }, [stopScanner]);

  // Initialize scanner
  useEffect(() => {
    let mounted = true;

    async function initScanner() {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!mounted || !scannerRef.current) return;

      const scanner = new Html5Qrcode('qr-reader');
      html5QrCodeRef.current = scanner;

      try {
        await scanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          (decodedText) => {
            if (mounted) handleScan(decodedText);
          },
          () => {}, // ignore scan failures
        );
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Camera access denied');
          setScanState('error');
        }
      }
    }

    if (scanState === 'scanning') {
      initScanner();
    }

    return () => {
      mounted = false;
      stopScanner();
    };
  }, [scanState, handleScan, stopScanner]);

  const resetToScanner = useCallback(async () => {
    setUnit(null);
    setError('');
    setActionState('idle');
    setActionError('');
    setSuccessMessage('');
    setScanState('scanning');
  }, []);

  // Check out handler
  const handleCheckOut = async () => {
    if (!unit) return;
    if (!workerName) { promptWorker(); return; }
    setActionState('confirming');
  };

  const confirmCheckOut = async () => {
    if (!unit) return;
    if (!workerName) { promptWorker(); return; }
    setActionState('executing');
    try {
      await api.checkOutItem({
        assignment_id: unit.assignment_id,
        source_type: unit.source_type,
        checked_out_by: workerName,
      });
      setActionState('done');
      setSuccessMessage(`Checked out ${unit.unit_code} from ${unit.location}`);
    } catch (err) {
      setActionState('action_error');
      setActionError(err instanceof Error ? err.message : 'Check out failed');
    }
  };

  // Move handler
  const handleMove = async () => {
    if (!unit) return;
    setActionState('picking_destination');
    setMoveDialogOpen(true);
    setDestinationType(null);
    setSelectedShelfSlotId(null);
    setSelectedMachineId(null);
    setDestinationLabel('');

    // Load destinations
    try {
      const [racksRes, machinesRes] = await Promise.all([
        api.getRacks(),
        api.getMachines(),
      ]);
      setRacks(racksRes.data);
      setMachines(machinesRes.data);
    } catch {
      // will show empty lists
    }
  };

  const confirmMove = async () => {
    if (!unit) return;
    if (!workerName) { promptWorker(); return; }
    setMoveDialogOpen(false);
    setActionState('executing');
    try {
      await api.moveItem({
        assignment_id: unit.assignment_id,
        source_type: unit.source_type,
        to_shelf_slot_id: selectedShelfSlotId || undefined,
        to_machine_id: selectedMachineId || undefined,
        performed_by: workerName,
      });
      setActionState('done');
      setSuccessMessage(`Moved ${unit.unit_code} from ${unit.location} to ${destinationLabel}`);
    } catch (err) {
      setActionState('action_error');
      setActionError(err instanceof Error ? err.message : 'Move failed');
    }
  };

  // Select a rack cell — need to pick a specific shelf slot
  const [rackCells, setRackCells] = useState<{ id: string; row_number: number; column_number: number; max_volume_m3: number; current_volume_m3: number }[]>([]);
  const [selectedRackCode, setSelectedRackCode] = useState('');

  const handlePickRack = async (rackId: string, rackCode: string) => {
    setSelectedRackCode(rackCode);
    try {
      const rackDetail = await api.getRack(rackId);
      setRackCells(
        rackDetail.data.shelves
          .filter((s) => Number(s.current_volume_m3) < Number(s.max_volume_m3 || 0))
          .map((s) => ({
            id: s.id,
            row_number: s.row_number,
            column_number: s.column_number,
            max_volume_m3: Number(s.max_volume_m3) || 0,
            current_volume_m3: Number(s.current_volume_m3) || 0,
          }))
          );
    } catch {
      setRackCells([]);
    }
  };

  const handlePickCell = (cellId: string, row: number, col: number) => {
    setSelectedShelfSlotId(cellId);
    setSelectedMachineId(null);
    setDestinationLabel(`${selectedRackCode}/R${row}C${col}`);
  };

  const handlePickMachine = (machineId: string, machineCode: string) => {
    setSelectedMachineId(machineId);
    setSelectedShelfSlotId(null);
    setDestinationLabel(`M/${machineCode}`);
    setDestinationType(null); // close sub-list
  };

  return (
    <Box sx={{ maxWidth: 480, mx: 'auto', pb: 4 }}>
      <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600, mb: 2 }}>
        QR scan
      </Typography>

      {/* Camera viewfinder */}
      {scanState === 'scanning' && (
        <Box sx={{ borderRadius: 1, overflow: 'hidden', bgcolor: '#000', mb: 2 }}>
          <div id="qr-reader" ref={scannerRef} style={{ width: '100%' }} />
          <Typography sx={{ color: '#fff', textAlign: 'center', py: 1, fontSize: 13, opacity: 0.7 }}>
            Point camera at a unit QR code
          </Typography>
        </Box>
      )}

      {/* Loading */}
      {scanState === 'loading' && (
        <Box sx={{ textAlign: 'center', py: 6 }}>
          <CircularProgress size={32} />
          <Typography sx={{ mt: 1, fontSize: 13, color: 'text.secondary' }}>Looking up unit...</Typography>
        </Box>
      )}

      {/* Error */}
      {scanState === 'error' && (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>{error}</Alert>
          <MuiButton variant="outlined" fullWidth onClick={resetToScanner} sx={{ py: 1.5, fontSize: 15 }}>
            Scan again
          </MuiButton>
        </Box>
      )}

      {/* Unit found card */}
      {scanState === 'found' && unit && (
        <Box>
          {/* Unit info card */}
          <Box sx={{ border: '1px solid #D1D5DB', borderRadius: 1, p: 2, mb: 2, bgcolor: '#fff' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
              <Typography sx={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>
                {unit.unit_code}
              </Typography>
              <Chip
                label={unit.source_type === 'shelf' ? 'Storage' : unit.status || 'Machine'}
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 600,
                  bgcolor: unit.source_type === 'shelf' ? '#E0F2FE' : '#FEF3C7',
                  color: unit.source_type === 'shelf' ? '#0369A1' : '#92400E',
                }}
              />
            </Box>

            <InfoRow label="Item" value={`${unit.item_code} - ${unit.item_name}`} />
            <InfoRow label="Location" value={unit.location} />
            {unit.customer_name && <InfoRow label="Customer" value={`${unit.customer_name} (${unit.customer_code})`} />}
            <InfoRow label="Material" value={unit.material} />
            <InfoRow label="Qty" value={String(unit.quantity)} />
            {unit.weight_kg > 0 && <InfoRow label="Weight" value={`${unit.weight_kg} kg`} />}
          </Box>

          {/* Action buttons */}
          {actionState === 'idle' && (
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <MuiButton
                variant="contained"
                fullWidth
                onClick={handleMove}
                sx={{ py: 2, fontSize: 16, fontWeight: 600, bgcolor: '#2563EB' }}
              >
                Move
              </MuiButton>
              <MuiButton
                variant="contained"
                fullWidth
                onClick={handleCheckOut}
                sx={{ py: 2, fontSize: 16, fontWeight: 600, bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}
              >
                Check out
              </MuiButton>
            </Box>
          )}

          {/* Confirm check out */}
          {actionState === 'confirming' && (
            <Box sx={{ border: '2px solid #DC2626', borderRadius: 1, p: 2, bgcolor: '#FEF2F2' }}>
              <Typography sx={{ fontSize: 14, fontWeight: 600, mb: 1.5 }}>
                Check out {unit.unit_code} from {unit.location}?
              </Typography>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }}>
                This will remove the unit from its current location. As: {workerName}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <MuiButton
                  variant="outlined"
                  fullWidth
                  onClick={() => setActionState('idle')}
                  sx={{ py: 1.5, fontSize: 15 }}
                >
                  Cancel
                </MuiButton>
                <MuiButton
                  variant="contained"
                  fullWidth
                  onClick={confirmCheckOut}
                  sx={{ py: 1.5, fontSize: 15, bgcolor: '#DC2626', '&:hover': { bgcolor: '#B91C1C' } }}
                >
                  Confirm check out
                </MuiButton>
              </Box>
            </Box>
          )}

          {/* Executing */}
          {actionState === 'executing' && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <CircularProgress size={28} />
              <Typography sx={{ mt: 1, fontSize: 13 }}>Processing...</Typography>
            </Box>
          )}

          {/* Done */}
          {actionState === 'done' && (
            <Box>
              <Alert severity="success" sx={{ mb: 2, fontSize: 13 }}>{successMessage}</Alert>
              <MuiButton variant="contained" fullWidth onClick={resetToScanner} sx={{ py: 2, fontSize: 16 }}>
                Scan next
              </MuiButton>
            </Box>
          )}

          {/* Action error */}
          {actionState === 'action_error' && (
            <Box>
              <Alert severity="error" sx={{ mb: 2, fontSize: 13 }}>{actionError}</Alert>
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <MuiButton variant="outlined" fullWidth onClick={() => setActionState('idle')} sx={{ py: 1.5, fontSize: 15 }}>
                  Try again
                </MuiButton>
                <MuiButton variant="contained" fullWidth onClick={resetToScanner} sx={{ py: 1.5, fontSize: 15 }}>
                  Scan next
                </MuiButton>
              </Box>
            </Box>
          )}

          {/* Scan again (always visible when found) */}
          {actionState === 'idle' && (
            <MuiButton variant="text" fullWidth onClick={resetToScanner} sx={{ mt: 1, py: 1.5, fontSize: 13, color: 'text.secondary' }}>
              Scan different unit
            </MuiButton>
          )}
        </Box>
      )}

      {/* Move destination dialog */}
      <Dialog
        open={moveDialogOpen}
        onClose={() => { setMoveDialogOpen(false); setActionState('idle'); }}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle sx={{ fontSize: 15, fontWeight: 600 }}>Move to...</DialogTitle>
        <DialogContent sx={{ px: 1 }}>
          {/* Destination type picker */}
          {!destinationType && !selectedShelfSlotId && !selectedMachineId && (
            <Box sx={{ display: 'flex', gap: 1, p: 1 }}>
              <MuiButton
                variant="outlined"
                fullWidth
                onClick={() => setDestinationType('rack')}
                sx={{ py: 2.5, fontSize: 15 }}
              >
                Rack / Shelf
              </MuiButton>
              <MuiButton
                variant="outlined"
                fullWidth
                onClick={() => setDestinationType('machine')}
                sx={{ py: 2.5, fontSize: 15 }}
              >
                Machine
              </MuiButton>
            </Box>
          )}

          {/* Rack list */}
          {destinationType === 'rack' && !selectedShelfSlotId && rackCells.length === 0 && (
            <Box>
              <MuiButton size="small" onClick={() => setDestinationType(null)} sx={{ mb: 1, fontSize: 12 }}>
                Back
              </MuiButton>
              <List dense>
                {racks.map(rack => (
                  <ListItemButton key={rack.id} onClick={() => handlePickRack(rack.id, rack.code)} sx={{ py: 1.5 }}>
                    <ListItemText
                      primary={<Typography sx={{ fontSize: 14, fontWeight: 500 }}>{rackDisplayLabel(rack)}</Typography>}
                      secondary={<Typography sx={{ fontSize: 11 }}>{rack.items_stored}/{rack.total_capacity} used</Typography>}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}

          {/* Rack cell list */}
          {destinationType === 'rack' && !selectedShelfSlotId && rackCells.length > 0 && (
            <Box>
              <MuiButton size="small" onClick={() => { setRackCells([]); setSelectedRackCode(''); }} sx={{ mb: 1, fontSize: 12 }}>
                Back to racks
              </MuiButton>
              <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, mb: 0.5 }}>
                Available cells in {selectedRackCode}
              </Typography>
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {rackCells.map(cell => (
                  <ListItemButton key={cell.id} onClick={() => handlePickCell(cell.id, cell.row_number, cell.column_number)} sx={{ py: 1.5 }}>
                    <ListItemText
                      primary={<Typography sx={{ fontSize: 14, fontWeight: 500 }}>R{cell.row_number}C{cell.column_number}</Typography>}
                      secondary={<Typography sx={{ fontSize: 11 }}>{cell.current_volume_m3.toFixed(1)}/{cell.max_volume_m3.toFixed(1)} m³ used</Typography>}
                    />
                  </ListItemButton>
                ))}
                {rackCells.length === 0 && (
                  <Typography sx={{ fontSize: 12, color: 'text.secondary', px: 2, py: 2 }}>No available cells</Typography>
                )}
              </List>
            </Box>
          )}

          {/* Machine list */}
          {destinationType === 'machine' && !selectedMachineId && (
            <Box>
              <MuiButton size="small" onClick={() => setDestinationType(null)} sx={{ mb: 1, fontSize: 12 }}>
                Back
              </MuiButton>
              <List dense>
                {machines.map(machine => (
                  <ListItemButton key={machine.id} onClick={() => handlePickMachine(machine.id, machine.code)} sx={{ py: 1.5 }}>
                    <ListItemText
                      primary={<Typography sx={{ fontSize: 14, fontWeight: 500 }}>{machine.code} - {machine.name}</Typography>}
                      secondary={<Typography sx={{ fontSize: 11 }}>{machine.active_items} active items</Typography>}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          )}

          {/* Selected destination */}
          {(selectedShelfSlotId || selectedMachineId) && (
            <Box sx={{ p: 2, textAlign: 'center' }}>
              <Typography sx={{ fontSize: 13, color: 'text.secondary', mb: 0.5 }}>Move to:</Typography>
              <Typography sx={{ fontSize: 18, fontWeight: 700, fontFamily: 'monospace' }}>{destinationLabel}</Typography>
              <MuiButton size="small" onClick={() => { setSelectedShelfSlotId(null); setSelectedMachineId(null); setDestinationType(null); setRackCells([]); }} sx={{ mt: 1, fontSize: 12 }}>
                Change
              </MuiButton>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, pb: 2 }}>
          <MuiButton onClick={() => { setMoveDialogOpen(false); setActionState('idle'); }} sx={{ fontSize: 14, py: 1 }}>
            Cancel
          </MuiButton>
          <MuiButton
            variant="contained"
            disabled={!selectedShelfSlotId && !selectedMachineId}
            onClick={confirmMove}
            sx={{ fontSize: 14, py: 1, px: 3 }}
          >
            Confirm move
          </MuiButton>
        </DialogActions>
      </Dialog>

      {/* Manual code entry fallback */}
      {scanState === 'scanning' && (
        <ManualEntry onSubmit={handleScan} />
      )}
    </Box>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
      <Typography sx={{ fontSize: 12, color: '#6B7280', minWidth: 70 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 500 }}>{value}</Typography>
    </Box>
  );
}

function ManualEntry({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #E5E7EB' }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 1 }}>
        Or enter unit code manually:
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <input
          type="text"
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          onKeyDown={e => { if (e.key === 'Enter' && code.trim()) onSubmit(code.trim()); }}
          placeholder="e.g. KONE-001-PANEL-A-U001"
          style={{
            flex: 1,
            padding: '12px',
            fontSize: 15,
            border: '1px solid #D1D5DB',
            borderRadius: 4,
            fontFamily: 'monospace',
          }}
        />
        <MuiButton
          variant="contained"
          disabled={!code.trim()}
          onClick={() => { if (code.trim()) onSubmit(code.trim()); }}
          sx={{ px: 3, fontSize: 15 }}
        >
          Go
        </MuiButton>
      </Box>
    </Box>
  );
}
