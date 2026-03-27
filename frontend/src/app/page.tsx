'use client';

import { useEffect, useState } from 'react';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getWarehouseMapData } from '../components/map/api';
import { FloorPlan } from '../components/map/FloorPlan';
import { GridView } from '../components/map/GridView';
import { MapSearch } from '../components/map/MapSearch';
import { MapStats } from '../components/map/MapStats';
import { MapToggle } from '../components/map/MapToggle';
import type { WarehouseMapData } from '../components/map/types';

export default function HomePage() {
  const [view, setView] = useState<'floor' | 'grid'>('floor');
  const [searchQuery, setSearchQuery] = useState('');
  const [data, setData] = useState<WarehouseMapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    void getWarehouseMapData()
      .then((result) => {
        if (active) {
          setData(result);
        }
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  if (!data) {
    if (error) {
      return <EmptyState title="Unable to load warehouse map" description={error} />;
    }

    return (
      <div className="flex items-center gap-2 border border-app-border bg-white p-4">
        <LoadingSpinner />
        <span className="text-xs text-app-textMuted">Loading warehouse data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-app-border bg-app-toolbar px-3 py-2">
        <h1 className="text-sm font-semibold text-app-text">Warehouse map</h1>
        <MapStats stats={data.stats} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <MapSearch value={searchQuery} onChange={setSearchQuery} />
        <MapToggle value={view} onChange={setView} />
      </div>
      {view === 'floor' ? <FloorPlan zones={data.zones} searchQuery={searchQuery} /> : <GridView zones={data.zones} searchQuery={searchQuery} />}
    </div>
  );
}
