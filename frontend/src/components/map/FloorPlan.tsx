'use client';

import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import type { MapRack, MapZone } from './types';
import { RackDetailPanel } from './RackDetailPanel';
import { ZoneBlock } from './ZoneBlock';

interface FloorPlanProps {
  zones: MapZone[];
  searchQuery?: string;
}

export function FloorPlan({ zones, searchQuery = '' }: FloorPlanProps) {
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(zones[0]?.id ?? null);
  const [selectedRack, setSelectedRack] = useState<MapRack | null>(null);

  const activeZoneId = useMemo(() => {
    if (!searchQuery.trim()) {
      return expandedZoneId;
    }

    return zones.find((zone) => zone.racks.some((rack) => rack.shelves.some((shelf) => shelf.items.some((item) => {
      const query = searchQuery.toLowerCase();
      return item.item_code.toLowerCase().includes(query) || item.name.toLowerCase().includes(query) || (item.customer_name ?? '').toLowerCase().includes(query);
    }))))?.id ?? expandedZoneId;
  }, [expandedZoneId, searchQuery, zones]);

  if (zones.length === 0) {
    return <EmptyState title="No zones available" description="Warehouse zones are not available yet." />;
  }

  return (
    <div className="grid border border-app-border bg-white lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="p-4">
        <div className="mb-3 text-sm text-app-textMuted">Factory floor</div>
        <div className="relative w-full overflow-auto border border-app-border bg-app-background" style={{ aspectRatio: '16 / 9' }}>
          {zones.map((zone) => (
            <ZoneBlock
              key={zone.id}
              zone={zone}
              expanded={activeZoneId === zone.id}
              searchQuery={searchQuery}
              onToggle={(zoneId) => setExpandedZoneId((current) => (current === zoneId ? null : zoneId))}
              onRackSelect={setSelectedRack}
            />
          ))}
          <div className="absolute bottom-[4%] left-[4%] text-xs text-app-textMuted">[Loading dock]</div>
          <div className="absolute bottom-[4%] right-[4%] text-xs text-app-textMuted">[Entrance]</div>
        </div>
      </div>
      <div className="min-w-0">
        <RackDetailPanel rack={selectedRack} searchQuery={searchQuery} onClose={() => setSelectedRack(null)} />
      </div>
    </div>
  );
}
