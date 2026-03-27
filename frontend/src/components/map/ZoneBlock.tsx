'use client';

import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { MapRack, MapZone } from './types';
import { OccupancyBar } from './OccupancyBar';
import { RackBox } from './RackBox';
import { getOccupancyPalette, getZoneOccupancyPercent, zoneHasSearchMatch } from './utils';

interface ZoneBlockProps {
  zone: MapZone;
  expanded: boolean;
  searchQuery?: string;
  onToggle: (zoneId: string) => void;
  onRackSelect: (rack: MapRack) => void;
}

export function ZoneBlock({ zone, expanded, searchQuery = '', onToggle, onRackSelect }: ZoneBlockProps) {
  const palette = getOccupancyPalette(zone.occupied_slots, zone.total_slots);
  const highlight = zoneHasSearchMatch(zone, searchQuery);

  return (
    <div
      title={`${zone.name} | ${zone.rack_count} racks | ${zone.total_items} items | ${getZoneOccupancyPercent(zone)}% occupied`}
      style={{
        position: 'absolute',
        left: `${zone.position_x}%`,
        top: `${zone.position_y}%`,
        width: `${zone.width}%`,
        height: `${zone.height}%`,
        borderColor: highlight ? '#2563EB' : palette.border,
        background: highlight ? '#DBEAFE' : palette.fill,
      }}
      className="grid content-start gap-2 border-2 p-3 shadow-sm"
    >
      <button
        type="button"
        onClick={() => onToggle(zone.id)}
        className="grid gap-2 text-left text-app-text"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="grid gap-0.5">
            <strong className="text-sm">{zone.name}</strong>
            <span className="text-xs text-app-textMuted">{zone.code}</span>
          </div>
          <span className="text-xs font-medium" style={{ color: palette.accent }}>{zone.occupied_slots}/{zone.total_slots} slots used</span>
        </div>
        <OccupancyBar used={zone.occupied_slots} total={zone.total_slots} compact />
      </button>
      <div className="flex flex-wrap justify-between gap-3 text-xs text-app-textMuted">
        <span>{zone.rack_count} racks</span>
        <span>{zone.total_items} items</span>
        <Link href={`/zones/${zone.id}`} className="text-app-primary hover:underline">
          Open zone
        </Link>
      </div>
      {expanded ? (
        <div className={cn('grid gap-2', zone.racks.length > 2 ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1')}>
          {zone.racks.map((rack) => (
            <RackBox key={rack.id} rack={rack} searchQuery={searchQuery} onSelect={onRackSelect} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
