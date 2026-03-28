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

// GET /api/stats — comprehensive warehouse occupancy stats
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
    ORDER BY r.display_order ASC
  `);

  let totalCapacity = 0;
  let totalItemsStored = 0;
  let totalCells = 0;
  let totalCellsInUse = 0;

  for (const rack of racksResult.rows) {
    totalCapacity += Number(rack.total_capacity);
    totalItemsStored += Number(rack.items_stored);
    totalCells += Number(rack.cell_count);
    totalCellsInUse += Number(rack.cells_in_use);
  }

  res.json({
    data: {
      total_racks: racksResult.rows.length,
      total_slots: totalCells,
      total_capacity: totalCapacity,
      items_stored: totalItemsStored,
      slots_in_use: totalCellsInUse,
      occupancy_percent: totalCapacity > 0 ? Math.round((totalItemsStored / totalCapacity) * 100) : 0,
      racks: racksResult.rows,
    },
  });
}));
