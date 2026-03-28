import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const statsRouter = Router();

// GET /api/stats — comprehensive warehouse stats
statsRouter.get('/', asyncHandler(async (_req, res) => {
  const racksResult = await pool.query(`
    SELECT
      r.*,
      COUNT(DISTINCT ss.id)::int AS cell_count,
      COALESCE(SUM(ss.max_volume_m3), 0)::float AS total_capacity,
      COALESCE(SUM(ss.current_volume_m3), 0)::float AS volume_stored,
      COALESCE(SUM(ss.current_count), 0)::int AS total_items,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS cells_in_use
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY r.id
    ORDER BY r.display_order ASC
  `);

  let totalCapacity = 0;
  let totalVolumeStored = 0;
  let totalItemsStored = 0;
  let totalCells = 0;
  let totalCellsInUse = 0;

  for (const rack of racksResult.rows) {
    totalCapacity += Number(rack.total_capacity);
    totalVolumeStored += Number(rack.volume_stored);
    totalItemsStored += Number(rack.total_items);
    totalCells += Number(rack.cell_count);
    totalCellsInUse += Number(rack.cells_in_use);
  }

  res.json({
    data: {
      total_racks: racksResult.rows.length,
      total_slots: totalCells,
      total_capacity: totalCapacity,
      total_volume_stored: totalVolumeStored,
      total_items_stored: totalItemsStored,
      slots_in_use: totalCellsInUse,
      occupancy_percent: totalCapacity > 0 ? Math.round((totalVolumeStored / totalCapacity) * 100) : 0,
      racks: racksResult.rows,
    },
  });
}));
