import type { MapStatsData } from './types';

interface MapStatsProps {
  stats: MapStatsData;
}

export function MapStats({ stats }: MapStatsProps) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2 border border-app-border bg-white px-4 py-3 text-sm text-app-text">
      <span>{stats.total_items_stored} items stored</span>
      <span>{stats.occupied_slots}/{stats.total_slots} slots occupied</span>
      <span>{stats.available_slots} slots available</span>
    </div>
  );
}
