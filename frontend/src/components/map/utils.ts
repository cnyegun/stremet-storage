import type { MapRack, MapShelf, MapZone } from './types';

export function getOccupancyRatio(used: number, total: number) {
  if (!total) {
    return 0;
  }

  return used / total;
}

export function getOccupancyState(used: number, total: number) {
  const ratio = getOccupancyRatio(used, total);

  if (ratio > 0.8) {
    return 'danger';
  }

  if (ratio >= 0.5) {
    return 'warning';
  }

  return 'success';
}

export function getOccupancyPalette(used: number, total: number) {
  const state = getOccupancyState(used, total);

  if (state === 'danger') {
    return {
      border: '#DC2626',
      fill: '#FEE2E2',
      accent: '#B91C1C',
    };
  }

  if (state === 'warning') {
    return {
      border: '#D97706',
      fill: '#FEF3C7',
      accent: '#B45309',
    };
  }

  return {
    border: '#16A34A',
    fill: '#DCFCE7',
    accent: '#166534',
  };
}

export function rackHasSearchMatch(rack: MapRack, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return rack.shelves.some((shelf) => shelfHasSearchMatch(shelf, normalized));
}

export function shelfHasSearchMatch(shelf: MapShelf, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  return shelf.items.some(
    (item) =>
      item.item_code.toLowerCase().includes(normalized) ||
      item.name.toLowerCase().includes(normalized) ||
      (item.customer_name ?? '').toLowerCase().includes(normalized),
  );
}

export function zoneHasSearchMatch(zone: MapZone, query: string) {
  return zone.racks.some((rack) => rackHasSearchMatch(rack, query));
}

export function getZoneOccupancyPercent(zone: MapZone) {
  return Math.round(getOccupancyRatio(zone.occupied_slots, zone.total_slots) * 100);
}
