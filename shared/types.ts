// ============================================================
// Stremet Storage Management System — Shared Types
// This file is the contract between backend and frontend.
// ============================================================

// --- Enums ---

export type ItemType = 'customer_order' | 'general_stock';

export type ActionType = 'check_in' | 'check_out' | 'move' | 'note_added';

// --- Database Entities ---

export interface Zone {
  id: string;
  name: string;
  code: string;
  description: string;
  color: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  created_at: string;
  updated_at: string;
}

export interface Rack {
  id: string;
  zone_id: string;
  code: string;
  label: string;
  position_in_zone: number;
  total_shelves: number;
  created_at: string;
  updated_at: string;
}

export interface ShelfSlot {
  id: string;
  rack_id: string;
  shelf_number: number;
  capacity: number;
  current_count: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  name: string;
  code: string;
  contact_email: string;
  created_at: string;
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
  type: ItemType;
  order_number: string | null;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface StorageAssignment {
  id: string;
  item_id: string;
  shelf_slot_id: string;
  quantity: number;
  checked_in_at: string;
  checked_out_at: string | null;
  checked_in_by: string;
  checked_out_by: string | null;
  notes: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  item_id: string;
  action: ActionType;
  from_location: string | null;
  to_location: string | null;
  performed_by: string;
  notes: string | null;
  created_at: string;
}

// --- API Response Wrappers ---

export interface ApiResponse<T> {
  data: T;
  warning?: string;
}

export interface ApiListResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface ApiError {
  error: string;
  details?: string;
}

// --- Enriched / Joined Types (API responses with related data) ---

export interface ZoneWithStats extends Zone {
  rack_count: number;
  slot_count: number;
  total_capacity: number;
  items_stored: number;
  slots_in_use: number;
}

export interface RackWithShelves extends Rack {
  zone_code: string;
  zone_name: string;
  shelves: ShelfSlotWithItems[];
}

export interface ShelfSlotWithItems extends ShelfSlot {
  rack_code: string;
  items: StorageAssignmentWithItem[];
}

export interface StorageAssignmentWithItem extends StorageAssignment {
  item: Item;
}

export interface ItemWithLocation extends Item {
  customer_name: string | null;
  customer_code: string | null;
  current_location: {
    zone_name: string;
    zone_code: string;
    rack_code: string;
    shelf_number: number;
    shelf_slot_id: string;
    assignment_id: string;
    checked_in_at: string;
  } | null;
}

export interface ItemDetail extends ItemWithLocation {
  activity_history: ActivityLog[];
}

export interface ActivityLogWithItem extends ActivityLog {
  item_code: string;
  item_name: string;
}

export interface LocationSuggestion {
  shelf_slot_id: string;
  zone_code: string;
  zone_name: string;
  rack_code: string;
  shelf_number: number;
  available_capacity: number;
  reason: string;
  score: number;
}

export interface DuplicateWarning {
  item_code: string;
  existing_locations: {
    zone_name: string;
    rack_code: string;
    shelf_number: number;
    quantity: number;
    checked_in_at: string;
  }[];
}

export interface WarehouseStats {
  total_zones: number;
  total_racks: number;
  total_slots: number;
  total_capacity: number;
  items_stored: number;
  slots_in_use: number;
  occupancy_percent: number;
  zones: ZoneWithStats[];
}

// --- Request Bodies ---

export interface CheckInRequest {
  item_id: string;
  shelf_slot_id: string;
  quantity: number;
  checked_in_by: string;
  notes?: string;
}

export interface CheckOutRequest {
  assignment_id: string;
  checked_out_by: string;
  notes?: string;
}

export interface MoveRequest {
  assignment_id: string;
  to_shelf_slot_id: string;
  performed_by: string;
  notes?: string;
}

export interface CreateItemRequest {
  item_code: string;
  customer_id?: string;
  name: string;
  description?: string;
  material: string;
  dimensions?: string;
  weight_kg?: number;
  type: ItemType;
  order_number?: string;
  quantity: number;
}

export interface UpdateItemRequest {
  name?: string;
  description?: string;
  material?: string;
  dimensions?: string;
  weight_kg?: number;
  type?: ItemType;
  order_number?: string;
  quantity?: number;
}

// --- Query Parameters ---

export interface ItemFilters {
  search?: string;
  type?: ItemType;
  customer_id?: string;
  zone_id?: string;
  material?: string;
  min_age_days?: number;
  max_age_days?: number;
  in_storage?: boolean;
  sort_by?: 'item_code' | 'name' | 'customer' | 'checked_in_at' | 'location' | 'created_at';
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ActivityFilters {
  item_id?: string;
  action?: ActionType;
  performed_by?: string;
  date_from?: string;
  date_to?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}
