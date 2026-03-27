import { Router } from 'express';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const activityRouter = Router();

// GET /api/activity — activity log with filters and pagination
activityRouter.get('/', asyncHandler(async (req, res) => {
  const {
    item_id,
    action,
    performed_by,
    date_from,
    date_to,
    sort_order = 'desc',
    page = '1',
    per_page = '50',
  } = req.query;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (item_id && typeof item_id === 'string') {
    conditions.push(`al.item_id = $${paramIdx}`);
    params.push(item_id);
    paramIdx++;
  }

  if (action && typeof action === 'string') {
    conditions.push(`al.action = $${paramIdx}`);
    params.push(action);
    paramIdx++;
  }

  if (performed_by && typeof performed_by === 'string') {
    conditions.push(`al.performed_by ILIKE $${paramIdx}`);
    params.push(`%${performed_by}%`);
    paramIdx++;
  }

  if (date_from && typeof date_from === 'string') {
    conditions.push(`al.created_at >= $${paramIdx}`);
    params.push(date_from);
    paramIdx++;
  }

  if (date_to && typeof date_to === 'string') {
    conditions.push(`al.created_at <= $${paramIdx}`);
    params.push(date_to);
    paramIdx++;
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';
  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(per_page as string, 10) || 50));
  const offset = (pageNum - 1) * limit;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM activity_log al ${whereClause}`,
    params
  );
  const total = countResult.rows[0]?.total ?? 0;

  const dataResult = await pool.query(`
    SELECT al.*, i.item_code, i.name AS item_name
    FROM activity_log al
    JOIN items i ON al.item_id = i.id
    ${whereClause}
    ORDER BY al.created_at ${order}
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `, [...params, limit, offset]);

  res.json({
    data: dataResult.rows,
    total,
    page: pageNum,
    per_page: limit,
  });
}));
