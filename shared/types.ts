// ============================================================
// Stremet Storage Management System — Shared Types
// This file is the contract between backend and frontend.
// ============================================================

// --- Enums ---

export type ItemType = 'customer_order' | 'general_stock';

export type ActionType = 'check_in' | 'check_out' | 'move' | 'note_added';

export type MachineCategory = 'sheet_metal' | 'cutting' | 'laser' | 'robot_bending' | 'bending';

export type MachineAssignmentStatus = 'queued' | 'processing' | 'needs_attention' | 'ready_for_storage';

export type RackType = 'raw_materials' | 'work_in_progress' | 'finished_goods' | 'customer_orders' | 'general_stock';

// --- Database Entities ---

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
  created_at: string;
  updated_at: string;
}

export interface ShelfSlot {
  id: string;
  rack_id: string;
  shelf_number: number;
  row_number: number;
  column_number: number;
  capacity: number;
  width_m: number;
  depth_m: number;
  height_m: number;
  max_volume_m3: number;
  current_volume_m3: number;
  current_count: number;
  current_weight_kg: number;
  measured_weight_kg: number;
  weight_discrepancy_threshold: number;
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
  volume_m3: number;
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
  unit_code: string;
  parent_unit_code: string | null;
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

export interface Machine {
  id: string;
  name: string;
  code: string;
  category: MachineCategory;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface MachineAssignment {
  id: string;
  item_id: string;
  machine_id: string;
  unit_code: string;
  parent_unit_code: string | null;
  status: MachineAssignmentStatus;
  quantity: number;
  assigned_at: string;
  assigned_by: string;
  removed_at: string | null;
  removed_by: string | null;
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

export interface RackWithShelves extends Rack {
  total_cells: number;
  occupied_cells: number;
  total_items: number;
  shelves: ShelfSlotWithItems[];
}

export interface ShelfSlotWithItems extends ShelfSlot {
  rack_code: string;
  rack_label: string;
  items: RackCellItem[];
}

export interface RackWithStats extends Rack {
  cell_count: number;
  total_capacity: number;
  items_stored: number;
  cells_in_use: number;
}

export interface StorageLocation {
  unit_code: string;
  parent_unit_code: string | null;
  rack_id: string;
  rack_code: string;
  rack_label: string;
  row_number: number;
  column_number: number;
  shelf_slot_id: string;
  assignment_id: string;
  checked_in_at: string;
  quantity: number;
}

export interface StorageAssignmentWithItem extends StorageAssignment {
  item: Item;
}

export interface RackCellItem {
  assignment_id: string;
  item_id: string;
  item_code: string;
  unit_code: string;
  item_name: string;
  customer_name: string | null;
  material: string;
  volume_m3?: number;
  quantity: number;
  checked_in_at: string;
  checked_in_by: string;
}

export interface ItemWithLocation extends Item {
  customer_name: string | null;
  customer_code: string | null;
  current_location: StorageLocation | null;
}

export interface MachineLocation {
  assignment_id: string;
  unit_code: string;
  parent_unit_code: string | null;
  status: MachineAssignmentStatus;
  machine_id: string;
  machine_code: string;
  machine_name: string;
  machine_category: MachineCategory;
  quantity: number;
  assigned_at: string;
  assigned_by: string;
}

export interface TrackingUnit {
  assignment_id: string;
  source_type: 'shelf' | 'machine';
  unit_code: string;
  parent_unit_code: string | null;
  status: MachineAssignmentStatus | null;
  quantity: number;
  assigned_at: string;
  assigned_by: string;
  shelf_slot_id: string | null;
  rack_id: string | null;
  rack_code: string | null;
  rack_label: string | null;
  row_number: number | null;
  column_number: number | null;
  machine_id: string | null;
  machine_code: string | null;
  machine_name: string | null;
  machine_category: MachineCategory | null;
}

export interface ItemDetail extends ItemWithLocation {
  machine_locations: MachineLocation[];
  tracking_units: TrackingUnit[];
  activity_history: ActivityLog[];
}

export interface MachineWithItemCount extends Machine {
  active_items: number;
  total_quantity: number;
}

export interface MachineDetailItem {
  assignment_id: string;
  unit_code: string;
  parent_unit_code: string | null;
  status: MachineAssignmentStatus;
  item_id: string;
  item_code: string;
  item_name: string;
  customer_name: string | null;
  material: string;
  dimensions: string;
  weight_kg: number;
  quantity: number;
  assigned_at: string;
  assigned_by: string;
  notes: string | null;
}

export interface MachineActivity extends ActivityLog {
  item_code: string;
  item_name: string;
}

export interface MachineStats {
  active_assignments: number;
  total_pieces: number;
  completed_assignments: number;
  oldest_assignment: string | null;
}

export interface MachineDetail extends Machine {
  items: MachineDetailItem[];
  activity: MachineActivity[];
  stats: MachineStats;
}

export interface ActivityLogWithItem extends ActivityLog {
  item_code: string;
  item_name: string;
}

export interface LocationSuggestion {
  shelf_slot_id: string;
  rack_id: string;
  rack_code: string;
  rack_label: string;
  row_number: number;
  column_number: number;
  available_capacity: number;
  reason: string;
  score: number;
}

export interface DuplicateWarning {
  item_code: string;
  existing_locations: {
    rack_id: string;
    rack_code: string;
    rack_label: string;
    row_number: number;
    column_number: number;
    quantity: number;
    checked_in_at: string;
  }[];
}

export interface GlobalSearchLocation {
  rack_id: string;
  rack_code: string;
  rack_label: string;
  rack_type: RackType;
  items_stored: number;
}

export interface GlobalSearchCustomer {
  id: string;
  name: string;
  code: string;
  items_in_storage: number;
}

export interface GlobalSearchMachine {
  id: string;
  name: string;
  code: string;
  category: MachineCategory | string;
  active_items: number;
}

export interface GlobalSearchResponse {
  items: ItemWithLocation[];
  customers: GlobalSearchCustomer[];
  locations: GlobalSearchLocation[];
  machines: GlobalSearchMachine[];
}

export interface WarehouseStats {
  total_racks: number;
  total_slots: number;
  total_capacity: number; // Volume m3
  volume_stored: number; // Volume m3
  slots_in_use: number;
  occupancy_percent: number;
  racks: RackWithStats[];
}

// --- Dashboard ---

export interface DashboardStats {
  total_racks: number;
  total_slots: number;
  total_capacity: number;
  volume_stored: number;
  slots_in_use: number;
  total_items_stored: number;
  occupancy_percent: number;
}

export interface DashboardCustomerBreakdown {
  customer_name: string;
  customer_code: string;
  assignment_count: number;
  total_quantity: number;
}

export interface DashboardMachine {
  id: string;
  code: string;
  name: string;
  category: MachineCategory;
  active_items: number;
  active_quantity: number;
  needs_attention: number;
}

export interface DashboardAging {
  over_14_days: number;
  over_30_days: number;
  over_60_days: number;
  total_active: number;
}

export interface DashboardDailyActivity {
  day: string;
  check_ins: number;
  check_outs: number;
  moves: number;
  total: number;
}

export interface DashboardRackOccupancy {
  code: string;
  label: string;
  rack_type: RackType;
  total_cells: number;
  used_cells: number;
  item_count: number;
}

export interface DashboardMaterialBreakdown {
  material: string;
  assignment_count: number;
  total_quantity: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_activity: ActivityLogWithItem[];
  customer_breakdown: DashboardCustomerBreakdown[];
  machines: DashboardMachine[];
  aging: DashboardAging;
  daily_activity: DashboardDailyActivity[];
  rack_occupancy: DashboardRackOccupancy[];
  material_breakdown: DashboardMaterialBreakdown[];
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
  source_type?: 'shelf' | 'machine';
  checked_out_by: string;
  notes?: string;
}

export interface MoveRequest {
  assignment_id: string;
  source_type: 'shelf' | 'machine';
  to_shelf_slot_id?: string;
  to_machine_id?: string;
  performed_by: string;
  notes?: string;
  quantity?: number;
}

export type ActionProposal =
  | {
      action: 'check_in';
      item_id: string;
      item_code: string;
      shelf_slot_id: string;
      location: string;
      quantity: number;
      notes?: string;
    }
  | {
      action: 'check_out';
      assignment_id: string;
      unit_code: string;
      source_type: 'shelf' | 'machine';
      location: string;
      item_code: string;
      notes?: string;
    }
  | {
      action: 'move';
      assignment_id: string;
      unit_code: string;
      source_type: 'shelf' | 'machine';
      from: string;
      to: string;
      to_shelf_slot_id?: string;
      to_machine_id?: string;
      quantity?: number;
      notes?: string;
    };

export interface AssistantRequest {
  message: string;
  imageBase64?: string;
  history: { role: 'user' | 'assistant'; content: string }[];
  workerName?: string;
}

export interface AssistantResponse {
  message: string;
  sql?: string;
  data?: Record<string, unknown>[];
  rowCount?: number;
  action?: ActionProposal;
}

export interface UnitLookupResult {
  source_type: 'shelf' | 'machine';
  assignment_id: string;
  unit_code: string;
  quantity: number;
  item_id: string;
  item_code: string;
  item_name: string;
  material: string;
  weight_kg: number;
  customer_name: string | null;
  customer_code: string | null;
  location: string;
  rack_id?: string;
  rack_code?: string;
  shelf_slot_id?: string;
  row_number?: number;
  column_number?: number;
  checked_in_at?: string;
  checked_in_by?: string;
  machine_id?: string;
  machine_code?: string;
  machine_name?: string;
  machine_category?: MachineCategory;
  status?: MachineAssignmentStatus;
  assigned_at?: string;
  assigned_by?: string;
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
  rack_id?: string;
  rack_type?: RackType;
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
