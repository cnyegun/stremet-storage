import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { MapShelf } from './types';
import { OccupancyBar } from './OccupancyBar';
import { shelfHasSearchMatch } from './utils';

interface ShelfRowProps {
  shelf: MapShelf;
  searchQuery?: string;
}

export function ShelfRow({ shelf, searchQuery = '' }: ShelfRowProps) {
  const highlight = shelfHasSearchMatch(shelf, searchQuery);
  const hasSpace = shelf.current_count < shelf.capacity;

  return (
    <div className={cn('grid gap-3 border p-3', highlight ? 'border-app-primary bg-blue-50' : 'border-app-border bg-white')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <strong className="text-sm text-app-text">Shelf {shelf.shelf_number}</strong>
        {hasSpace ? (
          <Link
            href={shelf.checkin_href}
            className="inline-flex min-h-9 items-center justify-center border border-app-border bg-white px-3 py-1 text-xs font-medium text-app-text hover:bg-app-panelMuted"
          >
            Check in here
          </Link>
        ) : (
          <span className="text-xs font-medium text-app-danger">FULL</span>
        )}
      </div>
      <div className="grid gap-1">
        <OccupancyBar used={shelf.current_count} total={shelf.capacity} compact />
        <span className="text-xs text-app-textMuted">Capacity {shelf.current_count}/{shelf.capacity}</span>
      </div>
      {shelf.items.length === 0 ? (
        <span className="text-sm text-app-textMuted">No active items on this shelf.</span>
      ) : (
        <div className="grid gap-2">
          {shelf.items.map((item) => (
            <div key={item.id} className="grid gap-1 border-t border-app-border pt-2 text-sm text-app-text">
              <div className="flex flex-wrap justify-between gap-3">
                <Link href={item.item_href} className="font-medium hover:text-app-primary">
                  {item.item_code}
                </Link>
                <span>{item.quantity} units</span>
              </div>
              <span>{item.name}</span>
              <div className="flex flex-wrap justify-between gap-3 text-sm text-app-textMuted">
                <span>{item.customer_name ?? 'General stock'}</span>
                <Link href={item.checkout_href} className="text-app-primary hover:underline">
                  Check out
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
