import { Router } from 'express';
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { buildRackCellLabel, buildRackLocationCode } from '../lib/rackCells';
import { buildTrackingUnitMoveNote, getNextTrackingUnitCode, resolveMoveQuantity } from '../lib/trackingUnits';

export const itemsRouter = Router();

async function getExistingTrackingUnitCodes(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ unit_code: string }>(
    `SELECT unit_code FROM storage_assignments WHERE unit_code IS NOT NULL
     UNION
     SELECT unit_code FROM machine_assignments WHERE unit_code IS NOT NULL`,
  );

  return result.rows.map((row) => row.unit_code);
}

// GET /api/items — list items with search, filter, sort, pagination
itemsRouter.get('/', asyncHandler(async (req, res) => {
  const {
    search,
    type,
    customer_id,
    rack_id,
    rack_type,
    material,
    min_age_days,
    in_storage,
    sort_by = 'created_at',
    sort_order = 'desc',
    page = '1',
    per_page = '25',
  } = req.query;

  const conditions: string[] = [];
  const params: (string | number)[] = [];
  let paramIdx = 1;

  if (search && typeof search === 'string') {
    conditions.push(`(
      i.item_code ILIKE $${paramIdx}
      OR i.name ILIKE $${paramIdx}
      OR c.name ILIKE $${paramIdx}
      OR i.order_number ILIKE $${paramIdx}
      OR EXISTS (
        SELECT 1 FROM storage_assignments sa_search
        WHERE sa_search.item_id = i.id AND sa_search.checked_out_at IS NULL AND sa_search.unit_code ILIKE $${paramIdx}
      )
      OR EXISTS (
        SELECT 1 FROM machine_assignments ma_search
        WHERE ma_search.item_id = i.id AND ma_search.removed_at IS NULL AND ma_search.unit_code ILIKE $${paramIdx}
      )
    )`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  if (type && typeof type === 'string') {
    conditions.push(`i.type = $${paramIdx}`);
    params.push(type);
    paramIdx++;
  }

  if (customer_id && typeof customer_id === 'string') {
    conditions.push(`i.customer_id = $${paramIdx}`);
    params.push(customer_id);
    paramIdx++;
  }

  if (rack_id && typeof rack_id === 'string') {
    conditions.push(`EXISTS (
      SELECT 1
      FROM storage_assignments sa_rack
      JOIN shelf_slots ss_rack ON sa_rack.shelf_slot_id = ss_rack.id
      WHERE sa_rack.item_id = i.id
        AND sa_rack.checked_out_at IS NULL
        AND ss_rack.rack_id = $${paramIdx}
    )`);
    params.push(rack_id);
    paramIdx++;
  }

  if (rack_type && typeof rack_type === 'string') {
    conditions.push(`EXISTS (
      SELECT 1
      FROM storage_assignments sa_type
      JOIN shelf_slots ss_type ON sa_type.shelf_slot_id = ss_type.id
      JOIN racks r_type ON ss_type.rack_id = r_type.id
      WHERE sa_type.item_id = i.id
        AND sa_type.checked_out_at IS NULL
        AND r_type.rack_type = $${paramIdx}
    )`);
    params.push(rack_type);
    paramIdx++;
  }

  if (material && typeof material === 'string') {
    conditions.push(`i.material ILIKE $${paramIdx}`);
    params.push(`%${material}%`);
    paramIdx++;
  }

  if (min_age_days && typeof min_age_days === 'string') {
    conditions.push(`latest_sa.checked_in_at <= NOW() - ($${paramIdx} || ' days')::INTERVAL`);
    params.push(min_age_days);
    paramIdx++;
  }

  if (in_storage === 'true') {
    conditions.push(`latest_sa.id IS NOT NULL`);
  } else if (in_storage === 'false') {
    conditions.push(`latest_sa.id IS NULL`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Validate sort column — these reference the base query columns directly
  const sortColumns: Record<string, string> = {
    item_code: 'i.item_code',
    name: 'i.name',
    customer: 'c.name',
    checked_in_at: 'latest_sa.checked_in_at',
    location: 'r.code',
    created_at: 'i.created_at',
  };
  const sortCol = sortColumns[sort_by as string] || 'i.created_at';
  const order = sort_order === 'asc' ? 'ASC' : 'DESC';

  const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(per_page as string, 10) || 25));
  const offset = (pageNum - 1) * limit;

  // Base FROM/JOIN clause used by both count and data queries.
  // Uses a LATERAL subquery to get at most one (the latest) active assignment per item,
  // which avoids DISTINCT ON and makes sorting straightforward.
  const fromClause = `
    FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN LATERAL (
      SELECT sa.id, sa.shelf_slot_id, sa.unit_code, sa.parent_unit_code, sa.quantity, sa.checked_in_at, sa.checked_in_by
      FROM storage_assignments sa
      WHERE sa.item_id = i.id AND sa.checked_out_at IS NULL
      ORDER BY sa.checked_in_at DESC
      LIMIT 1
    ) latest_sa ON true
    LEFT JOIN shelf_slots ss ON latest_sa.shelf_slot_id = ss.id
    LEFT JOIN racks r ON ss.rack_id = r.id
  `;

  // Count total
  const countQuery = `SELECT COUNT(*)::int AS total ${fromClause} ${whereClause}`;
  const countResult = await pool.query(countQuery, params);
  const total = countResult.rows[0]?.total ?? 0;

  // Fetch items
  const dataQuery = `
    SELECT
      i.*,
      c.name AS customer_name,
      c.code AS customer_code,
      CASE WHEN latest_sa.id IS NOT NULL THEN
        json_build_object(
          'unit_code', latest_sa.unit_code,
          'parent_unit_code', latest_sa.parent_unit_code,
          'rack_id', r.id,
          'rack_code', r.code,
          'rack_label', r.label,
          'row_number', ss.row_number,
          'column_number', ss.column_number,
          'shelf_slot_id', ss.id,
          'assignment_id', latest_sa.id,
          'checked_in_at', latest_sa.checked_in_at,
          'quantity', latest_sa.quantity
        )
      ELSE NULL END AS current_location
    ${fromClause}
    ${whereClause}
    ORDER BY ${sortCol} ${order} NULLS LAST
    LIMIT $${paramIdx} OFFSET $${paramIdx + 1}
  `;
  params.push(limit, offset);

  const dataResult = await pool.query(dataQuery, params);

  res.json({
    data: dataResult.rows,
    total,
    page: pageNum,
    per_page: limit,
  });
}));

// GET /api/items/duplicates — find items with same code stored in multiple places
itemsRouter.get('/duplicates', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
    SELECT i.item_code,
      json_agg(
        json_build_object(
          'rack_id', r.id,
          'rack_code', r.code,
          'rack_label', r.label,
          'row_number', ss.row_number,
          'column_number', ss.column_number,
          'quantity', sa.quantity,
          'checked_in_at', sa.checked_in_at
        )
      ) AS existing_locations
    FROM storage_assignments sa
    JOIN items i ON sa.item_id = i.id
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    WHERE sa.checked_out_at IS NULL
    GROUP BY i.item_code
    HAVING COUNT(*) > 1
    ORDER BY i.item_code
  `);
  res.json({ data: result.rows });
}));

// GET /api/items/duplicate-check?item_code= — find any active storage locations for a specific item code
itemsRouter.get('/duplicate-check', asyncHandler(async (req, res) => {
  const { item_code } = req.query;

  if (!item_code || typeof item_code !== 'string' || item_code.trim().length === 0) {
    res.status(400).json({ error: 'item_code query parameter is required' });
    return;
  }

  const result = await pool.query(`
    SELECT i.item_code,
      json_agg(
        json_build_object(
          'rack_id', r.id,
          'rack_code', r.code,
          'rack_label', r.label,
          'row_number', ss.row_number,
          'column_number', ss.column_number,
          'quantity', sa.quantity,
          'checked_in_at', sa.checked_in_at
        )
        ORDER BY sa.checked_in_at DESC
      ) AS existing_locations
    FROM storage_assignments sa
    JOIN items i ON sa.item_id = i.id
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    WHERE sa.checked_out_at IS NULL
      AND LOWER(i.item_code) = LOWER($1)
    GROUP BY i.item_code
  `, [item_code.trim()]);

  res.json({ data: result.rows[0] || null });
}));

import { OptimizerService } from '../services/optimizerService';

// GET /api/items/:id/suggest-location — smart location suggestion
itemsRouter.get('/:id/suggest-location', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // 1. Get detailed item info, including next machine location
  const itemResult = await pool.query(`
    SELECT i.*, c.code AS customer_code, 
           m.position_x as next_x, m.position_y as next_y
    FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    LEFT JOIN machines m ON i.next_machine_id = m.id
    WHERE i.id = $1
  `, [id]);

  if (itemResult.rows.length === 0) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const item = itemResult.rows[0];
  
  // Parse dimensions and fix height (Gravity Fix)
  const dimsStr = (item.dimensions || '0x0x0').toLowerCase().replace('mm', '');
  const dims = dimsStr.split('x').map((d: string) => parseFloat(d.trim())).sort((a: number, b: number) => a - b);
  
  const itemHeight = dims[0] || 0;
  const itemMaxFootprint = dims[2] || 0;
  const itemMinFootprint = dims[1] || 0;
  const itemWeightTotal = (Number(item.weight_kg) || 0) * (Number(item.quantity) || 1);

  // Map item type to preferred rack type
  const preferredRackType = item.type === 'general_stock' ? 'general_stock' : 'customer_orders';

  // 2. High-performance SQL Filter (Hard Constraints)
  const slotsResult = await pool.query(`
    SELECT
      ss.id AS shelf_slot_id,
      ss.rack_id,
      ss.row_number,
      ss.column_number,
      ss.capacity,
      ss.current_count,
      ss.current_weight_kg,
      ss.max_weight_kg,
      ss.max_height,
      r.code AS rack_code,
      r.rack_type,
      z.position_x AS zone_x,
      z.position_y AS zone_y
    FROM shelf_slots ss
    JOIN racks r ON ss.rack_id = r.id
    JOIN zones z ON r.zone_id = z.id
    WHERE 
      -- Physical Room (Count)
      (ss.capacity - ss.current_count) >= $1
      -- Weight Limit (Dynamic Scale Check)
      AND (ss.max_weight_kg - ss.current_weight_kg) >= $2
      -- Vertical Clearance (Gravity Fix)
      AND ss.max_height >= $3
      -- Footprint Clearance
      AND GREATEST(ss.max_length, ss.max_width) >= $4
      AND LEAST(ss.max_length, ss.max_width) >= $5
      -- Stackability Logic
      AND (($6 = FALSE AND ss.current_count = 0) OR ($6 = TRUE))
      -- Zone Filtering based on Rack Type
      AND (r.rack_type = $7 OR r.rack_type IN ('work_in_progress', 'finished_goods', 'raw_materials')) 
    ORDER BY (r.rack_type = $7) DESC
  `, [item.quantity, itemWeightTotal, itemHeight, itemMaxFootprint, itemMinFootprint, item.is_stackable ?? true, preferredRackType]);

  // 3. Score and Sort using OptimizerService
  const suggestions = slotsResult.rows
    .map(slot => {
      const score = OptimizerService.scoreSlot(
        {
          shelf_slot_id: slot.shelf_slot_id,
          rack_id: slot.rack_id,
          row_number: slot.row_number,
          column_number: slot.column_number,
          capacity: slot.capacity,
          current_count: slot.current_count,
          current_weight_kg: Number(slot.current_weight_kg),
          max_weight_kg: Number(slot.max_weight_kg),
          max_height: slot.max_height,
          rack_code: slot.rack_code,
          rack_type: slot.rack_type,
          zone_x: slot.zone_x,
          zone_y: slot.zone_y
        }, 
        {
          type: item.type as 'customer_order' | 'general_stock' | 'raw_material' | 'work_in_progress',
          weight_kg: Number(item.weight_kg),
          turnover_class: (item.turnover_class || 'C') as 'A' | 'B' | 'C',
          quantity: Number(item.quantity),
          is_stackable: item.is_stackable ?? true,
          delivery_date: item.delivery_date
        }
      );

      return {
        ...slot,
        score
      };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(s => {
      const reasons: string[] = [];
      if (item.type === 'customer_order') {
          reasons.push("Prioritized for delivery door proximity (Right-Side Flow)");
      } else if (item.type === 'raw_material' || item.type === 'work_in_progress') {
          reasons.push("Located near production line (Left-Side Flow)");
      }

      if (item.turnover_class === 'A' && [2, 3].includes(s.row_number)) {
        reasons.push("Ergonomic Golden Zone access");
      }
      
      reasons.push(`${s.capacity - s.current_count} units available`);

      return {
        shelf_slot_id: s.shelf_slot_id,
        rack_code: s.rack_code,
        row_number: s.row_number,
        column_number: s.column_number,
        available_capacity: s.capacity - s.current_count,
        reason: reasons.length > 0 ? reasons.join('. ') : "Standard optimized storage.",
        score: Math.round(100 - (s.score / 10))
      };
    });

  if (suggestions.length === 0) {
    res.json({ 
      data: [], 
      error: "No valid storage locations found that meet physical constraints." 
    });
  } else {
    res.json({ data: suggestions });
  }
}));

// GET /api/items/:id — item detail with location and history
itemsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const itemResult = await pool.query(`
    SELECT i.*,
      c.name AS customer_name,
      c.code AS customer_code
    FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.id = $1
  `, [id]);

  if (itemResult.rows.length === 0) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  // Current location
  const locationResult = await pool.query(`
    SELECT sa.id AS assignment_id, sa.unit_code, sa.parent_unit_code, sa.checked_in_at, sa.checked_in_by, sa.quantity,
      ss.id AS shelf_slot_id, ss.row_number, ss.column_number,
      r.id AS rack_id, r.code AS rack_code, r.label AS rack_label
    FROM storage_assignments sa
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    WHERE sa.item_id = $1 AND sa.checked_out_at IS NULL
    ORDER BY sa.checked_in_at DESC
    LIMIT 1
  `, [id]);

  // Machine locations
  const machineResult = await pool.query(`
    SELECT ma.id AS assignment_id, ma.unit_code, ma.parent_unit_code, ma.machine_id, ma.quantity, ma.assigned_at, ma.assigned_by,
      m.code AS machine_code, m.name AS machine_name, m.category AS machine_category
    FROM machine_assignments ma
    JOIN machines m ON ma.machine_id = m.id
    WHERE ma.item_id = $1 AND ma.removed_at IS NULL
    ORDER BY ma.assigned_at DESC
  `, [id]);

  const trackingUnitsResult = await pool.query(`
    SELECT *
    FROM (
      SELECT
        sa.id AS assignment_id,
        'shelf'::text AS source_type,
        sa.unit_code,
        sa.parent_unit_code,
        sa.quantity,
        sa.checked_in_at AS assigned_at,
        sa.checked_in_by AS assigned_by,
        NULL::text AS status,
        ss.id AS shelf_slot_id,
        r.id AS rack_id,
        r.code AS rack_code,
        r.label AS rack_label,
        ss.row_number,
        ss.column_number,
        NULL::uuid AS machine_id,
        NULL::text AS machine_code,
        NULL::text AS machine_name,
        NULL::text AS machine_category
      FROM storage_assignments sa
      JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
      JOIN racks r ON ss.rack_id = r.id
      WHERE sa.item_id = $1 AND sa.checked_out_at IS NULL

      UNION ALL

      SELECT
        ma.id AS assignment_id,
        'machine'::text AS source_type,
        ma.unit_code,
        ma.parent_unit_code,
        ma.quantity,
        ma.assigned_at AS assigned_at,
        ma.assigned_by AS assigned_by,
        NULL::text AS status,
        NULL::uuid AS shelf_slot_id,
        NULL::uuid AS rack_id,
        NULL::text AS rack_code,
        NULL::text AS rack_label,
        NULL::integer AS row_number,
        NULL::integer AS column_number,
        ma.machine_id,
        m.code AS machine_code,
        m.name AS machine_name,
        m.category AS machine_category
      FROM machine_assignments ma
      JOIN machines m ON ma.machine_id = m.id
      WHERE ma.item_id = $1 AND ma.removed_at IS NULL
    ) active_units
    ORDER BY assigned_at DESC, unit_code ASC
  `, [id]);

  // Activity history
  const historyResult = await pool.query(`
    SELECT * FROM activity_log
    WHERE item_id = $1
    ORDER BY created_at DESC
  `, [id]);

  res.json({
    data: {
      ...itemResult.rows[0],
      current_location: locationResult.rows[0] || null,
      machine_locations: machineResult.rows,
      tracking_units: trackingUnitsResult.rows,
      activity_history: historyResult.rows,
    },
  });
}));

// POST /api/items — create new item
itemsRouter.post('/', asyncHandler(async (req, res) => {
  const { item_code, customer_id, name, description, material, dimensions, weight_kg, type, order_number, quantity, delivery_date, production_priority } = req.body;

  if (!item_code || !name || !type) {
    res.status(400).json({ error: 'item_code, name, and type are required' });
    return;
  }

  // Check for duplicate item code
  const existing = await pool.query('SELECT id FROM items WHERE item_code = $1', [item_code]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'Item code already exists', details: `An item with code "${item_code}" already exists.` });
    return;
  }

  const id = uuidv4();
  const result = await pool.query(
    `INSERT INTO items (id, item_code, customer_id, name, description, material, dimensions, weight_kg, type, order_number, quantity, delivery_date, production_priority)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [id, item_code, customer_id || null, name, description || '', material || '', dimensions || '', weight_kg || 0, type, order_number || null, quantity || 1, delivery_date || null, production_priority || 5]
  );

  res.status(201).json({ data: result.rows[0] });
}));

