import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const racksRouter = Router();

// GET /api/racks/:id — rack detail with shelves and items
racksRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const rackResult = await pool.query(`
    SELECT r.*, z.code AS zone_code, z.name AS zone_name
    FROM racks r
    JOIN zones z ON r.zone_id = z.id
    WHERE r.id = $1
  `, [id]);

  if (rackResult.rows.length === 0) {
    res.status(404).json({ error: 'Rack not found' });
    return;
  }

  const shelvesResult = await pool.query(`
    SELECT ss.*,
      COALESCE(json_agg(
        json_build_object(
          'assignment_id', sa.id,
          'item_id', i.id,
          'item_code', i.item_code,
          'item_name', i.name,
          'customer_name', c.name,
          'material', i.material,
          'quantity', sa.quantity,
          'checked_in_at', sa.checked_in_at,
          'checked_in_by', sa.checked_in_by
        )
      ) FILTER (WHERE sa.id IS NOT NULL), '[]'::json) AS items
    FROM shelf_slots ss
    LEFT JOIN storage_assignments sa ON sa.shelf_slot_id = ss.id AND sa.checked_out_at IS NULL
    LEFT JOIN items i ON sa.item_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE ss.rack_id = $1
    GROUP BY ss.id
    ORDER BY ss.shelf_number
  `, [id]);

  res.json({
    data: {
      ...rackResult.rows[0],
      shelves: shelvesResult.rows,
    },
  });
}));
