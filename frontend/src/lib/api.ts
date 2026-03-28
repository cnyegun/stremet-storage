import type {
  ActivityFilters,
  ActivityLogWithItem,
  ApiListResponse,
  ApiResponse,
  CheckInRequest,
  CheckOutRequest,
  CreateItemRequest,
  Customer,
  DuplicateWarning,
  GlobalSearchResponse,
  ItemDetail,
  ItemFilters,
  ItemWithLocation,
  MachineDetail,
  LocationSuggestion,
  MachineWithItemCount,
  MoveRequest,
  RackWithStats,
  RackWithShelves,
  UpdateItemRequest,
  WarehouseStats,
} from '@shared/types';
import { buildQueryString } from '@/lib/utils';

type CheckInResult = { assignment_id: string; unit_code: string; quantity: number; location: string };
type CheckOutResult = { assignment_id: string; location: string; item_code: string; unit_code: string };
type MoveResult = {
  assignment_id: string;
  unit_code: string;
  source_unit_code: string;
  from: string;
  to: string;
  quantity_moved: number;
  quantity_remaining: number;
};
type MachineStatusUpdateResult = { assignment_id: string; unit_code: string; status: string };
type QrScanResult = {
  qr_code: string;
  scan_url: string;
  qr_type: string;
  status: string;
  item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  customer_name: string | null;
  active_unit_code: string | null;
  quantity: number;
  location_code: string | null;
  location_type: string;
  order_number: string | null;
  manufacturing_date: string | null;
  recommended_rack_id: string | null;
  recommended_shelf_slot_id: string | null;
  recommended_location_code: string | null;
  order_progress: {
    requested_quantity: number;
    fulfilled_quantity: number;
    status: string;
  } | null;
};
type ProductQrIntakeResult = {
  qr_code: string;
  scan_url: string;
  unit_code: string;
  assignment_id: string;
  location_code: string;
  rerouted: boolean;
  rack_code: string;
  rack_label: string;
  row_number: number;
  column_number: number;
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    cache: 'no-store',
  });

  const payload = (await response.json()) as T & { error?: string; details?: string };

  if (!response.ok) {
    throw new Error(payload.details || payload.error || 'Request failed');
  }

  return payload;
}

export const api = {
  getItems: (filters: ItemFilters = {}) =>
    request<ApiListResponse<ItemWithLocation>>(`/items?${buildQueryString(filters)}`),

  getItem: (id: string) => request<ApiResponse<ItemDetail>>(`/items/${id}`),

  createItem: (body: CreateItemRequest) =>
    request<ApiResponse<{ id: string } & CreateItemRequest>>('/items', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateItem: (id: string, body: UpdateItemRequest) =>
    request<ApiResponse<ItemDetail>>(`/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  getDuplicateWarnings: () => request<ApiResponse<DuplicateWarning[]>>('/items/duplicates'),

  getDuplicateWarningByItemCode: (itemCode: string) =>
    request<ApiResponse<DuplicateWarning | null>>(`/items/duplicate-check?item_code=${encodeURIComponent(itemCode)}`),

  getSuggestedLocations: (id: string) =>
    request<ApiResponse<LocationSuggestion[]>>(`/items/${id}/suggest-location`),

  checkInItem: (body: CheckInRequest) =>
    request<ApiResponse<CheckInResult>>('/items/check-in', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  checkOutItem: (body: CheckOutRequest) =>
    request<ApiResponse<CheckOutResult>>('/items/check-out', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  moveItem: (body: MoveRequest) =>
    request<ApiResponse<MoveResult>>('/items/move', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getActivity: (filters: ActivityFilters = {}) =>
    request<ApiListResponse<ActivityLogWithItem>>(`/activity?${buildQueryString(filters)}`),

  getRacks: () => request<ApiResponse<RackWithStats[]>>('/racks'),

  getRack: (id: string) => request<ApiResponse<RackWithShelves>>(`/racks/${id}`),

  getCustomers: () => request<ApiResponse<Customer[]>>('/customers'),

  getMachines: () => request<ApiResponse<MachineWithItemCount[]>>('/machines'),

  getMachine: (id: string) => request<ApiResponse<MachineDetail>>(`/machines/${id}`),

  updateMachineAssignmentStatus: (machineId: string, assignmentId: string, body: { status: string; performed_by: string; notes?: string }) =>
    request<ApiResponse<MachineStatusUpdateResult>>(`/machines/${machineId}/assignments/${assignmentId}/status`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getStats: () => request<ApiResponse<WarehouseStats>>('/stats'),

  globalSearch: (query: string) => request<ApiResponse<GlobalSearchResponse>>(`/search?q=${encodeURIComponent(query)}`),

  getQrScanResult: (qrCode: string) => request<ApiResponse<QrScanResult>>(`/qr/${encodeURIComponent(qrCode)}`),

  intakeProductQr: (body: {
    qr_code: string;
    performed_by: string;
    notes?: string;
    preferred_rack_id?: string;
    preferred_shelf_slot_id?: string;
  }) =>
    request<ApiResponse<ProductQrIntakeResult>>('/qr/product-intake', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
