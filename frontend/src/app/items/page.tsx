'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import type { Customer, ItemFilters, ItemType, ItemWithLocation, RackWithStats } from '@shared/types';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar } from '@/components/ui/FilterBar';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { LocationBadge } from '@/components/ui/LocationBadge';
import { Pagination } from '@/components/ui/Pagination';
import { SearchBar } from '@/components/ui/SearchBar';
import { Select } from '@/components/ui/Select';
import { Table, type TableColumn } from '@/components/ui/Table';
import { api } from '@/lib/api';
import { formatDateTime, rackDisplayLabel } from '@/lib/utils';

const PAGE_SIZE = 25;

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemWithLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [racks, setRacks] = useState<RackWithStats[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ItemFilters>({
    page: 1,
    per_page: PAGE_SIZE,
    sort_by: 'created_at',
    sort_order: 'desc',
  });

  useEffect(() => {
    void Promise.all([api.getCustomers(), api.getRacks(), api.getItems({ per_page: 100, page: 1 })])
      .then(([customerResponse, racksResponse, itemResponse]) => {
        setCustomers(customerResponse.data);
        setRacks(racksResponse.data);
        setMaterials(Array.from(new Set(itemResponse.data.map((item) => item.material).filter((m): m is string => Boolean(m)))).sort());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search') || undefined;
    setFilters((current) => (current.search === search ? current : { ...current, search, page: 1 }));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    void api
      .getItems(filters)
      .then((response) => { setItems(response.data); setTotal(response.total); })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const columns = useMemo<TableColumn<ItemWithLocation>[]>(
    () => [
      { key: 'item_code', header: 'Item code', sortable: true, render: (item) => <Typography variant="body2" fontFamily="monospace" fontWeight={500}>{item.item_code}</Typography> },
      { key: 'name', header: 'Name', sortable: true, render: (item) => item.name },
      { key: 'customer', header: 'Customer', sortable: true, render: (item) => item.customer_name || '-' },
      { key: 'material', header: 'Material', render: (item) => item.material || '-' },
      { key: 'type', header: 'Type', render: (item) => <Badge variant="primary">{item.type}</Badge> },
      { key: 'location', header: 'Location', sortable: true, render: (item) => <LocationBadge location={item.current_location} /> },
      { key: 'checked_in_at', header: 'Checked in', sortable: true, render: (item) => <Typography variant="caption" fontFamily="monospace">{formatDateTime(item.current_location?.checked_in_at || item.created_at)}</Typography> },
    ],
    [],
  );

  function updateFilter(next: Partial<ItemFilters>) {
    setFilters((current) => ({ ...current, ...next, page: next.page ?? 1 }));
  }

  function handleSort(key: string) {
    setFilters((current) => ({
      ...current,
      sort_by: key as ItemFilters['sort_by'],
      sort_order: current.sort_by === key && current.sort_order === 'asc' ? 'desc' : 'asc',
      page: 1,
    }));
  }

  return (
    <Stack spacing={2}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography variant="h3">Items</Typography>
        <Typography variant="caption" color="text.secondary">{total} records</Typography>
      </Stack>

      <SearchBar placeholder="Item code, name, customer, or order number" value={filters.search || ''} onChange={(search) => updateFilter({ search })} />

      <FilterBar onClear={() => setFilters({ page: 1, per_page: PAGE_SIZE, sort_by: 'created_at', sort_order: 'desc' })}>
        <Select label="Type" value={filters.type || ''} onChange={(event: any) => updateFilter({ type: (event.target.value || undefined) as ItemType | undefined })} options={[{ label: 'All types', value: '' }, { label: 'Customer order', value: 'customer_order' }, { label: 'General stock', value: 'general_stock' }]} />
        <Select label="Customer" value={filters.customer_id || ''} onChange={(event: any) => updateFilter({ customer_id: event.target.value || undefined })} options={[{ label: 'All customers', value: '' }, ...customers.map((c) => ({ label: c.name, value: c.id }))]} />
        <Select label="Rack" value={filters.rack_id || ''} onChange={(event: any) => updateFilter({ rack_id: event.target.value || undefined })} options={[{ label: 'All racks', value: '' }, ...racks.map((rack) => ({ label: rackDisplayLabel(rack), value: rack.id }))]} />
        <Select label="Material" value={filters.material || ''} onChange={(event: any) => updateFilter({ material: event.target.value || undefined })} options={[{ label: 'All materials', value: '' }, ...materials.map((m) => ({ label: m, value: m }))]} />
      </FilterBar>

      {loading ? (
        <Paper variant="outlined" sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <LoadingSpinner />
          <Typography variant="body2" color="text.secondary">Loading items...</Typography>
        </Paper>
      ) : error ? (
        <EmptyState title="Unable to load items" description={error} />
      ) : items.length === 0 ? (
        <EmptyState title="No items found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <Table columns={columns} data={items} sortBy={filters.sort_by} sortOrder={filters.sort_order} onSort={handleSort} rowKey={(item) => item.id} onRowClick={(item) => router.push(`/items/${item.id}`)} />
          <Pagination currentPage={filters.page || 1} perPage={PAGE_SIZE} total={total} onPageChange={(page) => updateFilter({ page })} />
        </>
      )}
    </Stack>
  );
}
