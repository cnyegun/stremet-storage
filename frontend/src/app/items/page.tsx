'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Customer, ItemFilters, ItemType, ItemWithLocation, ZoneWithStats } from '@shared/types';
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
import { formatDateTime } from '@/lib/utils';

const PAGE_SIZE = 25;

export default function ItemsPage() {
  const router = useRouter();
  const [items, setItems] = useState<ItemWithLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [zones, setZones] = useState<ZoneWithStats[]>([]);
  const [materials, setMaterials] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ItemFilters>({ page: 1, per_page: PAGE_SIZE, sort_by: 'created_at', sort_order: 'desc' });

  useEffect(() => {
    void Promise.all([api.getCustomers(), api.getZones(), api.getItems({ per_page: 100, page: 1 })])
      .then(([customerResponse, zoneResponse, itemResponse]) => {
        setCustomers(customerResponse.data);
        setZones(zoneResponse.data);
        setMaterials(Array.from(new Set(itemResponse.data.map((item) => item.material).filter((material): material is string => Boolean(material)))).sort());
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    void api
      .getItems(filters)
      .then((response) => {
        setItems(response.data);
        setTotal(response.total);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [filters]);

  const columns = useMemo<TableColumn<ItemWithLocation>[]>(
    () => [
      { key: 'item_code', header: 'Item code', sortable: true, render: (item) => <span className="font-mono font-medium">{item.item_code}</span> },
      { key: 'name', header: 'Name', sortable: true, render: (item) => item.name },
      { key: 'customer', header: 'Customer', sortable: true, render: (item) => item.customer_name || '-' },
      { key: 'material', header: 'Material', render: (item) => item.material || '-' },
      { key: 'type', header: 'Type', render: (item) => <Badge variant="primary">{item.type}</Badge> },
      { key: 'location', header: 'Location', sortable: true, render: (item) => <LocationBadge location={item.current_location} /> },
      {
        key: 'checked_in_at',
        header: 'Checked in',
        sortable: true,
        render: (item) => <span className="font-mono text-xs">{formatDateTime(item.current_location?.checked_in_at || item.created_at)}</span>,
      },
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
    <div className="space-y-3 py-3">
      <div className="flex items-center justify-between border-b border-app-border bg-app-toolbar px-3 py-2">
        <h1 className="text-sm font-semibold text-app-text">Items</h1>
        <span className="font-mono text-xs text-app-textMuted">{total} records</span>
      </div>

      <SearchBar placeholder="Item code, name, customer, or order number" value={filters.search || ''} onChange={(search) => updateFilter({ search })} />

      <FilterBar
        onClear={() =>
          setFilters({
            page: 1,
            per_page: PAGE_SIZE,
            sort_by: 'created_at',
            sort_order: 'desc',
          })
        }
      >
        <Select
          label="Type"
          value={filters.type || ''}
          onChange={(event) => updateFilter({ type: (event.target.value || undefined) as ItemType | undefined })}
          options={[
            { label: 'All types', value: '' },
            { label: 'Customer order', value: 'customer_order' },
            { label: 'General stock', value: 'general_stock' },
          ]}
        />
        <Select
          label="Customer"
          value={filters.customer_id || ''}
          onChange={(event) => updateFilter({ customer_id: event.target.value || undefined })}
          options={[{ label: 'All customers', value: '' }, ...customers.map((customer) => ({ label: customer.name, value: customer.id }))]}
        />
        <Select
          label="Zone"
          value={filters.zone_id || ''}
          onChange={(event) => updateFilter({ zone_id: event.target.value || undefined })}
          options={[{ label: 'All zones', value: '' }, ...zones.map((zone) => ({ label: `${zone.code} - ${zone.name}`, value: zone.id }))]}
        />
        <Select
          label="Material"
          value={filters.material || ''}
          onChange={(event) => updateFilter({ material: event.target.value || undefined })}
          options={[{ label: 'All materials', value: '' }, ...materials.map((material) => ({ label: material, value: material }))]}
        />
      </FilterBar>

      {loading ? (
        <div className="flex items-center gap-2 border border-app-border bg-white p-4">
          <LoadingSpinner />
          <span className="text-xs text-app-textMuted">Loading items...</span>
        </div>
      ) : error ? (
        <EmptyState title="Unable to load items" description={error} />
      ) : items.length === 0 ? (
        <EmptyState title="No items found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <Table
            columns={columns}
            data={items}
            sortBy={filters.sort_by}
            sortOrder={filters.sort_order}
            onSort={handleSort}
            rowKey={(item) => item.id}
            onRowClick={(item) => router.push(`/items/${item.id}`)}
          />
          <Pagination currentPage={filters.page || 1} perPage={PAGE_SIZE} total={total} onPageChange={(page) => updateFilter({ page })} />
        </>
      )}
    </div>
  );
}
