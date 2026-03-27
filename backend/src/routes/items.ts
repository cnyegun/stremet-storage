import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';

export const itemsRouter = Router();

// GET /api/items — list items with search, filter, sort, pagination
itemsRouter.get('/', asyncHandler(async (req, res) => {
  const {
    search,
    type,
    customer_id,
    zone_id,
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

  if (zone_id && typeof zone_id === 'string') {
    conditions.push(`z.id = $${paramIdx}`);
    params.push(zone_id);
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
    location: 'z.code',
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
      SELECT sa.id, sa.shelf_slot_id, sa.quantity, sa.checked_in_at, sa.checked_in_by
      FROM storage_assignments sa
      WHERE sa.item_id = i.id AND sa.checked_out_at IS NULL
      ORDER BY sa.checked_in_at DESC
      LIMIT 1
    ) latest_sa ON true
    LEFT JOIN shelf_slots ss ON latest_sa.shelf_slot_id = ss.id
    LEFT JOIN racks r ON ss.rack_id = r.id
    LEFT JOIN zones z ON r.zone_id = z.id
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
          'zone_name', z.name,
          'zone_code', z.code,
          'rack_code', r.code,
          'shelf_number', ss.shelf_number,
          'shelf_slot_id', ss.id,
          'assignment_id', latest_sa.id,
          'checked_in_at', latest_sa.checked_in_at
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
          'zone_name', z.name,
          'rack_code', r.code,
          'shelf_number', ss.shelf_number,
          'quantity', sa.quantity,
          'checked_in_at', sa.checked_in_at
        )
      ) AS existing_locations
    FROM storage_assignments sa
    JOIN items i ON sa.item_id = i.id
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    JOIN zones z ON r.zone_id = z.id
    WHERE sa.checked_out_at IS NULL
    GROUP BY i.item_code
    HAVING COUNT(*) > 1
    ORDER BY i.item_code
  `);
  res.json({ data: result.rows });
}));

// GET /api/items/:id/suggest-location — smart location suggestion
itemsRouter.get('/:id/suggest-location', asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Get item info
  const itemResult = await pool.query(`
    SELECT i.*, c.code AS customer_code FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.id = $1
  `, [id]);

  if (itemResult.rows.length === 0) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const item = itemResult.rows[0];

  // Determine preferred zone based on type
  let preferredZoneCode: string;
  if (item.type === 'general_stock') {
    preferredZoneCode = 'E';
  } else {
    preferredZoneCode = 'D'; // customer orders default to D
  }

  // Find all available shelf slots with their zone info and customer proximity score
  const slotsResult = await pool.query(`
    SELECT
      ss.id AS shelf_slot_id,
      z.code AS zone_code,
      z.name AS zone_name,
      r.code AS rack_code,
      ss.shelf_number,
      ss.capacity - ss.current_count AS available_capacity,
      z.code = $1 AS is_preferred_zone,
      (
        SELECT COUNT(*)::int
        FROM storage_assignments sa2
        JOIN items i2 ON sa2.item_id = i2.id
        WHERE sa2.shelf_slot_id IN (
          SELECT ss2.id FROM shelf_slots ss2 WHERE ss2.rack_id = r.id
        )
        AND sa2.checked_out_at IS NULL
        AND i2.customer_id = $2
      ) AS same_customer_count
    FROM shelf_slots ss
    JOIN racks r ON ss.rack_id = r.id
    JOIN zones z ON r.zone_id = z.id
    WHERE ss.current_count < ss.capacity
    ORDER BY
      (z.code = $1) DESC,
      (
        SELECT COUNT(*)
        FROM storage_assignments sa2
        JOIN items i2 ON sa2.item_id = i2.id
        WHERE sa2.shelf_slot_id IN (
          SELECT ss2.id FROM shelf_slots ss2 WHERE ss2.rack_id = r.id
        )
        AND sa2.checked_out_at IS NULL
        AND i2.customer_id = $2
      ) DESC,
      (ss.capacity - ss.current_count) DESC
    LIMIT 3
  `, [preferredZoneCode, item.customer_id]);

  const suggestions = slotsResult.rows.map((row: Record<string, unknown>, idx: number) => {
    const reasons: string[] = [];
    if (row.is_preferred_zone) {
      reasons.push(`Preferred zone for ${item.type === 'general_stock' ? 'general stock' : 'customer orders'}`);
    }
    if ((row.same_customer_count as number) > 0) {
      reasons.push(`${row.same_customer_count} other ${item.customer_code || 'customer'} items on this rack`);
    }
    reasons.push(`${row.available_capacity} slots available`);

    return {
      shelf_slot_id: row.shelf_slot_id,
      zone_code: row.zone_code,
      zone_name: row.zone_name,
      rack_code: row.rack_code,
      shelf_number: row.shelf_number,
      available_capacity: row.available_capacity,
      reason: reasons.join('. '),
      score: 100 - idx * 20,
    };
  });

  res.json({ data: suggestions });
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
    SELECT sa.id AS assignment_id, sa.checked_in_at, sa.checked_in_by,
      ss.id AS shelf_slot_id, ss.shelf_number,
      r.code AS rack_code,
      z.name AS zone_name, z.code AS zone_code
    FROM storage_assignments sa
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    JOIN zones z ON r.zone_id = z.id
    WHERE sa.item_id = $1 AND sa.checked_out_at IS NULL
    ORDER BY sa.checked_in_at DESC
    LIMIT 1
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
      activity_history: historyResult.rows,
    },
  });
}));

// POST /api/items — create new item
itemsRouter.post('/', asyncHandler(async (req, res) => {
  const { item_code, customer_id, name, description, material, dimensions, weight_kg, type, order_number, quantity } = req.body;

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
    `INSERT INTO items (id, item_code, customer_id, name, description, material, dimensions, weight_kg, type, order_number, quantity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [id, item_code, customer_id || null, name, description || '', material || '', dimensions || '', weight_kg || 0, type, order_number || null, quantity || 1]
  );

  res.status(201).json({ data: result.rows[0] });
}));

