'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { ItemDetail } from '@shared/types';

export default function CheckOutPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [workerName, setWorkerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (!params.id) {
      return;
    }
    void api
      .getItem(params.id)
      .then((response) => setItem(response.data))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleSubmit() {
    if (!item?.current_location?.assignment_id || !workerName) {
      showToast('Worker name is required', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.checkOutItem({
        assignment_id: item.current_location.assignment_id,
        checked_out_by: workerName,
        notes: notes || undefined,
      });
      setSuccessMessage(`Checked out ${response.data.item_code} from ${response.data.location}`);
      showToast('Item checked out successfully');
      window.setTimeout(() => router.push(`/items/${item.id}`), 1200);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Check-out failed', 'error');
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

  if (!item || !item.current_location?.assignment_id) {
    return <EmptyState title="Item is not in storage" description="This item cannot be checked out right now." />;
  }

  return (
    <div className="space-y-3 py-3">
      <div className="border-b border-app-border bg-app-toolbar px-3 py-2">
        <h1 className="text-sm font-semibold text-app-text">Check out</h1>
      </div>

      <section className="border border-app-border bg-white">
        <div className="border-b border-app-border bg-app-toolbar px-4 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-app-text">Item</h2>
        </div>
        <div className="p-4">
          <dl className="grid gap-3 md:grid-cols-2">
            <div>
              <dt className="text-xs text-app-textMuted">Item</dt>
              <dd className="mt-0.5 font-mono text-sm text-app-text">{item.item_code} - {item.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-app-textMuted">Current location</dt>
              <dd className="mt-0.5"><LocationBadge location={item.current_location} /></dd>
            </div>
          </dl>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input label="Worker name" value={workerName} onChange={(event) => setWorkerName(event.target.value)} />
            <label className="flex flex-col gap-1 text-xs font-medium uppercase tracking-wider text-app-text">
              <span>Notes</span>
              <textarea className="border border-app-border px-3 py-2 text-sm text-app-text shadow-inset outline-none focus:border-app-primary" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Shipped to customer, moved to production, etc." />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <Button variant="danger" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Checking out...' : 'Confirm check-out'}
            </Button>
          </div>
        </div>
      </section>

      {successMessage ? (
        <section className="border-2 border-app-success bg-green-50 p-4 font-mono text-xs text-app-success">{successMessage}</section>
      ) : null}
    </div>
  );
}
