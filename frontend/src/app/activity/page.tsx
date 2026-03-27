'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ActionType, ActivityFilters, ActivityLogWithItem } from '@shared/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { Input } from '@/components/ui/Input';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Pagination } from '@/components/ui/Pagination';
import { Select } from '@/components/ui/Select';
import { Table, type TableColumn } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDateTime, toTitleCase } from '@/lib/utils';

const PAGE_SIZE = 50;

export default function ActivityPage() {
  const [entries, setEntries] = useState<ActivityLogWithItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ActivityFilters>({ page: 1, per_page: PAGE_SIZE, sort_order: 'desc' });

  useEffect(() => {
    setLoading(true);
    setError(null);
    void api
      .getActivity(filters)
      .then((response) => {
        setEntries(response.data);
        setTotal(response.total);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const columns = useMemo<TableColumn<ActivityLogWithItem>[]>(
    () => [
      { key: 'created_at', header: 'Timestamp', sortable: true, render: (entry) => <span className="font-mono text-xs">{formatDateTime(entry.created_at)}</span> },
      { key: 'action', header: 'Action', render: (entry) => toTitleCase(entry.action) },
      {
        key: 'item_code',
        header: 'Item code',
        render: (entry) => (
          <Link className="font-mono text-app-primary hover:underline" href={`/items/${entry.item_id}`} onClick={(event) => event.stopPropagation()}>
            {entry.item_code}
          </Link>
        ),
      },
      { key: 'from_location', header: 'From', render: (entry) => <span className="font-mono text-xs">{entry.from_location || '-'}</span> },
      { key: 'to_location', header: 'To', render: (entry) => <span className="font-mono text-xs">{entry.to_location || '-'}</span> },
      { key: 'performed_by', header: 'Performed by', render: (entry) => entry.performed_by },
      { key: 'notes', header: 'Notes', render: (entry) => <span className="text-xs">{entry.notes || '-'}</span> },
    ],
    [],
  );

  function updateFilter(next: Partial<ActivityFilters>) {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between border-b border-app-border bg-app-toolbar px-3 py-2">
        <h1 className="text-sm font-semibold text-app-text">Activity log</h1>
        <span className="font-mono text-xs text-app-textMuted">{total} entries</span>
      </div>

      <FilterBar onClear={() => setFilters({ page: 1, per_page: PAGE_SIZE, sort_order: 'desc' })}>
        <Select
          label="Action"
          value={filters.action || ''}
          onChange={(event) => updateFilter({ action: (event.target.value || undefined) as ActionType | undefined })}
          options={[
            { label: 'All actions', value: '' },
            { label: 'Check in', value: 'check_in' },
            { label: 'Check out', value: 'check_out' },
            { label: 'Move', value: 'move' },
            { label: 'Note added', value: 'note_added' },
          ]}
        />
        <Input label="Worker name" value={filters.performed_by || ''} onChange={(event) => updateFilter({ performed_by: event.target.value || undefined })} />
        <Input label="From date" type="date" value={filters.date_from || ''} onChange={(event) => updateFilter({ date_from: event.target.value || undefined })} />
        <Input label="To date" type="date" value={filters.date_to || ''} onChange={(event) => updateFilter({ date_to: event.target.value || undefined })} />
      </FilterBar>

      {loading ? (
        <div className="flex items-center gap-2 border border-app-border bg-white p-4">
          <LoadingSpinner />
          <span className="text-xs text-app-textMuted">Loading activity...</span>
        </div>
      ) : error ? (
        <EmptyState title="Unable to load activity" description={error} />
      ) : entries.length === 0 ? (
        <EmptyState title="No activity found" description="Try widening the date range or clearing filters." />
      ) : (
        <>
          <Table columns={columns} data={entries} rowKey={(entry) => entry.id} />
          <Pagination currentPage={filters.page || 1} perPage={PAGE_SIZE} total={total} onPageChange={(page) => updateFilter({ page })} />
        </>
      )}
    </div>
  );
}
