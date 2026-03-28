export type ItemType = 'customer_order' | 'general_stock';
export type ActionType = 'check_in' | 'check_out' | 'move' | 'note_added' | 'job_created' | 'job_started' | 'job_completed' | 'job_cancelled' | 'unit_consumed' | 'unit_produced' | 'unit_scrapped' | 'unit_reworked' | 'unit_held';
export type MachineCategory = 'sheet_metal' | 'cutting' | 'laser' | 'robot_bending' | 'bending';
export type MachineAssignmentStatus = 'queued' | 'processing' | 'needs_attention' | 'ready_for_storage';
export type RackType = 'raw_materials' | 'work_in_progress' | 'finished_goods' | 'customer_orders' | 'general_stock';
export type ProductionJobStatus = 'draft' | 'in_progress' | 'completed' | 'cancelled';
export type ProductionOutputOutcome = 'good' | 'scrap' | 'rework' | 'hold';
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
    zone_id: string | null;
    code: string;
    label: string;
    description: string;
    rack_type: RackType;
    row_count: number;
    column_count: number;
    display_order: number;
    position_in_zone: number;
    total_shelves: number;
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
    production_job_id?: string | null;
    tracking_unit_code?: string | null;
    machine_id?: string | null;
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
export interface ProductionJob {
    id: string;
    job_code: string;
    machine_id: string;
    status: ProductionJobStatus;
    assigned_by: string;
    completed_by: string | null;
    started_at: string | null;
    completed_at: string | null;
    notes: string | null;
    result_summary: string | null;
    created_at: string;
    updated_at: string;
}
export interface ProductionJobInput {
    id: string;
    production_job_id: string;
    machine_assignment_id: string;
    item_id: string;
    unit_code: string;
    planned_quantity: number;
    consumed_quantity: number;
    outcome: 'planned' | 'consumed' | 'partial';
    notes: string | null;
    created_at: string;
}
export interface ProductionJobOutput {
    id: string;
    production_job_id: string;
    item_id: string;
    unit_code: string;
    output_type: 'storage' | 'machine' | 'none';
    storage_assignment_id: string | null;
    machine_assignment_id: string | null;
    quantity: number;
    outcome: ProductionOutputOutcome;
    created_by: string;
    created_at: string;
    notes: string | null;
}
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
export interface ZoneWithStats extends Zone {
    rack_count: number;
    slot_count: number;
    total_capacity: number;
    items_stored: number;
    slots_in_use: number;
}
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
    production_history: ProductionHistoryEntry[];
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
    jobs: ProductionJobSummary[];
    activity: MachineActivity[];
    stats: MachineStats;
}
export interface ProductionJobSummary extends ProductionJob {
    machine_code: string;
    machine_name: string;
    input_count: number;
    output_count: number;
}
export interface ProductionJobInputDetail extends ProductionJobInput {
    item_code: string;
    item_name: string;
    customer_name: string | null;
    available_quantity: number;
}
export interface ProductionJobOutputDetail extends ProductionJobOutput {
    item_code: string;
    item_name: string;
    customer_name: string | null;
}
export interface ProductionJobDetail extends ProductionJobSummary {
    inputs: ProductionJobInputDetail[];
    outputs: ProductionJobOutputDetail[];
}
export interface ProductionHistoryEntry {
    job_id: string;
    job_code: string;
    machine_id: string;
    machine_code: string;
    machine_name: string;
    role: 'input' | 'output';
    unit_code: string;
    quantity: number;
    outcome: string;
    completed_at: string | null;
    created_at: string;
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
    total_capacity: number;
    items_stored: number;
    slots_in_use: number;
    occupancy_percent: number;
    racks: RackWithStats[];
}
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
export interface CreateProductionJobRequest {
    machine_id: string;
    input_assignment_ids: string[];
    assigned_by: string;
    notes?: string;
}
export interface CompleteProductionJobRequest {
    completed_by: string;
    notes?: string;
    inputs: Array<{
        machine_assignment_id: string;
        consumed_quantity: number;
    }>;
    outputs: Array<{
        item_id: string;
        quantity: number;
        outcome: ProductionOutputOutcome;
        destination_type: 'storage' | 'machine' | 'none';
        shelf_slot_id?: string;
        machine_id?: string;
        notes?: string;
    }>;
}
export interface AssistantRequest {
    message: string;
    history: {
        role: 'user' | 'assistant';
        content: string;
    }[];
}
export interface AssistantResponse {
    message: string;
    sql?: string;
    data?: Record<string, unknown>[];
    rowCount?: number;
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
