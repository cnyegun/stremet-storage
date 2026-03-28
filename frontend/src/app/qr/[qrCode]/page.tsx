'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';

type QrScanData = {
  qr_code: string;
  scan_url: string;
  qr_type: string;
  status: string;
  item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  customer_name: string | null;
  active_unit_code: string | null;
  quantity: number;
  location_code: string | null;
  location_type: string;
  order_number: string | null;
  manufacturing_date: string | null;
  recommended_rack_id: string | null;
  recommended_shelf_slot_id: string | null;
  recommended_location_code: string | null;
  order_progress: {
    requested_quantity: number;
    fulfilled_quantity: number;
    status: string;
  } | null;
};

const savedWorkerKey = 'stremet.qrWorkerName';

export default function QrScanPage() {
  const params = useParams<{ qrCode: string }>();
  const { showToast } = useToast();
  const [data, setData] = useState<QrScanData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [autoAssignReady, setAutoAssignReady] = useState(false);

  const loadQrData = useCallback(async () => {
    if (!params.qrCode) return;

    setLoading(true);
    setError(null);
    try {
      const result = await api.getQrScanResult(params.qrCode);
      setData(result.data as QrScanData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load QR record');
    } finally {
      setLoading(false);
    }
  }, [params.qrCode]);

  const assignToStorage = useCallback(async (autoTriggered = false) => {
    if (!data) return;
    if (!workerName.trim()) {
      showToast('Worker name is required before assigning storage', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.intakeProductQr({
        qr_code: data.scan_url,
        performed_by: workerName.trim(),
        notes: notes || (autoTriggered ? 'Assigned from QR scan URL' : undefined),
        preferred_rack_id: data.recommended_rack_id || undefined,
        preferred_shelf_slot_id: data.recommended_shelf_slot_id || undefined,
      });
      window.localStorage.setItem(savedWorkerKey, workerName.trim());
      showToast(`Assigned to ${result.data.location_code}`);
      await loadQrData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Storage assignment failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }, [data, loadQrData, notes, showToast, workerName]);

  useEffect(() => {
    void loadQrData();
  }, [loadQrData]);

  useEffect(() => {
    const saved = window.localStorage.getItem(savedWorkerKey);
    if (saved) {
      setWorkerName(saved);
      setAutoAssignReady(true);
    }
  }, []);

  useEffect(() => {
    if (!autoAssignReady || !data || data.status !== 'unassigned' || !workerName.trim() || submitting) {
      return;
    }

    setAutoAssignReady(false);
    void assignToStorage(true);
  }, [assignToStorage, autoAssignReady, data, submitting, workerName]);

  if (loading) {
    return (
      <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <LoadingSpinner />
        <Typography variant="body2" color="text.secondary">Loading QR record...</Typography>
      </Paper>
    );
  }

  if (!data) {
    return <EmptyState title="Unable to load QR record" description={error || 'QR record not found'} />;
  }

  const currentLocation = data.location_code || 'Not yet stored';
  const recommendedLocation = data.recommended_location_code || 'No recommended rack available';

  return (
    <Stack spacing={2.5}>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Typography variant="h3">{data.item_name || data.item_code || 'QR Record'}</Typography>
        {data.item_code ? <Typography variant="body2" fontFamily="monospace">{data.item_code}</Typography> : null}
        <Typography variant="caption" color="text.secondary">Scan URL: {data.scan_url}</Typography>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1}>
          <Typography variant="body2">QR status: {data.status}</Typography>
          <Typography variant="body2">QR type: {data.qr_type}</Typography>
          <Typography variant="body2">Product ID: {data.item_code || '-'}</Typography>
          <Typography variant="body2">Record ID: {data.item_id || '-'}</Typography>
          <Typography variant="body2">Tracked unit: {data.active_unit_code || 'Not assigned yet'}</Typography>
          <Typography variant="body2">Customer: {data.customer_name || '-'}</Typography>
          <Typography variant="body2">Order number: {data.order_number || '-'}</Typography>
          <Typography variant="body2">Order/manufacturing date: {formatDateTime(data.manufacturing_date)}</Typography>
          <Typography variant="body2">Current location: {currentLocation}</Typography>
          <Typography variant="body2">Recommended storage: {recommendedLocation}</Typography>
          {data.order_progress ? (
            <Typography variant="body2">
              Order progress: {data.order_progress.fulfilled_quantity}/{data.order_progress.requested_quantity} ({data.order_progress.status})
            </Typography>
          ) : null}
        </Stack>
      </Paper>

      {data.status === 'unassigned' ? (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Assign this scanned product to storage</Typography>
            <Input label="Worker name" value={workerName} onChange={(e: any) => setWorkerName(e.target.value)} />
            <TextField label="Scan notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline minRows={2} fullWidth />
            <Button onClick={() => void assignToStorage()} disabled={submitting}>
              {submitting ? 'Assigning...' : `Assign To ${recommendedLocation}`}
            </Button>
          </Stack>
        </Paper>
      ) : (
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Typography variant="body2">This scanned product is already tracked in {currentLocation}.</Typography>
        </Paper>
      )}

      {data.item_id ? (
        <Link href={`/items/${data.item_id}`} style={{ fontSize: 13, color: '#1565C0' }}>
          Open item record
        </Link>
      ) : null}
    </Stack>
  );
}
