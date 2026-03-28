import type { RackWithShelves, RackWithStats, WarehouseStats } from '@shared/types';
import { api } from '@/lib/api';
import type { MapCell, MapRack, WarehouseMapData } from './types';

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCellItems(items: any[]) {
  return items.map((item) => ({
    id: item.assignment_id,
    assignment_id: item.assignment_id,
    item_id: item.item_id,
    item_code: item.item_code,
    unit_code: item.unit_code,
    name: item.item_name,
    customer_name: item.customer_name,
    quantity: item.quantity,
    item_href: `/items/${item.item_id}`,
    checkout_href: `/check-out/${item.item_id}?assignmentId=${encodeURIComponent(item.assignment_id)}&unitCode=${encodeURIComponent(item.unit_code)}`,
  }));
}

function mapRackFromDetail(rack: RackWithShelves): MapRack {
  const cells: MapCell[] = rack.shelves.map((cell) => ({
    id: cell.id,
    row_number: cell.row_number,
    column_number: cell.column_number,
    max_volume_m3: toNumber(cell.max_volume_m3),
    current_volume_m3: toNumber(cell.current_volume_m3),
    current_count: toNumber(cell.current_count),
    items: mapCellItems(cell.items),
    checkin_href: `/check-in?rack=${encodeURIComponent(rack.id)}&cell=${encodeURIComponent(cell.id)}`,
  }));

  return {
    id: rack.id,
    code: rack.code,
    label: rack.label,
    description: rack.description,
    rack_type: rack.rack_type,
    row_count: rack.row_count,
    column_count: rack.column_count,
    occupancy_used: cells.reduce((sum, cell) => sum + cell.current_volume_m3, 0),
    occupancy_total: cells.reduce((sum, cell) => sum + cell.max_volume_m3, 0),
    cells_in_use: cells.filter((c) => c.current_count > 0).length,
    cells,
  };
}

function mapRackSummary(rack: RackWithStats): MapRack {
  return {
    id: rack.id,
    code: rack.code,
    label: rack.label,
    description: rack.description,
    rack_type: rack.rack_type,
    row_count: rack.row_count,
    column_count: rack.column_count,
    occupancy_used: toNumber(rack.volume_stored),
    occupancy_total: toNumber(rack.total_capacity),
    cells_in_use: toNumber(rack.cells_in_use),
    cells: [],
  };
}

function buildStats(stats: WarehouseStats): WarehouseMapData['stats'] {
  return {
    total_items_stored: toNumber(stats.total_volume_stored),
    total_slots: toNumber(stats.total_slots),
    occupied_slots: toNumber(stats.slots_in_use),
    available_slots: toNumber(stats.total_slots - stats.slots_in_use),
  };
}

export async function getWarehouseMapData(): Promise<WarehouseMapData> {
  const statsRes = await api.getStats();
  const rackDetails = await Promise.all(
    statsRes.data.racks.map(async (rack) => {
      try {
        const detailResponse = await api.getRack(rack.id);
        return mapRackFromDetail(detailResponse.data);
      } catch {
        return mapRackSummary(rack);
      }
    }),
  );

  return {
    racks: rackDetails,
    stats: buildStats(statsRes.data),
  };
}

export async function getRackMapData(rackId: string): Promise<MapRack> {
  const response = await api.getRack(rackId);
  return mapRackFromDetail(response.data);
}
