'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { cn } from '@/lib/utils';
import { getRackMapData } from './api';
import type { MapRack } from './types';
import { ShelfRow } from './ShelfRow';

interface RackDetailPanelProps {
  rack: MapRack | null;
  searchQuery?: string;
  onClose: () => void;
}

export function RackDetailPanel({ rack, searchQuery = '', onClose }: RackDetailPanelProps) {
  const [rackDetail, setRackDetail] = useState<MapRack | null>(rack);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!rack) {
      setRackDetail(null);
      return;
    }

    let active = true;
    setRackDetail(rack);
    setLoading(true);

    void getRackMapData(rack.id)
      .then((nextRack) => {
        if (active) {
          setRackDetail(nextRack);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [rack]);

  if (!rack) {
    return null;
  }

  return (
    <aside className={cn('grid h-full content-start gap-4 border-t border-app-border bg-white p-4 lg:border-l lg:border-t-0')}>
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-1">
          <strong className="text-lg text-app-text">{rack.code}</strong>
          <span className="text-sm text-app-textMuted">{rack.zone_name}</span>
        </div>
        <Button variant="secondary" className="min-h-9 px-3 py-1 text-xs" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="flex flex-wrap justify-between gap-3 text-sm text-app-textMuted">
        <span>{rack.shelves.length} shelves</span>
        <Link href={`/check-in?rack=${encodeURIComponent(rack.id)}`} className="text-app-primary hover:underline">
          Check in to this rack
        </Link>
      </div>
      {loading ? (
        <div className="flex items-center gap-3 border border-app-border bg-app-background p-4">
          <LoadingSpinner />
          <span className="text-sm text-app-textMuted">Loading rack details</span>
        </div>
      ) : !rackDetail ? (
        <EmptyState title="Unable to load rack" description="Rack details are not available right now." />
      ) : (
        <div className="grid gap-3">
          {[...rackDetail.shelves].sort((a, b) => b.shelf_number - a.shelf_number).map((shelf) => (
            <ShelfRow key={shelf.id} shelf={shelf} searchQuery={searchQuery} />
          ))}
        </div>
      )}
    </aside>
  );
}
