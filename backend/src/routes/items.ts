import { Router } from 'express';
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { OptimizerService } from '../services/optimizerService';
import {
  getNextTrackingUnitCode,
  getExistingTrackingUnitCodes,
} from '../lib/trackingUnits';
import { buildRackLocationCode } from '../lib/rackCells';
import { getDefaultMachineAssignmentStatus } from '../lib/machineAssignmentStatus';

export const itemsRouter = Router();

// GET /api/items — list items with filters
itemsRouter.get('/', asyncHandler(async (req, res) => {
  const { search, type, customer_id } = req.query;
  
  let query = `
    SELECT i.*, c.name AS customer_name, c.code AS customer_code
    FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE 1=1
  `;
  const params: any[] = [];
  let idx = 1;

  if (search) {
    query += ` AND (i.item_code ILIKE $${idx} OR i.name ILIKE $${idx} OR c.name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  if (type) {
    query += ` AND i.type = $${idx}`;
    params.push(type);
    idx++;
  }

  if (customer_id) {
    query += ` AND i.customer_id = $${idx}`;
    params.push(customer_id);
    idx++;
  }

  query += ` ORDER BY i.item_code`;
  
  const result = await pool.query(query, params);
  res.json({ data: result.rows });
}));

// GET /api/items/:id — detail with location and history
itemsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const itemResult = await pool.query(`
    SELECT i.*, c.name AS customer_name, c.code AS customer_code
    FROM items i
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE i.id = $1
  `, [id]);

  if (itemResult.rows.length === 0) {
    res.status(404).json({ error: 'Item not found' });
    return;
  }

  const storageResult = await pool.query(`
    SELECT sa.*, ss.row_number, ss.column_number, r.code AS rack_code, r.label AS rack_label
    FROM storage_assignments sa
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    WHERE sa.item_id = $1 AND sa.checked_out_at IS NULL
  `, [id]);

  const activityResult = await pool.query(`
    SELECT * FROM activity_log WHERE item_id = $1 ORDER BY created_at DESC LIMIT 50
  `, [id]);

  const machineResult = await pool.query(`
    SELECT ma.*, m.name as machine_name, m.code as machine_code
    FROM machine_assignments ma
    JOIN machines m ON ma.machine_id = m.id
    WHERE ma.item_id = $1 AND ma.removed_at IS NULL
  `, [id]);

  res.json({
    data: {
      ...itemResult.rows[0],
      tracking_units: [
        ...storageResult.rows.map(r => ({ ...r, source_type: 'shelf' })),
        ...machineResult.rows.map(r => ({ ...r, source_type: 'machine' }))
      ],
      activity_history: activityResult.rows
    }
  });
}));

// GET /api/items/:id/suggest-location — volumetric suggestion
itemsRouter.get('/:id/suggest-location', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const itemResult = await pool.query('SELECT * FROM items WHERE id = $1', [id]);
  if (itemResult.rows.length === 0) { res.status(404).json({ error: 'Item not found' }); return; }
  const item = itemResult.rows[0];
  
  // Parse dimensions and fix height (Gravity Fix)
  const dimsStr = (item.dimensions || '0x0x0').toLowerCase().replace('mm', '');
  const dims = dimsStr.split('x').map((d: string) => parseFloat(d.trim())).sort((a: number, b: number) => a - b);
  
  const itemHeight = dims[0] || 0;
  const itemMaxFootprint = dims[2] || 0;
  const itemMinFootprint = dims[1] || 0;
  // 2. High-performance SQL Filter (Hard Constraints)
  const slotsResult = await pool.query(`
    SELECT ss.*, r.code as rack_code, r.display_order, r.position_x, r.position_y
    FROM shelf_slots ss JOIN racks r ON ss.rack_id = r.id
    WHERE (ss.max_volume_m3 - ss.current_volume_m3) >= ($1 * $2)
  `, [item.quantity, item.volume_m3 || 0.1]);

  const suggestions = slotsResult.rows
    .map(slot => ({
      ...slot,
      score: OptimizerService.scoreSlot(
        {
          cell_id: slot.id,
          rack_id: slot.rack_id,
          row_number: slot.row_number,
          column_number: slot.column_number,
          max_volume_m3: Number(slot.max_volume_m3),
          current_volume_m3: Number(slot.current_volume_m3),
          current_weight_kg: Number(slot.current_weight_kg),
          max_weight_kg: Number(slot.max_weight_kg),
          max_height: Number(slot.max_height),
          rack_code: slot.rack_code,
          display_order: Number(slot.display_order),
          position_x: Number(slot.position_x),
          position_y: Number(slot.position_y)
        }, 
        {
          type: item.type,
          weight_kg: Number(item.weight_kg),
          volume_m3: Number(item.volume_m3 || 0.1),
          turnover_class: item.turnover_class as 'A' | 'B' | 'C',
          quantity: Number(item.quantity),
          is_stackable: item.is_stackable ?? true,
          delivery_date: item.delivery_date
        }
      )
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(s => ({
      shelf_slot_id: s.id,
      location: `${s.rack_code}/R${s.row_number}C${s.column_number}`,
      reason: `Logistical flow optimized. ${(s.max_volume_m3 - s.current_volume_m3).toFixed(2)} m³ free.`,
      score: Math.round(100 - (s.score / 10000))
    }));

  res.json({ data: suggestions });
}));

// POST /api/items/check-in
itemsRouter.post('/check-in', asyncHandler(async (req, res) => {
  const { item_id, shelf_slot_id, quantity, checked_in_by, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [item_id]);
    const item = itemResult.rows[0];
    const slotResult = await client.query('SELECT * FROM shelf_slots WHERE id = $1 FOR UPDATE', [shelf_slot_id]);
    const slot = slotResult.rows[0];
    
    const qty = quantity || 1;
    const incomingVolume = (Number(item.volume_m3) || 0.1) * qty;
    
    if ((Number(slot.current_volume_m3) + incomingVolume) > Number(slot.max_volume_m3)) {
        throw new Error('Insufficient volumetric capacity');
    }

    const unitCode = getNextTrackingUnitCode(item.item_code, await getExistingTrackingUnitCodes(client));
    const assignmentId = uuidv4();
    
    await client.query(
      `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by, notes)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
      [assignmentId, item_id, shelf_slot_id, unitCode, qty, checked_in_by, notes || null]
    );

    const weightToAdd = (Number(item.weight_kg) || 0) * qty;
    await client.query(
      `UPDATE shelf_slots 
       SET current_count = current_count + 1, 
           current_weight_kg = current_weight_kg + $1, 
           current_volume_m3 = current_volume_m3 + $2,
           updated_at = NOW() 
       WHERE id = $3`,
      [weightToAdd, incomingVolume, shelf_slot_id]
    );

    await client.query('COMMIT');
    res.json({ data: { unit_code: unitCode, location: 'Stored' } });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));

