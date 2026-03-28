// ============================================================
// Stremet Storage Management System — Shared Types
// ============================================================

export type ItemType = 'customer_order' | 'general_stock' | 'raw_material' | 'work_in_progress';
export type ActionType = 'check_in' | 'check_out' | 'move' | 'note_added';
export type MachineCategory = 'sheet_metal' | 'cutting' | 'laser' | 'robot_bending' | 'bending';
export type MachineAssignmentStatus = 'queued' | 'processing' | 'needs_attention' | 'ready_for_storage';
export type RackType = 'raw_materials' | 'work_in_progress' | 'finished_goods' | 'customer_orders' | 'general_stock';

export interface Rack {
  id: string;
  code: string;
  label: string;
  description: string;
  rack_type: RackType;
  row_count: number;
  column_count: number;
  display_order: number;
  total_shelves: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  color: string;
}

export interface ShelfSlot {
  id: string;
  rack_id: string;
  shelf_number: number;
  row_number: number;
  column_number: number;
  width_m: number;
  depth_m: number;
  height_m: number;
  max_volume_m3: number;
  current_volume_m3: number;
  current_count: number;
  current_weight_kg: number;
  max_weight_kg: number;
}

export interface Item {
  id: string;
  item_code: string;
  customer_id: string | null;
  name: string;
  description: string;
  material: string;
  dimensions: string;
  weight_kg: number;
  volume_m3: number;
  type: ItemType;
  quantity: number;
  delivery_date: string | null;
  turnover_class: 'A' | 'B' | 'C';
}

export interface RackWithStats extends Rack {
  cell_count: number;
  total_capacity: number; // Max Volume
  volume_stored: number; // Current Volume
  cells_in_use: number;
  total_items: number;
}

export interface WarehouseStats {
  total_racks: number;
  total_slots: number;
  total_capacity: number;
  total_volume_stored: number;
  total_items_stored: number;
  slots_in_use: number;
  occupancy_percent: number;
  racks: RackWithStats[];
}

export interface GlobalSearchResponse {
  items: any[];
  customers: any[];
  locations: any[];
  machines: any[];
}
