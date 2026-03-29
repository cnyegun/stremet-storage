import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const racksRouter = Router();

// GET /api/racks — list all racks with occupancy stats
racksRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT
      r.*,
      COUNT(DISTINCT ss.id)::int AS cell_count,
      COALESCE(SUM(ss.max_volume_m3), 0)::float AS total_capacity,
      COALESCE((
        SELECT SUM(i.volume_m3 * sa.quantity)
        FROM storage_assignments sa
        JOIN items i ON sa.item_id = i.id
        JOIN shelf_slots ss2 ON sa.shelf_slot_id = ss2.id
        WHERE ss2.rack_id = r.id AND sa.checked_out_at IS NULL
      ), 0)::float AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM storage_assignments sa2 
        WHERE sa2.shelf_slot_id = ss.id AND sa2.checked_out_at IS NULL
      ))::int AS cells_in_use
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY r.id
    ORDER BY r.display_order, r.code
  `);

  res.json({ data: result.rows });
}));

// GET /api/racks/:id — rack detail with row/column cells and items
racksRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rackResult = await pool.query(`
    SELECT r.*,
      COUNT(DISTINCT ss.id)::int AS total_cells,
      COUNT(DISTINCT ss.id) FILTER (WHERE EXISTS (
        SELECT 1 FROM storage_assignments sa2 
        WHERE sa2.shelf_slot_id = ss.id AND sa2.checked_out_at IS NULL
      ))::int AS occupied_cells,
      COALESCE((
        SELECT SUM(sa3.quantity)
        FROM storage_assignments sa3
        JOIN shelf_slots ss3 ON sa3.shelf_slot_id = ss3.id
        WHERE ss3.rack_id = r.id AND sa3.checked_out_at IS NULL
      ), 0)::int AS total_items
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    WHERE r.id = $1
    GROUP BY r.id
  `, [id]);

  if (rackResult.rows.length === 0) {
    res.status(404).json({ error: 'Rack not found' });
    return;
  }

  const shelvesResult = await pool.query(`
    SELECT 
      ss.id, ss.rack_id, ss.shelf_number, ss.row_number, ss.column_number,
      ss.max_volume_m3, ss.max_weight_kg, ss.max_height, ss.max_width, ss.max_length,
      ss.width_m, ss.depth_m, ss.height_m,
      ss.measured_weight_kg, ss.current_weight_kg, ss.weight_discrepancy_threshold,
      COALESCE((
        SELECT SUM(i2.volume_m3 * sa2.quantity)
        FROM storage_assignments sa2
        JOIN items i2 ON sa2.item_id = i2.id
        WHERE sa2.shelf_slot_id = ss.id AND sa2.checked_out_at IS NULL
      ), 0)::float AS current_volume_m3,
      COALESCE((
        SELECT COUNT(*)::int
        FROM storage_assignments sa3
        WHERE sa3.shelf_slot_id = ss.id AND sa3.checked_out_at IS NULL
      ), 0) AS current_count,
      r.code AS rack_code,
      r.label AS rack_label,
      'debug-dynamic-v1' as _version,
      COALESCE(json_agg(
        json_build_object(
           'assignment_id', sa.id,
           'item_id', i.id,
           'item_code', i.item_code,
           'unit_code', sa.unit_code,
           'item_name', i.name,
           'customer_name', c.name,
           'material', i.material,
           'quantity', sa.quantity,
           'checked_in_at', sa.checked_in_at,
           'checked_in_by', sa.checked_in_by
        )
      ) FILTER (WHERE sa.id IS NOT NULL), '[]'::json) AS items
    FROM shelf_slots ss
    JOIN racks r ON ss.rack_id = r.id
    LEFT JOIN storage_assignments sa ON sa.shelf_slot_id = ss.id AND sa.checked_out_at IS NULL
    LEFT JOIN items i ON sa.item_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE ss.rack_id = $1
    GROUP BY ss.id, r.code, r.label
    ORDER BY ss.row_number, ss.column_number
  `, [id]);

  res.json({
    data: {
      ...rackResult.rows[0],
      shelves: shelvesResult.rows,
    },
  });
}));