// PUT /api/items/:id — update item
itemsRouter.put('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { name, description, material, dimensions, weight_kg, type, order_number, quantity, delivery_date, production_priority } = req.body;

  const fields: string[] = [];
  const values: (string | number)[] = [];
  let idx = 1;

  if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
  if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
  if (material !== undefined) { fields.push(`material = $${idx++}`); values.push(material); }
  if (dimensions !== undefined) { fields.push(`dimensions = $${idx++}`); values.push(dimensions); }
  if (weight_kg !== undefined) { fields.push(`weight_kg = $${idx++}`); values.push(weight_kg); }
  if (type !== undefined) { fields.push(`type = $${idx++}`); values.push(type); }
  if (order_number !== undefined) { fields.push(`order_number = $${idx++}`); values.push(order_number); }
  if (quantity !== undefined) { fields.push(`quantity = $${idx++}`); values.push(quantity); }
  if (delivery_date !== undefined) { fields.push(`delivery_date = $${idx++}`); values.push(delivery_date); }
  if (production_priority !== undefined) { fields.push(`production_priority = $${idx++}`); values.push(production_priority); }

  if (fields.length === 0) {
    res.status(400).json({ error: 'No fields to update' });
    return;
  }

  fields.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  res.json({ data: result.rows[0] });
}));

