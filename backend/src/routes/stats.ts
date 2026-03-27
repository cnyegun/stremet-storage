import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const statsRouter = Router();

// GET /api/stats — warehouse occupancy stats for map coloring
statsRouter.get('/', asyncHandler(async (_req, res) => {
  // Per-zone stats (also used to compute totals)
  const zonesResult = await pool.query(`
    SELECT
      z.*,
      COUNT(DISTINCT r.id)::int AS rack_count,
      COUNT(DISTINCT ss.id)::int AS slot_count,
      COALESCE(SUM(ss.capacity), 0)::int AS total_capacity,
      COALESCE(SUM(ss.current_count), 0)::int AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS slots_in_use
    FROM zones z
    LEFT JOIN racks r ON r.zone_id = z.id
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY z.id
    ORDER BY z.code
  `);

  // Compute totals from zone data
  let totalZones = 0;
  let totalRacks = 0;
  let totalSlots = 0;
  let totalCapacity = 0;
  let totalItemsStored = 0;
  let totalSlotsInUse = 0;

  for (const zone of zonesResult.rows) {
    totalZones++;
    totalRacks += zone.rack_count as number;
    totalSlots += zone.slot_count as number;
    totalCapacity += zone.total_capacity as number;
    totalItemsStored += zone.items_stored as number;
    totalSlotsInUse += zone.slots_in_use as number;
  }

  res.json({
    data: {
      total_zones: totalZones,
      total_racks: totalRacks,
      total_slots: totalSlots,
      total_capacity: totalCapacity,
      items_stored: totalItemsStored,
      slots_in_use: totalSlotsInUse,
      occupancy_percent: totalCapacity > 0 ? Math.round((totalItemsStored / totalCapacity) * 100) : 0,
      zones: zonesResult.rows,
    },
  });
}));
