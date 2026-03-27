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
  ItemDetail,
  ItemFilters,
  ItemWithLocation,
  LocationSuggestion,
  MoveRequest,
  RackWithShelves,
  UpdateItemRequest,
  WarehouseStats,
  ZoneWithStats,
} from '@shared/types';
import { buildQueryString } from '@/lib/utils';

type ZoneDetail = ZoneWithStats & {
  racks: Array<{
    id: string;
    code: string;
    label: string;
    total_shelves: number;
    shelves: Array<{
      id: string;
      shelf_number: number;
      capacity: number;
      current_count: number;
      items?: Array<{
        assignment_id: string;
        item_id: string;
        item_code: string;
        item_name: string;
        customer_name: string | null;
        quantity: number;
        checked_in_at: string;
        checked_in_by: string;
      }>;
    }>;
  }>;
};

type CheckInResult = { assignment_id: string; location: string };
type CheckOutResult = { assignment_id: string; location: string; item_code: string };
type MoveResult = { assignment_id: string; from: string; to: string };

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

  getZones: () => request<ApiResponse<ZoneWithStats[]>>('/zones'),

  getZone: (id: string) => request<ApiResponse<ZoneDetail>>(`/zones/${id}`),

  getRack: (id: string) => request<ApiResponse<RackWithShelves>>(`/racks/${id}`),

  getCustomers: () => request<ApiResponse<Customer[]>>('/customers'),

  getStats: () => request<ApiResponse<WarehouseStats>>('/stats'),

  globalSearch: (query: string) =>
    request<ApiResponse<{ items: ItemWithLocation[]; customers: Customer[]; locations: Array<{ zone_id: string; zone_name: string; zone_code: string; rack_id: string; rack_code: string; items_stored: number }> }>>(`/search?q=${encodeURIComponent(query)}`),
};

export type { ZoneDetail };
