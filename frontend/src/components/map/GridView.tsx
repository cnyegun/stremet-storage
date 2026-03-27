'use client';

import { useState } from 'react';
import Link from 'next/link';

import { EmptyState } from '@/components/ui/EmptyState';
import { cn } from '@/lib/utils';
import type { MapShelf, MapZone } from './types';
import { OccupancyBar } from './OccupancyBar';
import { getOccupancyPalette, shelfHasSearchMatch } from './utils';

interface GridViewProps {
  zones: MapZone[];
  searchQuery?: string;
}

export function GridView({ zones, searchQuery = '' }: GridViewProps) {
  const [expandedZoneIds, setExpandedZoneIds] = useState<string[]>(zones.map((zone) => zone.id));
  const [expandedShelfId, setExpandedShelfId] = useState<string | null>(null);

  function toggleZone(zoneId: string) {
    setExpandedZoneIds((current) => (current.includes(zoneId) ? current.filter((id) => id !== zoneId) : [...current, zoneId]));
  }

  function renderShelfCell(shelf: MapShelf) {
    const palette = getOccupancyPalette(shelf.current_count, shelf.capacity);
    const highlight = shelfHasSearchMatch(shelf, searchQuery);
    const expanded = expandedShelfId === shelf.id;

    return (
      <td key={shelf.id} className={cn('align-top border border-app-border p-2', highlight ? 'bg-blue-50' : 'bg-white')}>
        <button
          type="button"
          onClick={() => setExpandedShelfId((current) => (current === shelf.id ? null : shelf.id))}
          className="grid w-full gap-1 border p-2 text-left"
          style={{ borderColor: palette.border, background: palette.fill }}
        >
          <strong className="text-sm text-app-text">{shelf.current_count === 0 ? 'Empty' : `${shelf.current_count} items`}</strong>
          <span className="text-xs text-app-textMuted">Capacity {shelf.current_count}/{shelf.capacity}</span>
        </button>
        {expanded ? (
          <div className="mt-2 grid gap-2">
            {shelf.items.length === 0 ? (
              <span className="text-xs text-app-textMuted">No active items.</span>
            ) : (
              shelf.items.map((item) => (
                <div key={item.id} className="grid gap-0.5 border-t border-app-border pt-2">
                  <Link href={item.item_href} className="text-sm font-medium text-app-text hover:text-app-primary">
                    {item.item_code}
                  </Link>
                  <span className="text-xs text-app-text">{item.name}</span>
                  <span className="text-xs text-app-textMuted">{item.customer_name ?? 'General stock'}</span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </td>
    );
  }

  if (zones.length === 0) {
    return <EmptyState title="No zones available" description="Warehouse zones are not available yet." />;
  }

  return (
    <div className="grid gap-4">
      {zones.map((zone) => {
        const expanded = expandedZoneIds.includes(zone.id);
        return (
          <section key={zone.id} className="border border-app-border bg-white">
            <button
              type="button"
              onClick={() => toggleZone(zone.id)}
              className="grid w-full gap-2 border-b border-app-border bg-app-background p-4 text-left"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <strong className="text-app-text">{zone.name}</strong>
                <span className="text-sm text-app-textMuted">{zone.code}</span>
              </div>
              <OccupancyBar used={zone.occupied_slots} total={zone.total_slots} compact />
            </button>
            {expanded ? (
              <div className="overflow-x-auto">
                <table className="min-w-[760px] w-full border-collapse text-sm">
                  <thead className="bg-white text-xs text-app-textMuted">
                    <tr>
                      <th className="border border-app-border px-3 py-2 text-left">Rack</th>
                      <th className="border border-app-border px-3 py-2 text-left">Shelf 1</th>
                      <th className="border border-app-border px-3 py-2 text-left">Shelf 2</th>
                      <th className="border border-app-border px-3 py-2 text-left">Shelf 3</th>
                      <th className="border border-app-border px-3 py-2 text-left">Shelf 4</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zone.racks.map((rack) => (
                      <tr key={rack.id}>
                        <td className="min-w-[120px] border border-app-border px-3 py-2 font-medium text-app-text">{rack.code}</td>
                        {rack.shelves.sort((a, b) => a.shelf_number - b.shelf_number).map(renderShelfCell)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