// POST /api/items/check-in — check in item to a shelf slot
itemsRouter.post('/check-in', asyncHandler(async (req, res) => {
  const { item_id, shelf_slot_id, quantity, checked_in_by, notes } = req.body;

  if (!item_id || !shelf_slot_id || !checked_in_by) {
    res.status(400).json({ error: 'item_id, shelf_slot_id, and checked_in_by are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Check item exists
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    if (itemResult.rows.length === 0) {
      res.status(404).json({ error: 'Item not found' });
      await client.query('ROLLBACK');
      return;
    }

    const item = itemResult.rows[0];

    // Check for duplicates in storage
    const dupResult = await client.query(`
      SELECT sa.id, r.id AS rack_id, r.code AS rack_code, r.label AS rack_label, ss.row_number, ss.column_number, sa.quantity, sa.checked_in_at
      FROM storage_assignments sa
      JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
      JOIN racks r ON ss.rack_id = r.id
      WHERE sa.item_id = $1 AND sa.checked_out_at IS NULL
    `, [item_id]);

    let warning: string | undefined;
    if (dupResult.rows.length > 0) {
      const locs = dupResult.rows.map((r: Record<string, unknown>) =>
        buildRackCellLabel(r.rack_code as string, r.row_number as number, r.column_number as number)
      ).join(', ');
      warning = `This item already exists in storage at: ${locs}`;
    }

    // Check shelf capacity
    const slotResult = await client.query('SELECT * FROM shelf_slots WHERE id = $1 FOR UPDATE', [shelf_slot_id]);
    if (slotResult.rows.length === 0) {
      res.status(404).json({ error: 'Shelf slot not found' });
      await client.query('ROLLBACK');
      return;
    }

    const slot = slotResult.rows[0];
    if (slot.current_count >= slot.capacity) {
      res.status(400).json({ error: 'Shelf slot is full' });
      await client.query('ROLLBACK');
      return;
    }

    const unitCode = getNextTrackingUnitCode(item.item_code as string, await getExistingTrackingUnitCodes(client));

    // Create assignment
    const assignmentId = uuidv4();
    const qty = quantity || 1;
    await client.query(
      `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [assignmentId, item_id, shelf_slot_id, unitCode, qty, checked_in_by, notes || null]
    );

    // Update shelf count and weight
    const weightToAdd = (Number(itemResult.rows[0].weight_kg) || 0) * qty;
    await client.query(
      'UPDATE shelf_slots SET current_count = current_count + 1, current_weight_kg = current_weight_kg + $1, updated_at = NOW() WHERE id = $2',
      [weightToAdd, shelf_slot_id]
    );

    // Get location string for activity log
    const locResult = await client.query(`
      SELECT r.code AS rack_code, ss.row_number, ss.column_number
      FROM shelf_slots ss
      JOIN racks r ON ss.rack_id = r.id
      WHERE ss.id = $1
    `, [shelf_slot_id]);
    const loc = locResult.rows[0];
    const locationStr = buildRackLocationCode(loc.rack_code as string, loc.row_number as number, loc.column_number as number);

    // Log activity
    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes)
       VALUES ($1, $2, 'check_in', $3, $4, $5)`,
      [uuidv4(), item_id, locationStr, checked_in_by, notes || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: { assignment_id: assignmentId, unit_code: unitCode, quantity: quantity || 1, location: locationStr },
      warning,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/items/check-out — check out item from storage
itemsRouter.post('/check-out', asyncHandler(async (req, res) => {
  const { assignment_id, source_type = 'shelf', checked_out_by, notes } = req.body;

  if (!assignment_id || !checked_out_by) {
    res.status(400).json({ error: 'assignment_id and checked_out_by are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let assignment: Record<string, unknown>;
    let locationStr: string;

    if (source_type === 'machine') {
      const assignmentResult = await client.query(`
        SELECT ma.*, m.code AS machine_code, i.item_code
        FROM machine_assignments ma
        JOIN machines m ON ma.machine_id = m.id
        JOIN items i ON ma.item_id = i.id
        WHERE ma.id = $1 AND ma.removed_at IS NULL
        FOR UPDATE OF ma
      `, [assignment_id]);

      if (assignmentResult.rows.length === 0) {
        res.status(404).json({ error: 'Active machine assignment not found' });
        await client.query('ROLLBACK');
        return;
      }

      assignment = assignmentResult.rows[0];
      locationStr = `M/${assignment.machine_code}`;

      await client.query(
        `UPDATE machine_assignments
         SET removed_at = NOW(), removed_by = $1, notes = COALESCE($2, notes)
         WHERE id = $3`,
        [checked_out_by, notes || null, assignment_id],
      );
    } else {
      const assignmentResult = await client.query(`
        SELECT sa.*, ss.id AS slot_id, r.code AS rack_code, ss.row_number, ss.column_number, i.item_code
        FROM storage_assignments sa
        JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
        JOIN racks r ON ss.rack_id = r.id
        JOIN items i ON sa.item_id = i.id
        WHERE sa.id = $1 AND sa.checked_out_at IS NULL
        FOR UPDATE OF sa, ss
      `, [assignment_id]);

      if (assignmentResult.rows.length === 0) {
        res.status(404).json({ error: 'Active storage assignment not found' });
        await client.query('ROLLBACK');
        return;
      }

      assignment = assignmentResult.rows[0];
      locationStr = buildRackLocationCode(assignment.rack_code as string, assignment.row_number as number, assignment.column_number as number);

      await client.query(
        `UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1, notes = COALESCE($2, notes) WHERE id = $3`,
        [checked_out_by, notes || null, assignment_id]
      );

      // Update shelf count and weight
      const weightToSubtract = (Number(assignment.weight_kg) || 0) * (Number(assignment.quantity) || 1);
      await client.query(
        'UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), current_weight_kg = GREATEST(current_weight_kg - $1, 0), updated_at = NOW() WHERE id = $2',
        [weightToSubtract, assignment.slot_id]
      );
    }

    // Log activity
    await client.query(
      `INSERT INTO activity_log (id, item_id, action, from_location, performed_by, notes)
       VALUES ($1, $2, 'check_out', $3, $4, $5)`,
      [uuidv4(), assignment.item_id, locationStr, checked_out_by, notes || null]
    );

    await client.query('COMMIT');

    res.json({
      data: { assignment_id, location: locationStr, item_code: assignment.item_code, unit_code: assignment.unit_code },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/items/move — move item between locations (shelf↔shelf, shelf↔machine, machine↔shelf, machine↔machine)
itemsRouter.post('/move', asyncHandler(async (req, res) => {
  const { assignment_id, source_type = 'shelf', to_shelf_slot_id, to_machine_id, performed_by, notes, quantity } = req.body;

  if (!assignment_id || !performed_by) {
    res.status(400).json({ error: 'assignment_id and performed_by are required' });
    return;
  }
  if (!to_shelf_slot_id && !to_machine_id) {
    res.status(400).json({ error: 'Either to_shelf_slot_id or to_machine_id is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let assignment: Record<string, unknown>;
    let fromStr: string;
    let itemId: string;
    let totalQty: number;

    if (source_type === 'machine') {
      // Source is a machine assignment
      const maResult = await client.query(`
        SELECT ma.*, m.code AS machine_code, m.name AS machine_name, i.item_code
        FROM machine_assignments ma
        JOIN machines m ON ma.machine_id = m.id
        JOIN items i ON ma.item_id = i.id
        WHERE ma.id = $1 AND ma.removed_at IS NULL
        FOR UPDATE OF ma
      `, [assignment_id]);

      if (maResult.rows.length === 0) {
        res.status(404).json({ error: 'Active machine assignment not found' });
        await client.query('ROLLBACK');
        return;
      }

      assignment = maResult.rows[0];
      itemId = assignment.item_id as string;
      totalQty = assignment.quantity as number;
      fromStr = `M/${assignment.machine_code}`;
    } else {
      // Source is a shelf assignment
      const saResult = await client.query(`
        SELECT sa.*, ss.id AS old_slot_id, r.code AS old_rack_code, ss.row_number AS old_row_number, ss.column_number AS old_column_number, i.item_code
        FROM storage_assignments sa
        JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
        JOIN racks r ON ss.rack_id = r.id
        JOIN items i ON sa.item_id = i.id
        WHERE sa.id = $1 AND sa.checked_out_at IS NULL
        FOR UPDATE OF sa, ss
      `, [assignment_id]);

      if (saResult.rows.length === 0) {
        res.status(404).json({ error: 'Active storage assignment not found' });
        await client.query('ROLLBACK');
        return;
      }

      assignment = saResult.rows[0];
      itemId = assignment.item_id as string;
      totalQty = assignment.quantity as number;
      fromStr = buildRackLocationCode(assignment.old_rack_code as string, assignment.old_row_number as number, assignment.old_column_number as number);
    }

    let moveQty: number;
    let remainingQty: number;
    let isPartial: boolean;
    try {
      ({ moveQuantity: moveQty, remainingQuantity: remainingQty, isPartial } = resolveMoveQuantity(totalQty, quantity != null ? Number(quantity) : undefined));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid move quantity' });
      await client.query('ROLLBACK');
      return;
    }

    const sourceUnitCode = assignment.unit_code as string;
    const sourceParentUnitCode = (assignment.parent_unit_code as string | null) || null;
    const movedUnitCode = isPartial
      ? getNextTrackingUnitCode(assignment.item_code as string, await getExistingTrackingUnitCodes(client))
      : sourceUnitCode;
    const movedParentUnitCode = isPartial ? sourceUnitCode : sourceParentUnitCode;
    let toStr: string;
    let newAssignmentId = assignment_id;

    if (to_machine_id) {
      // --- Destination is a machine ---
      const machineResult = await client.query('SELECT * FROM machines WHERE id = $1', [to_machine_id]);
      if (machineResult.rows.length === 0) {
        res.status(404).json({ error: 'Target machine not found' });
        await client.query('ROLLBACK');
        return;
      }
      const targetMachine = machineResult.rows[0];
      toStr = `M/${targetMachine.code}`;

      // Reduce/remove source
      if (source_type === 'machine') {
        if (isPartial) {
          await client.query('UPDATE machine_assignments SET quantity = quantity - $1 WHERE id = $2', [moveQty, assignment_id]);
        } else {
          await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, assignment_id]);
        }
      } else {
        if (isPartial) {
          await client.query('UPDATE storage_assignments SET quantity = quantity - $1 WHERE id = $2', [moveQty, assignment_id]);
        } else {
          await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, assignment_id]);
          await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1', [assignment.old_slot_id]);
        }
      }

      // Create machine assignment at target
      newAssignmentId = uuidv4();
      await client.query(
        `INSERT INTO machine_assignments (id, item_id, machine_id, unit_code, parent_unit_code, quantity, assigned_at, assigned_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
        [newAssignmentId, itemId, to_machine_id, movedUnitCode, movedParentUnitCode, moveQty, performed_by, notes || null]
      );
    } else {
      // --- Destination is a shelf ---
      const newSlotResult = await client.query('SELECT * FROM shelf_slots WHERE id = $1 FOR UPDATE', [to_shelf_slot_id]);
      if (newSlotResult.rows.length === 0) {
        res.status(404).json({ error: 'Target shelf slot not found' });
        await client.query('ROLLBACK');
        return;
      }
      const newSlot = newSlotResult.rows[0];
      if (newSlot.current_count >= newSlot.capacity) {
        res.status(400).json({ error: 'Target shelf slot is full' });
        await client.query('ROLLBACK');
        return;
      }

      const newLocResult = await client.query(`
        SELECT r.code AS rack_code, ss.row_number, ss.column_number
        FROM shelf_slots ss JOIN racks r ON ss.rack_id = r.id
        WHERE ss.id = $1
      `, [to_shelf_slot_id]);
      const newLoc = newLocResult.rows[0];
      toStr = buildRackLocationCode(newLoc.rack_code as string, newLoc.row_number as number, newLoc.column_number as number);

      // Reduce/remove source
      if (source_type === 'machine') {
        if (isPartial) {
          await client.query('UPDATE machine_assignments SET quantity = quantity - $1 WHERE id = $2', [moveQty, assignment_id]);
        } else {
          await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, assignment_id]);
        }
      } else {
        if (isPartial) {
          await client.query('UPDATE storage_assignments SET quantity = quantity - $1 WHERE id = $2', [moveQty, assignment_id]);
        } else {
          await client.query('UPDATE storage_assignments SET shelf_slot_id = $1 WHERE id = $2', [to_shelf_slot_id, assignment_id]);
          await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1', [assignment.old_slot_id]);
        }
      }

      // Create/update shelf assignment at target (for machine→shelf or partial shelf→shelf)
      if (source_type === 'machine' || isPartial) {
        newAssignmentId = uuidv4();
        await client.query(
          `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, parent_unit_code, quantity, checked_in_at, checked_in_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
          [newAssignmentId, itemId, to_shelf_slot_id, movedUnitCode, movedParentUnitCode, moveQty, performed_by, notes || null]
        );
        await client.query('UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1', [to_shelf_slot_id]);
      } else {
        // Full shelf→shelf: already moved the assignment above, just update target count
        await client.query('UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1', [to_shelf_slot_id]);
      }
    }

    // Log activity
    const noteText = buildTrackingUnitMoveNote(moveQty, totalQty, notes);

    await client.query(
      `INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
       VALUES ($1, $2, 'move', $3, $4, $5, $6)`,
      [uuidv4(), itemId, fromStr, toStr, performed_by, noteText]
    );

    await client.query('COMMIT');

    res.json({
      data: {
        assignment_id: newAssignmentId,
        unit_code: movedUnitCode,
        source_unit_code: sourceUnitCode,
        from: fromStr,
        to: toStr,
        quantity_moved: moveQty,
        quantity_remaining: remainingQty,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));
