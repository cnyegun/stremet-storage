import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const statsRouter = Router();

import { WeightVerificationService } from '../services/weightVerificationService';

// GET /api/stats/weight-verification — report weight sensor discrepancies
statsRouter.get('/weight-verification', asyncHandler(async (_req, res) => {
  const report = await WeightVerificationService.getDiscrepancyReport();
  res.json({ data: report });
}));

// GET /api/stats — rack-first warehouse occupancy stats
statsRouter.get('/', asyncHandler(async (_req, res) => {
  const racksResult = await pool.query(`
    SELECT
      r.*,
      COUNT(DISTINCT ss.id)::int AS cell_count,
      COALESCE(SUM(ss.capacity), 0)::int AS total_capacity,
      COALESCE(SUM(ss.current_count), 0)::int AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS cells_in_use
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY r.id
    ORDER BY r.display_order, r.code
  `);

  let totalRacks = 0;
  let totalSlots = 0;
  let totalCapacity = 0;
  let totalItemsStored = 0;
  let totalSlotsInUse = 0;

  for (const rack of racksResult.rows) {
    totalRacks++;
    totalSlots += rack.cell_count as number;
    totalCapacity += rack.total_capacity as number;
    totalItemsStored += rack.items_stored as number;
    totalSlotsInUse += rack.cells_in_use as number;
  }

  res.json({
    data: {
      total_racks: totalRacks,
      total_slots: totalSlots,
      total_capacity: totalCapacity,
      items_stored: totalItemsStored,
      slots_in_use: totalSlotsInUse,
      occupancy_percent: totalCapacity > 0 ? Math.round((totalItemsStored / totalCapacity) * 100) : 0,
      racks: racksResult.rows,
    },
  });
}));
