import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const customersRouter = Router();

// GET /api/customers — list all customers
customersRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT c.*,
      COUNT(DISTINCT i.id)::int AS item_count,
      COUNT(DISTINCT sa.id) FILTER (WHERE sa.checked_out_at IS NULL)::int AS items_in_storage
    FROM customers c
    LEFT JOIN items i ON i.customer_id = c.id
    LEFT JOIN storage_assignments sa ON sa.item_id = i.id
    GROUP BY c.id
    ORDER BY c.name
  `);
  res.json({ data: result.rows });
}));
