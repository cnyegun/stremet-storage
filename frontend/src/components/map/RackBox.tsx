'use client';

import { cn } from '@/lib/utils';
import type { MapRack } from './types';
import { OccupancyBar } from './OccupancyBar';
import { rackHasSearchMatch } from './utils';

interface RackBoxProps {
  rack: MapRack;
  searchQuery?: string;
  onSelect?: (rack: MapRack) => void;
}

export function RackBox({ rack, searchQuery = '', onSelect }: RackBoxProps) {
  const highlight = rackHasSearchMatch(rack, searchQuery);

  return (
    <button
      type="button"
      onClick={() => onSelect?.(rack)}
      className={cn(
        'grid min-w-[140px] gap-2 border p-3 text-left transition-colors',
        onSelect ? 'cursor-pointer hover:bg-slate-50' : 'cursor-default',
        highlight ? 'border-app-primary bg-blue-50' : 'border-app-border bg-white',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="text-sm text-app-text">{rack.code}</strong>
        <span className="text-xs text-app-textMuted">{rack.label}</span>
      </div>
      <div className="grid gap-1.5">
        {[...rack.shelves].sort((a, b) => b.shelf_number - a.shelf_number).map((shelf) => (
          <div key={shelf.id} className="flex justify-between gap-2 border border-app-border bg-app-background px-2 py-1 text-xs text-app-text">
            <span>S{shelf.shelf_number}</span>
            <span>{shelf.current_count}/{shelf.capacity}</span>
          </div>
        ))}
      </div>
      <OccupancyBar used={rack.occupancy_used} total={rack.occupancy_total} compact />
    </button>
  );
}
