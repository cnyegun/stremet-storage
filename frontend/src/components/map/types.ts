export interface MapItem {
  id: string;
  assignment_id: string;
  item_id: string;
  item_code: string;
  unit_code: string;
  name: string;
  customer_name: string | null;
  quantity: number;
  volume_m3?: number;
  item_href: string;
  checkout_href: string;
}

export interface MapCell {
  id: string;
  row_number: number;
  column_number: number;
  max_volume_m3: number;
  current_volume_m3: number;
  current_count: number;
  items: MapItem[];
  checkin_href: string;
}

export interface MapRack {
  id: string;
  code: string;
  label: string;
  description: string;
  rack_type: string;
  row_count: number;
  column_count: number;
  occupancy_used: number;
  occupancy_total: number;
  cells: MapCell[];
}

export interface MapStatsData {
  total_items_stored: number;
  total_slots: number;
  occupied_slots: number;
  available_slots: number;
}

export interface WarehouseMapData {
  racks: MapRack[];
  stats: MapStatsData;
}
