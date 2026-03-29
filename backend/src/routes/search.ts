import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const searchRouter = Router();

// GET /api/search?q= — global search across items, customers, racks, machines
searchRouter.get('/', asyncHandler(async (req, res) => {
  const { q } = req.query;

  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    res.json({ data: { items: [], customers: [], locations: [], machines: [] } });
    return;
  }

  const term = `%${q.trim()}%`;

  const itemsResult = await pool.query(`
    SELECT i.id, i.item_code, i.name, i.type, c.name AS customer_name,
      CASE WHEN latest_sa.id IS NOT NULL THEN
        json_build_object(
          'unit_code', latest_sa.unit_code,
          'rack_id', r.id,
          'rack_code', r.code,
          'rack_label', r.label,
          'row_number', ss.row_number,
          'column_number', ss.column_number
        )
      ELSE NULL END AS current_location
    FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN LATERAL (
      SELECT sa.id, sa.shelf_slot_id, sa.unit_code, sa.checked_in_at
      FROM storage_assignments sa
      WHERE sa.item_id = i.id AND sa.checked_out_at IS NULL
      ORDER BY sa.checked_in_at DESC
      LIMIT 1
    ) latest_sa ON true
    LEFT JOIN shelf_slots ss ON latest_sa.shelf_slot_id = ss.id
    LEFT JOIN racks r ON ss.rack_id = r.id
    WHERE i.item_code ILIKE $1
      OR i.name ILIKE $1
      OR i.order_number ILIKE $1
      OR i.material ILIKE $1
      OR EXISTS (
        SELECT 1 FROM storage_assignments sa2
        WHERE sa2.item_id = i.id AND sa2.checked_out_at IS NULL AND sa2.unit_code ILIKE $1
      )
      OR EXISTS (
        SELECT 1 FROM machine_assignments ma2
        WHERE ma2.item_id = i.id AND ma2.removed_at IS NULL AND ma2.unit_code ILIKE $1
      )
    ORDER BY i.item_code
    LIMIT 20
  `, [term]);

  const customersResult = await pool.query(`
    SELECT c.id, c.name, c.code,
      COUNT(DISTINCT sa.id) FILTER (WHERE sa.checked_out_at IS NULL)::int AS items_in_storage
    FROM customers c
    LEFT JOIN items i ON i.customer_id = c.id
    LEFT JOIN storage_assignments sa ON sa.item_id = i.id
    WHERE c.name ILIKE $1 OR c.code ILIKE $1
    GROUP BY c.id
    ORDER BY c.name
    LIMIT 10
  `, [term]);

  const locationsResult = await pool.query(`
    SELECT r.id AS rack_id, r.code AS rack_code, r.label AS rack_label, r.rack_type,
      COALESCE(SUM(ss.current_count), 0)::int AS items_stored
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    WHERE r.code ILIKE $1 OR r.label ILIKE $1 OR r.rack_type::text ILIKE $1
    GROUP BY r.id
    ORDER BY r.code
    LIMIT 20
  `, [term]);

  const machinesResult = await pool.query(`
    SELECT m.id, m.name, m.code, m.category,
      COUNT(ma.id) FILTER (WHERE ma.removed_at IS NULL)::int AS active_items
    FROM machines m
    LEFT JOIN machine_assignments ma ON ma.machine_id = m.id
    WHERE m.name ILIKE $1 OR m.code ILIKE $1 OR m.category ILIKE $1
    GROUP BY m.id
    ORDER BY m.code
    LIMIT 10
  `, [term]);

  res.json({
    data: {
      items: itemsResult.rows,
      customers: customersResult.rows,
      locations: locationsResult.rows,
      machines: machinesResult.rows,
    },
  });
}));
