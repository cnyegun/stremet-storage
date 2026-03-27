import { clsx, type ClassValue } from 'clsx';

type LocationInput = {
  zone_name?: string | null;
  zone_code?: string | null;
  rack_code?: string | null;
  shelf_number?: number | null;
};

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDateTime(value?: string | null) {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatNumber(value?: number | null, suffix = '') {
  if (value === undefined || value === null || Number.isNaN(value)) {
    return '-';
  }

  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

export function locationLabel(location?: LocationInput | null) {
  if (!location?.rack_code || !location?.shelf_number) {
    return 'Not in storage';
  }

  const zone = location.zone_name || (location.zone_code ? `Zone ${location.zone_code}` : 'Unknown zone');
  return `${zone} > ${location.rack_code} > Shelf ${location.shelf_number}`;
}

export function buildQueryString(params: object) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    query.set(key, String(value));
  }

  return query.toString();
}

export function toTitleCase(value: string) {
  return value.replace(/_/g, ' ');
}
