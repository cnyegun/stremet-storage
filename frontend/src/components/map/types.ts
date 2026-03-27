export interface MapItem {
  id: string;
  item_id: string;
  item_code: string;
  name: string;
  customer_name: string | null;
  quantity: number;
  item_href: string;
  checkout_href: string;
}

export interface MapShelf {
  id: string;
  shelf_number: number;
  capacity: number;
  current_count: number;
  items: MapItem[];
  checkin_href: string;
}

export interface MapRack {
  id: string;
  code: string;
  label: string;
  zone_id: string;
  zone_code: string;
  zone_name: string;
  total_shelves: number;
  occupancy_used: number;
  occupancy_total: number;
  shelves: MapShelf[];
}

export interface MapZone {
  id: string;
  code: string;
  name: string;
  description: string;
  color: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rack_count: number;
  total_slots: number;
  occupied_slots: number;
  total_items: number;
  racks: MapRack[];
}

export interface MapStatsData {
  total_items_stored: number;
  total_slots: number;
  occupied_slots: number;
  available_slots: number;
}

export interface WarehouseMapData {
  zones: MapZone[];
  stats: MapStatsData;
}
