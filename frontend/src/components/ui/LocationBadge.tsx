import { locationLabel } from '@/lib/utils';

type LocationBadgeProps = {
  location?: {
    zone_name?: string | null;
    zone_code?: string | null;
    rack_code?: string | null;
    shelf_number?: number | null;
  } | null;
};

export function LocationBadge({ location }: LocationBadgeProps) {
  return <span className="inline-flex border border-app-border bg-app-panelMuted px-1.5 py-0.5 font-mono text-xs text-app-text">{locationLabel(location)}</span>;
}
