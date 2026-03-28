'use client';

import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge, MachineLocationBadge } from '@/components/ui/LocationBadge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { ItemDetail } from '@shared/types';

export default function CheckOutPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  const requestedAssignmentId = searchParams.get('assignmentId') || '';
  const requestedUnitCode = searchParams.get('unitCode') || '';
  const requestedSourceType = searchParams.get('sourceType') === 'machine' ? 'machine' : 'shelf';

  useEffect(() => {
    if (!params.id) {
      return;
    }

    void api
      .getItem(params.id)
      .then((response) => setItem(response.data))
      .finally(() => setLoading(false));
  }, [params.id]);

  const selectedUnit = useMemo(() => {
    if (!item) {
      return null;
    }

    return item.tracking_units.find((unit) => unit.assignment_id === requestedAssignmentId && unit.source_type === requestedSourceType) || null;
  }, [item, requestedAssignmentId, requestedSourceType]);

  const activeShelfUnits = useMemo(
    () => item?.tracking_units.filter((unit) => unit.source_type === requestedSourceType) || [],
    [item, requestedSourceType],
  );

  const hasInvalidRequestedUnit = Boolean(requestedAssignmentId) && !selectedUnit;
  const fallbackUnit = !requestedAssignmentId && activeShelfUnits.length === 1 ? activeShelfUnits[0] : null;

  const checkoutUnit = selectedUnit || fallbackUnit;
  const checkoutAssignmentId = checkoutUnit?.assignment_id || '';
  const checkoutUnitCode = checkoutUnit?.unit_code || '';
  const checkoutQuantity = checkoutUnit?.quantity || 0;
  const checkoutLocation = checkoutUnit || null;

  async function handleSubmit() {
    if (!checkoutAssignmentId || !workerName) {
      showToast('Worker name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.checkOutItem({
        assignment_id: checkoutAssignmentId,
        source_type: requestedSourceType,
        checked_out_by: workerName,
        notes: notes || undefined,
      });
      setSuccessMessage(`Checked out unit ${response.data.unit_code} (${response.data.item_code}) from ${response.data.location}`);
      showToast('Item checked out successfully');
      if (item) {
        window.setTimeout(() => router.push(`/items/${item.id}`), 1200);
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-out failed', 'error');
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

  if (!item) {
    return <EmptyState title="Item is not in storage" description="This item cannot be checked out right now." />;
  }

  if (hasInvalidRequestedUnit) {
    return <EmptyState title="Tracking unit not found" description="The selected unit is no longer active. Return to the item or machine page and choose a current unit." />;
  }

  if (!checkoutAssignmentId || !checkoutLocation) {
    return <EmptyState title="Select a specific unit" description="This item has multiple active units. Open the item page and choose the exact unit to check out." />;
  }

  return (
    <Stack spacing={2.5}>
      <Typography variant="h3">Check out</Typography>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" gutterBottom>Unit</Typography>
          <Grid container spacing={3}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="caption" color="text.secondary">Item</Typography>
              <Typography variant="body2" mt={0.25}>{item.name}</Typography>
              <Typography variant="caption" fontFamily="monospace">{item.item_code}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="caption" color="text.secondary">Tracking unit</Typography>
              <Typography variant="body2" fontFamily="monospace" mt={0.25}>{checkoutUnitCode}</Typography>
              <Typography variant="caption" color="text.secondary">{checkoutQuantity} pcs</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="caption" color="text.secondary">Current location</Typography>
              <div style={{ marginTop: 4 }}>
                {requestedSourceType === 'machine' ? (
                  <MachineLocationBadge code={checkoutLocation.machine_code || '-'} name={checkoutLocation.machine_name || undefined} />
                ) : (
                  <LocationBadge location={checkoutLocation} />
                )}
              </div>
            </Grid>
          </Grid>

          <Grid container spacing={2} mt={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Input label="Worker name" value={workerName} onChange={(event: ChangeEvent<HTMLInputElement>) => setWorkerName(event.target.value)} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                multiline
                minRows={2}
                fullWidth
                placeholder="Shipped to customer, moved to production, etc."
              />
            </Grid>
          </Grid>

          <Stack direction="row" justifyContent="flex-end" mt={3}>
            <Button variant="danger" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Checking out...' : 'Confirm check-out'}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      {successMessage ? (
        <Paper variant="outlined" sx={{ p: 2, bgcolor: '#e8f5e9', borderColor: '#4caf50' }}>
          <Typography variant="body2" fontFamily="monospace" color="success.main">{successMessage}</Typography>
        </Paper>
      ) : null}
    </Stack>
  );
}
