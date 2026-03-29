import type {
  ActivityFilters,
  ActivityLogWithItem,
  ApiListResponse,
  ApiResponse,
  AssistantRequest,
  AssistantResponse,
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
  UnitLookupResult,
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

  getTrackingUnit: (unitCode: string) =>
    request<ApiResponse<UnitLookupResult>>(`/tracking/unit/${encodeURIComponent(unitCode)}`),

  getSuggestion: (itemId: string) =>
    request<ApiResponse<LocationSuggestion[]>>(`/items/${encodeURIComponent(itemId)}/suggest-location`),

  sendAssistantMessage: (body: AssistantRequest) =>
    request<ApiResponse<AssistantResponse>>('/assistant', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};
