'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getZoneMapData } from '../../../components/map/api';
import { OccupancyBar } from '../../../components/map/OccupancyBar';
import { RackBox } from '../../../components/map/RackBox';
import { ShelfRow } from '../../../components/map/ShelfRow';
import type { MapRack, MapZone } from '../../../components/map/types';

export default function ZoneDetailPage() {
  const params = useParams<{ id: string }>();
  const [zone, setZone] = useState<MapZone | null>(null);
  const [selectedRack, setSelectedRack] = useState<MapRack | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) {
      return;
    }

    let active = true;
    setLoaded(false);
    setError(null);

    void getZoneMapData(params.id)
      .then((result) => {
        if (!active) {
          return;
        }

        setZone(result);
        setSelectedRack(result.racks[0] ?? null);
        setLoaded(true);
      })
      .catch((err: Error) => {
        if (active) {
          setError(err.message);
          setZone(null);
          setLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  if (!loaded) {
    return (
      <div className="flex items-center gap-3 border border-app-border bg-white p-6">
        <LoadingSpinner />
        <span className="text-sm text-app-textMuted">Loading zone</span>
      </div>
    );
  }

  if (!zone) {
    return <EmptyState title="Unable to load zone" description={error || 'Zone not found.'} />;
  }

  return (
    <div className="space-y-6 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold text-app-text">{zone.name}</h1>
          <p className="max-w-3xl text-sm text-app-textMuted">{zone.description}</p>
        </div>
        <Link href={`/check-in?zone=${encodeURIComponent(zone.id)}`} className="inline-flex min-h-11 items-center justify-center border border-app-primary bg-app-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
          Check in to this zone
        </Link>
      </div>

      <section className="grid gap-3 border border-app-border bg-white p-5">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-app-text">
          <span>{zone.rack_count} racks</span>
          <span>{zone.total_items} items stored</span>
          <span>{zone.occupied_slots}/{zone.total_slots} slots occupied</span>
        </div>
        <OccupancyBar used={zone.occupied_slots} total={zone.total_slots} />
      </section>

      <section className="grid gap-4 border border-app-border bg-white p-5">
        <div className="space-y-2">
          <strong className="text-app-text">Rack layout</strong>
          <p className="text-sm text-app-textMuted">Select a rack to inspect its shelves and active items.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {zone.racks.map((rack) => (
            <RackBox key={rack.id} rack={rack} onSelect={setSelectedRack} />
          ))}
        </div>
      </section>

      {selectedRack ? (
        <section className="grid gap-3 border border-app-border bg-white p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <strong className="text-app-text">{selectedRack.code}</strong>
            <Link href={`/check-in?rack=${encodeURIComponent(selectedRack.id)}`} className="text-sm text-app-primary hover:underline">
              Check in to this rack
            </Link>
          </div>
          <div className="grid gap-3">
            {[...selectedRack.shelves].sort((a, b) => b.shelf_number - a.shelf_number).map((shelf) => (
              <ShelfRow key={shelf.id} shelf={shelf} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
