import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const dashboardRouter = Router();

// GET /api/dashboard — aggregated dashboard data in a single request
dashboardRouter.get('/', asyncHandler(async (_req, res) => {
  const [
    statsResult,
    activityResult,
    customerBreakdownResult,
    machineResult,
    agingResult,
    dailyActivityResult,
    rackOccupancyResult,
    materialBreakdownResult,
  ] = await Promise.all([
    // 1. Warehouse occupancy stats
    pool.query(`
      SELECT
        COUNT(DISTINCT r.id)::int AS total_racks,
        COUNT(DISTINCT ss.id)::int AS total_slots,
        COALESCE(SUM(ss.max_volume_m3), 0)::float AS total_capacity,
        COALESCE(SUM(ss.current_volume_m3), 0)::float AS volume_stored,
        COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS slots_in_use,
        COALESCE(SUM(ss.current_count), 0)::int AS total_items_stored
      FROM racks r
      LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    `),

    // 2. Recent activity (last 15)
    pool.query(`
      SELECT al.*, i.item_code, i.name AS item_name
      FROM activity_log al
      LEFT JOIN items i ON al.item_id = i.id
      ORDER BY al.created_at DESC
      LIMIT 15
    `),

    // 3. Items in storage per customer
    pool.query(`
      SELECT
        COALESCE(c.name, 'General stock') AS customer_name,
        COALESCE(c.code, 'GEN') AS customer_code,
        COUNT(DISTINCT sa.id)::int AS assignment_count,
        COALESCE(SUM(sa.quantity), 0)::int AS total_quantity
      FROM storage_assignments sa
      JOIN items i ON sa.item_id = i.id
      LEFT JOIN customers c ON i.customer_id = c.id
      WHERE sa.checked_out_at IS NULL
      GROUP BY c.id, c.name, c.code
      ORDER BY total_quantity DESC
    `),

    // 4. Machine workload summary
    pool.query(`
      SELECT
        m.id, m.code, m.name, m.category,
        COUNT(ma.id) FILTER (WHERE ma.removed_at IS NULL)::int AS active_items,
        COALESCE(SUM(ma.quantity) FILTER (WHERE ma.removed_at IS NULL), 0)::int AS active_quantity,
        COUNT(ma.id) FILTER (WHERE ma.status = 'needs_attention' AND ma.removed_at IS NULL)::int AS needs_attention
      FROM machines m
      LEFT JOIN machine_assignments ma ON ma.machine_id = m.id
      GROUP BY m.id
      ORDER BY active_items DESC
    `),

    // 5. Aging items (in storage > 14 days)
    pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE sa.checked_in_at < NOW() - INTERVAL '14 days')::int AS over_14_days,
        COUNT(*) FILTER (WHERE sa.checked_in_at < NOW() - INTERVAL '30 days')::int AS over_30_days,
        COUNT(*) FILTER (WHERE sa.checked_in_at < NOW() - INTERVAL '60 days')::int AS over_60_days,
        COUNT(*)::int AS total_active
      FROM storage_assignments sa
      WHERE sa.checked_out_at IS NULL
    `),

    // 6. Activity counts per day (last 30 days)
    pool.query(`
      SELECT
        date_trunc('day', created_at)::date AS day,
        COUNT(*) FILTER (WHERE action = 'check_in')::int AS check_ins,
        COUNT(*) FILTER (WHERE action = 'check_out')::int AS check_outs,
        COUNT(*) FILTER (WHERE action = 'move')::int AS moves,
        COUNT(*)::int AS total
      FROM activity_log
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY date_trunc('day', created_at)
      ORDER BY day ASC
    `),

    // 7. Per-rack occupancy for bar chart
    pool.query(`
      SELECT
        r.code,
        r.label,
        r.rack_type,
        COUNT(DISTINCT ss.id)::int AS total_cells,
        COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS used_cells,
        COALESCE(SUM(ss.current_count), 0)::int AS item_count
      FROM racks r
      LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
      GROUP BY r.id
      ORDER BY r.display_order, r.code
    `),

    // 8. Material breakdown for pie chart
    pool.query(`
      SELECT
        COALESCE(i.material, 'Unknown') AS material,
        COUNT(DISTINCT sa.id)::int AS assignment_count,
        COALESCE(SUM(sa.quantity), 0)::int AS total_quantity
      FROM storage_assignments sa
      JOIN items i ON sa.item_id = i.id
      WHERE sa.checked_out_at IS NULL
      GROUP BY i.material
      ORDER BY total_quantity DESC
    `),
  ]);

  const stats = statsResult.rows[0];
  const totalSlots = Number(stats.total_slots);
  const slotsInUse = Number(stats.slots_in_use);
  const occupancyPercent = totalSlots > 0
    ? Math.round((slotsInUse / totalSlots) * 100)
    : 0;

  res.json({
    data: {
      stats: {
        total_racks: Number(stats.total_racks),
        total_slots: Number(stats.total_slots),
        total_capacity: Number(stats.total_capacity),
        volume_stored: Number(stats.volume_stored),
        slots_in_use: Number(stats.slots_in_use),
        total_items_stored: Number(stats.total_items_stored),
        occupancy_percent: occupancyPercent,
      },
      recent_activity: activityResult.rows,
      customer_breakdown: customerBreakdownResult.rows,
      machines: machineResult.rows,
      aging: agingResult.rows[0],
      daily_activity: dailyActivityResult.rows,
      rack_occupancy: rackOccupancyResult.rows,
      material_breakdown: materialBreakdownResult.rows,
    },
  });
}));
