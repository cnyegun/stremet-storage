import { clsx, type ClassValue } from 'clsx';

type LocationInput = {
  rack_id?: string | null;
  rack_code?: string | null;
  rack_label?: string | null;
  row_number?: number | null;
  column_number?: number | null;
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
  if (!location?.rack_code || !location?.row_number || !location?.column_number) {
    return 'Not in storage';
  }

  return `${location.rack_code}/R${location.row_number}C${location.column_number}`;
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

export function machineLabel(code: string, name?: string) {
  return name ? `${code} — ${name}` : code;
}

export function machineCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    sheet_metal: 'Sheet metal',
    cutting: 'Cutting',
    laser: 'Laser',
    robot_bending: 'Robot bending',
    bending: 'Bending',
  };
  return labels[category] || category;
}

export function machineAssignmentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    queued: 'Queued',
    processing: 'Processing',
    needs_attention: 'Needs attention',
    ready_for_storage: 'Ready for storage',
  };
  return labels[status] || toTitleCase(status);
}

export function toTitleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function actionLabel(action: string) {
  const labels: Record<string, string> = {
    check_in: 'Check in',
    check_out: 'Check out',
    move: 'Move',
    note_added: 'Note added',
  };
  return labels[action] || toTitleCase(action);
}
