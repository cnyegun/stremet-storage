import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextTrackingUnitCode, getExistingTrackingUnitCodes } from '../lib/trackingUnits';
import { getDefaultMachineAssignmentStatus } from '../lib/machineAssignmentStatus';

export const trackingRouter = Router();

/**
 * GET /api/tracking/unit/:unitCode — lookup a tracking unit by its code
 */
trackingRouter.get('/unit/:unitCode', asyncHandler(async (req, res) => {
  const { unitCode } = req.params;

  const shelfResult = await pool.query(`
    SELECT sa.id AS assignment_id, sa.unit_code, sa.quantity, sa.checked_in_at, sa.checked_in_by,
      i.id AS item_id, i.item_code, i.name AS item_name, i.material, i.weight_kg, i.volume_m3,
      c.name AS customer_name, c.code AS customer_code,
      r.id AS rack_id, r.code AS rack_code, r.label AS rack_label,
      ss.row_number, ss.column_number, ss.id AS shelf_slot_id
    FROM storage_assignments sa
    JOIN items i ON sa.item_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    JOIN shelf_slots ss ON sa.shelf_slot_id = ss.id
    JOIN racks r ON ss.rack_id = r.id
    WHERE sa.unit_code = $1 AND sa.checked_out_at IS NULL
  `, [unitCode]);

  if (shelfResult.rows.length > 0) {
    const row = shelfResult.rows[0];
    res.json({
      data: {
        source_type: 'shelf',
        assignment_id: row.assignment_id,
        unit_code: row.unit_code,
        quantity: row.quantity,
        item_id: row.item_id,
        item_code: row.item_code,
        volume_m3: row.volume_m3,
        weight_kg: row.weight_kg,
        location: `${row.rack_code}/R${row.row_number}C${row.column_number}`,
        shelf_slot_id: row.shelf_slot_id
      }
    });
    return;
  }

  const machineResult = await pool.query(`
    SELECT ma.id AS assignment_id, ma.unit_code, ma.status, ma.quantity, ma.assigned_at,
      i.id AS item_id, i.item_code, i.name AS item_name, i.weight_kg, i.volume_m3,
      m.id AS machine_id, m.code AS machine_code
    FROM machine_assignments ma
    JOIN items i ON ma.item_id = i.id
    JOIN machines m ON ma.machine_id = m.id
    WHERE ma.unit_code = $1 AND ma.removed_at IS NULL
  `, [unitCode]);

  if (machineResult.rows.length > 0) {
    const row = machineResult.rows[0];
    res.json({
      data: {
        source_type: 'machine',
        assignment_id: row.assignment_id,
        unit_code: row.unit_code,
        status: row.status,
        quantity: row.quantity,
        item_id: row.item_id,
        item_code: row.item_code,
        location: `M/${row.machine_code}`,
        machine_id: row.machine_id
      }
    });
    return;
  }

  res.status(404).json({ error: `Unit ${unitCode} not found` });
}));

/**
 * UNIFIED SCAN ENDPOINT
 */
trackingRouter.post('/scan', asyncHandler(async (req, res) => {
  const { scan_code, location_code, performed_by } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const isUnit = scan_code.includes('-U');
    let unitCode = scan_code;
    let itemId: string | null = null;
    let assignment: any = null;
    let sourceType: 'shelf' | 'machine' | null = null;

    if (isUnit) {
        const sa = await client.query('SELECT sa.*, i.weight_kg, i.volume_m3 FROM storage_assignments sa JOIN items i ON sa.item_id = i.id WHERE sa.unit_code = $1 AND sa.checked_out_at IS NULL', [scan_code]);
        const ma = await client.query('SELECT ma.*, i.weight_kg, i.volume_m3 FROM machine_assignments ma JOIN items i ON ma.item_id = i.id WHERE ma.unit_code = $1 AND ma.removed_at IS NULL', [scan_code]);
        if (sa.rows.length > 0) { assignment = sa.rows[0]; sourceType = 'shelf'; itemId = assignment.item_id; }
        else if (ma.rows.length > 0) { assignment = ma.rows[0]; sourceType = 'machine'; itemId = assignment.item_id; }
    }

    const itemVolume = assignment ? (Number(assignment.volume_m3) || 0.1) * assignment.quantity : 0.1;
    const itemWeight = assignment ? (Number(assignment.weight_kg) || 0) * assignment.quantity : 0;

    // A. Handle MACHINE Scan
    if (location_code.startsWith('M/')) {
        const machineCode = location_code.replace('M/', '');
        const machine = (await client.query('SELECT id FROM machines WHERE code = $1', [machineCode])).rows[0];
        if (!machine) throw new Error('Machine not found');

        if (sourceType === 'machine' && assignment.machine_id === machine.id) {
            // Toggle Status
            const nextStatus = assignment.status === 'queued' ? 'processing' : 'ready_for_storage';
            await client.query('UPDATE machine_assignments SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, assignment.id]);
            await client.query('COMMIT');
            return res.json({ data: { status: nextStatus, action: 'toggle' } });
        }

        if (!isUnit) {
            const item = (await client.query('SELECT id, item_code FROM items WHERE item_code = $1', [scan_code])).rows[0];
            if (!item) throw new Error('Item template not found');
            itemId = item.id;
            unitCode = getNextTrackingUnitCode(item.item_code, await getExistingTrackingUnitCodes(client));
        } else {
            // Checkout from old
            if (sourceType === 'shelf') {
                await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, assignment.id]);
                await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), current_weight_kg = GREATEST(current_weight_kg - $1, 0), current_volume_m3 = GREATEST(current_volume_m3 - $2, 0) WHERE id = $3', [itemWeight, itemVolume, assignment.shelf_slot_id]);
            } else {
                await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, assignment.id]);
            }
        }

        await client.query('INSERT INTO machine_assignments (id, item_id, machine_id, unit_code, status, quantity, assigned_at, assigned_by) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)', [uuidv4(), itemId, machine.id, unitCode, 'queued', 1, performed_by]);
    }

    // B. Handle SHELF Scan
    else if (location_code.includes('/R')) {
        const shelf = (await client.query('SELECT ss.* FROM shelf_slots ss JOIN racks r ON ss.rack_id = r.id WHERE r.code || \'/R\' || ss.row_number || \'C\' || ss.column_number = $1 FOR UPDATE', [location_code])).rows[0];
        if (!shelf) throw new Error('Storage cell not found');
        if (!isUnit) throw new Error('Must start production at a machine first');

        if ((Number(shelf.current_volume_m3) + itemVolume) > Number(shelf.max_volume_m3)) throw new Error('Cell capacity exceeded');

        if (sourceType === 'machine') await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, assignment.id]);
        else await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, assignment.id]);

        await client.query('INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by) VALUES ($1, $2, $3, $4, $5, NOW(), $6)', [uuidv4(), itemId, shelf.id, unitCode, assignment.quantity, performed_by]);
        await client.query('UPDATE shelf_slots SET current_count = current_count + 1, current_weight_kg = current_weight_kg + $1, current_volume_m3 = current_volume_m3 + $2 WHERE id = $3', [itemWeight, itemVolume, shelf.id]);
    }

    await client.query('COMMIT');
    res.json({ data: { unit_code: unitCode, location: location_code } });
  } catch (err: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
}));