// POST /api/items/move
itemsRouter.post('/move', asyncHandler(async (req, res) => {
  const { assignment_id, source_type, to_shelf_slot_id, to_machine_id, performed_by, quantity, notes } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let sourceQuery = source_type === 'machine' 
        ? `SELECT ma.*, i.weight_kg, i.volume_m3, i.item_code FROM machine_assignments ma JOIN items i ON ma.item_id = i.id WHERE ma.id = $1 AND ma.removed_at IS NULL FOR UPDATE`
        : `SELECT sa.*, i.weight_kg, i.volume_m3, i.item_code FROM storage_assignments sa JOIN items i ON sa.item_id = i.id WHERE sa.id = $1 AND sa.checked_out_at IS NULL FOR UPDATE`;
    
    const sourceResult = await client.query(sourceQuery, [assignment_id]);
    if (sourceResult.rows.length === 0) throw new Error('Source assignment not found');
    const assignment = sourceResult.rows[0];
    const moveQty = quantity || assignment.quantity;
    const volumeToMove = (Number(assignment.volume_m3) || 0.1) * moveQty;
    const weightToMove = (Number(assignment.weight_kg) || 0) * moveQty;

    if (to_shelf_slot_id) {
        const slot = (await client.query('SELECT * FROM shelf_slots WHERE id = $1 FOR UPDATE', [to_shelf_slot_id])).rows[0];
        if ((Number(slot.current_volume_m3) + volumeToMove) > Number(slot.max_volume_m3)) {
            throw new Error('Target cell volumetric capacity exceeded');
        }
    }

    if (source_type === 'shelf') {
        await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, assignment_id]);
        await client.query(
            'UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), current_weight_kg = GREATEST(current_weight_kg - $1, 0), current_volume_m3 = GREATEST(current_volume_m3 - $2, 0) WHERE id = $3',
            [weightToMove, volumeToMove, assignment.shelf_slot_id]
        );
    } else {
        await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, assignment_id]);
    }

    if (to_shelf_slot_id) {
        await client.query(
            `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [uuidv4(), assignment.item_id, to_shelf_slot_id, assignment.unit_code, moveQty, performed_by]
        );
        await client.query(
            'UPDATE shelf_slots SET current_count = current_count + 1, current_weight_kg = current_weight_kg + $1, current_volume_m3 = current_volume_m3 + $2 WHERE id = $3',
            [weightToMove, volumeToMove, to_shelf_slot_id]
        );
    } else if (to_machine_id) {
        await client.query(
            `INSERT INTO machine_assignments (id, item_id, machine_id, unit_code, status, quantity, assigned_at, assigned_by)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
            [uuidv4(), assignment.item_id, to_machine_id, assignment.unit_code, getDefaultMachineAssignmentStatus(), moveQty, performed_by]
        );
    }

    await client.query('COMMIT');
    res.json({ data: { unit_code: assignment.unit_code, to: to_shelf_slot_id ? 'Storage' : 'Machine' } });
  } catch (e: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
}));