// PUT /api/items/:id — update item
itemsRouter.put('/:id', asyncHandler(async (req, res) => {
  const id = req.params.id as string;
  const { name, description, material, dimensions, weight_kg, type, order_number, quantity } = req.body;

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

    // Check for duplicates in storage
    const dupResult = await client.query(`
      SELECT sa.id, z.name AS zone_name, r.code AS rack_code, ss.shelf_number, sa.quantity, sa.checked_in_at
      FROM storage_assignments sa
      JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
      JOIN racks r ON ss.rack_id = r.id
      JOIN zones z ON r.zone_id = z.id
      WHERE sa.item_id = $1 AND sa.checked_out_at IS NULL
    `, [item_id]);

    let warning: string | undefined;
    if (dupResult.rows.length > 0) {
      const locs = dupResult.rows.map((r: Record<string, unknown>) =>
        `${r.zone_name} > ${r.rack_code} > Shelf ${r.shelf_number}`
      ).join(', ');
      warning = `This item already exists in storage at: ${locs}`;
    }

    // Check shelf capacity
    const slotResult = await client.query('SELECT * FROM shelf_slots WHERE id = $1', [shelf_slot_id]);
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

    // Create assignment
    const assignmentId = uuidv4();
    await client.query(
      `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, quantity, checked_in_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [assignmentId, item_id, shelf_slot_id, quantity || 1, checked_in_by, notes || null]
    );

    // Update shelf count
    await client.query(
      'UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1',
      [shelf_slot_id]
    );

    // Get location string for activity log
    const locResult = await client.query(`
      SELECT z.code AS zone_code, r.code AS rack_code, ss.shelf_number
      FROM shelf_slots ss
      JOIN racks r ON ss.rack_id = r.id
      JOIN zones z ON r.zone_id = z.id
      WHERE ss.id = $1
    `, [shelf_slot_id]);
    const loc = locResult.rows[0];
    const locationStr = `Zone ${loc.zone_code} > ${loc.rack_code} > Shelf ${loc.shelf_number}`;

    // Log activity
    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes)
       VALUES ($1, $2, 'check_in', $3, $4, $5)`,
      [uuidv4(), item_id, locationStr, checked_in_by, notes || null]
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: { assignment_id: assignmentId, location: locationStr },
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
  const { assignment_id, checked_out_by, notes } = req.body;

  if (!assignment_id || !checked_out_by) {
    res.status(400).json({ error: 'assignment_id and checked_out_by are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get assignment with location info
    const assignmentResult = await client.query(`
      SELECT sa.*, ss.id AS slot_id, z.code AS zone_code, r.code AS rack_code, ss.shelf_number, i.item_code
      FROM storage_assignments sa
      JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
      JOIN racks r ON ss.rack_id = r.id
      JOIN zones z ON r.zone_id = z.id
      JOIN items i ON sa.item_id = i.id
      WHERE sa.id = $1 AND sa.checked_out_at IS NULL
    `, [assignment_id]);

    if (assignmentResult.rows.length === 0) {
      res.status(404).json({ error: 'Active storage assignment not found' });
      await client.query('ROLLBACK');
      return;
    }

    const assignment = assignmentResult.rows[0];
    const locationStr = `Zone ${assignment.zone_code} > ${assignment.rack_code} > Shelf ${assignment.shelf_number}`;

    // Update assignment
    await client.query(
      `UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1, notes = COALESCE($2, notes) WHERE id = $3`,
      [checked_out_by, notes || null, assignment_id]
    );

    // Update shelf count
    await client.query(
      'UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1',
      [assignment.slot_id]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_log (id, item_id, action, from_location, performed_by, notes)
       VALUES ($1, $2, 'check_out', $3, $4, $5)`,
      [uuidv4(), assignment.item_id, locationStr, checked_out_by, notes || null]
    );

    await client.query('COMMIT');

    res.json({
      data: { assignment_id, location: locationStr, item_code: assignment.item_code },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

// POST /api/items/move — move item between locations
itemsRouter.post('/move', asyncHandler(async (req, res) => {
  const { assignment_id, to_shelf_slot_id, performed_by, notes } = req.body;

  if (!assignment_id || !to_shelf_slot_id || !performed_by) {
    res.status(400).json({ error: 'assignment_id, to_shelf_slot_id, and performed_by are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get current assignment
    const assignmentResult = await client.query(`
      SELECT sa.*, ss.id AS old_slot_id, z.code AS old_zone_code, r.code AS old_rack_code, ss.shelf_number AS old_shelf_number
      FROM storage_assignments sa
      JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
      JOIN racks r ON ss.rack_id = r.id
      JOIN zones z ON r.zone_id = z.id
      WHERE sa.id = $1 AND sa.checked_out_at IS NULL
    `, [assignment_id]);

    if (assignmentResult.rows.length === 0) {
      res.status(404).json({ error: 'Active storage assignment not found' });
      await client.query('ROLLBACK');
      return;
    }

    const assignment = assignmentResult.rows[0];

    // Check new slot capacity
    const newSlotResult = await client.query('SELECT * FROM shelf_slots WHERE id = $1', [to_shelf_slot_id]);
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

    // Get new location info
    const newLocResult = await client.query(`
      SELECT z.code AS zone_code, r.code AS rack_code, ss.shelf_number
      FROM shelf_slots ss JOIN racks r ON ss.rack_id = r.id JOIN zones z ON r.zone_id = z.id
      WHERE ss.id = $1
    `, [to_shelf_slot_id]);
    const newLoc = newLocResult.rows[0];

    const fromStr = `Zone ${assignment.old_zone_code} > ${assignment.old_rack_code} > Shelf ${assignment.old_shelf_number}`;
    const toStr = `Zone ${newLoc.zone_code} > ${newLoc.rack_code} > Shelf ${newLoc.shelf_number}`;

    // Update assignment to new slot
    await client.query(
      'UPDATE storage_assignments SET shelf_slot_id = $1 WHERE id = $2',
      [to_shelf_slot_id, assignment_id]
    );

    // Update old slot count down
    await client.query(
      'UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1',
      [assignment.old_slot_id]
    );

    // Update new slot count up
    await client.query(
      'UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1',
      [to_shelf_slot_id]
    );

    // Log activity
    await client.query(
      `INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
       VALUES ($1, $2, 'move', $3, $4, $5, $6)`,
      [uuidv4(), assignment.item_id, fromStr, toStr, performed_by, notes || null]
    );

    await client.query('COMMIT');

    res.json({
      data: { assignment_id, from: fromStr, to: toStr },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));
