import type { RackWithShelves, ZoneWithStats } from '@shared/types';
import { api, type ZoneDetail } from '@/lib/api';
import type { MapRack, MapShelf, MapZone, WarehouseMapData } from './types';

function mapShelfItems(
  items: NonNullable<ZoneDetail['racks'][number]['shelves'][number]['items']> | RackWithShelves['shelves'][number]['items'],
) {
  return items.map((item) => {
    if ('item_code' in item) {
      return {
        id: item.assignment_id,
        item_id: item.item_id,
        item_code: item.item_code,
        name: item.item_name,
        customer_name: item.customer_name,
        quantity: item.quantity,
        item_href: `/items/${item.item_id}`,
        checkout_href: `/check-out/${item.item_id}`,
      };
    }

    return {
      id: item.id,
      item_id: item.item.id,
      item_code: item.item.item_code,
      name: item.item.name,
      customer_name: null,
      quantity: item.quantity,
      item_href: `/items/${item.item.id}`,
      checkout_href: `/check-out/${item.item.id}`,
    };
  });
}

function mapRackFromZoneDetail(zone: Pick<ZoneDetail, 'id' | 'code' | 'name'>, rack: ZoneDetail['racks'][number]): MapRack {
  const shelves: MapShelf[] = rack.shelves.map((shelf) => ({
    id: shelf.id,
    shelf_number: shelf.shelf_number,
    capacity: shelf.capacity,
    current_count: shelf.current_count,
    items: mapShelfItems(shelf.items ?? []),
    checkin_href: `/check-in?zone=${encodeURIComponent(zone.id)}&shelf=${encodeURIComponent(shelf.id)}`,
  }));

  return {
    id: rack.id,
    code: rack.code,
    label: rack.label,
    zone_id: zone.id,
    zone_code: zone.code,
    zone_name: zone.name,
    total_shelves: rack.total_shelves,
    occupancy_used: shelves.reduce((sum, shelf) => sum + shelf.current_count, 0),
    occupancy_total: shelves.reduce((sum, shelf) => sum + shelf.capacity, 0),
    shelves,
  };
}

function mapRackFromRackDetail(rack: RackWithShelves): MapRack {
  const shelves: MapShelf[] = rack.shelves.map((shelf) => ({
    id: shelf.id,
    shelf_number: shelf.shelf_number,
    capacity: shelf.capacity,
    current_count: shelf.current_count,
    items: mapShelfItems(shelf.items),
    checkin_href: `/check-in?rack=${encodeURIComponent(rack.id)}&shelf=${encodeURIComponent(shelf.id)}`,
  }));

  return {
    id: rack.id,
    code: rack.code,
    label: rack.label,
    zone_id: rack.zone_id,
    zone_code: rack.zone_code,
    zone_name: rack.zone_name,
    total_shelves: rack.total_shelves,
    occupancy_used: shelves.reduce((sum, shelf) => sum + shelf.current_count, 0),
    occupancy_total: shelves.reduce((sum, shelf) => sum + shelf.capacity, 0),
    shelves,
  };
}

function mapZoneSummary(zone: ZoneWithStats): MapZone {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    description: zone.description,
    color: zone.color,
    position_x: zone.position_x,
    position_y: zone.position_y,
    width: zone.width,
    height: zone.height,
    rack_count: zone.rack_count,
    total_slots: zone.slot_count,
    occupied_slots: zone.slots_in_use,
    total_items: zone.items_stored,
    racks: [],
  };
}

function mapZoneDetail(zone: ZoneDetail): MapZone {
  return {
    id: zone.id,
    code: zone.code,
    name: zone.name,
    description: zone.description,
    color: zone.color,
    position_x: zone.position_x,
    position_y: zone.position_y,
    width: zone.width,
    height: zone.height,
    rack_count: zone.rack_count,
    total_slots: zone.slot_count,
    occupied_slots: zone.slots_in_use,
    total_items: zone.items_stored,
    racks: zone.racks.map((rack) => mapRackFromZoneDetail(zone, rack)),
  };
}

function buildStats(zones: MapZone[]): WarehouseMapData['stats'] {
  const totalSlots = zones.reduce((sum, zone) => sum + zone.total_slots, 0);
  const occupiedSlots = zones.reduce((sum, zone) => sum + zone.occupied_slots, 0);
  const totalItemsStored = zones.reduce((sum, zone) => sum + zone.total_items, 0);

  return {
    total_items_stored: totalItemsStored,
    total_slots: totalSlots,
    occupied_slots: occupiedSlots,
    available_slots: totalSlots - occupiedSlots,
  };
}

export async function getWarehouseMapData(): Promise<WarehouseMapData> {
  const zonesResponse = await api.getZones();
  const zoneDetails = await Promise.all(
    zonesResponse.data.map(async (zone) => {
      try {
        const detailResponse = await api.getZone(zone.id);
        return mapZoneDetail(detailResponse.data);
      } catch {
        return mapZoneSummary(zone);
      }
    }),
  );

  return {
    zones: zoneDetails,
    stats: buildStats(zoneDetails),
  };
}

export async function getZoneMapData(zoneId: string): Promise<MapZone> {
  const response = await api.getZone(zoneId);
  return mapZoneDetail(response.data);
}

export async function getRackMapData(rackId: string): Promise<MapRack> {
  const response = await api.getRack(rackId);
  return mapRackFromRackDetail(response.data);
}
