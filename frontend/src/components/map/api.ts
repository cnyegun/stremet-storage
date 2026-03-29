import type { RackWithShelves, RackWithStats } from '@shared/types';
import { api } from '@/lib/api';
import type { MapCell, MapRack, WarehouseMapData } from './types';

function toNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapCellItems(items: RackWithShelves['shelves'][number]['items']) {
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
    capacity: toNumber(cell.capacity),
    max_volume_m3: toNumber(cell.max_volume_m3),
    current_volume_m3: toNumber(cell.current_volume_m3),
    current_count: toNumber(cell.current_count),
    current_weight_kg: toNumber(cell.current_weight_kg),
    measured_weight_kg: toNumber(cell.measured_weight_kg),
    weight_discrepancy_threshold: toNumber(cell.weight_discrepancy_threshold),
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
    occupancy_used: toNumber(rack.items_stored),
    occupancy_total: toNumber(rack.total_capacity),
    cells: [],
  };
}

function buildStats(racks: MapRack[]): WarehouseMapData['stats'] {
  const totalSlots = racks.reduce((sum, rack) => sum + (rack.cells.length || rack.row_count * rack.column_count), 0);
  const occupiedSlots = racks.reduce((sum, rack) => sum + rack.cells.filter((cell) => cell.current_count > 0).length, 0);
  const totalItemsStored = racks.reduce((sum, rack) => sum + rack.occupancy_used, 0);

  return {
    total_items_stored: totalItemsStored,
    total_slots: totalSlots,
    occupied_slots: occupiedSlots,
    available_slots: totalSlots - occupiedSlots,
  };
}

export async function getWarehouseMapData(): Promise<WarehouseMapData> {
  const response = await api.getAllRackDetails();
  const rackDetails = response.data.map(mapRackFromDetail);

  return {
    racks: rackDetails,
    stats: buildStats(rackDetails),
  };
}

export async function getRackMapData(rackId: string): Promise<MapRack> {
  const response = await api.getRack(rackId);
  return mapRackFromDetail(response.data);
}
