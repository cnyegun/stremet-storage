import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { getNextTrackingUnitCode } from '../lib/trackingUnits';
import { buildRackLocationCode } from '../lib/rackCells';
import { assertMachineAssignmentStatus, getDefaultMachineAssignmentStatus } from '../lib/machineAssignmentStatus';

export const trackingRouter = Router();

/**
 * UNIFIED SCAN ENDPOINT
 * Handles Product QR + Location QR interactions
 */
trackingRouter.post('/scan', asyncHandler(async (req, res) => {
  const { scan_code, location_code, performed_by, notes } = req.body;

  if (!scan_code || !location_code || !performed_by) {
    res.status(400).json({ error: 'scan_code, location_code, and performed_by are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Identify if scan_code is an existing Unit or a new Item template
    const isUnit = scan_code.includes('-U');
    let unitCode = scan_code;
    let itemId: string | null = null;
    let currentAssignment: any = null;
    let sourceType: 'shelf' | 'machine' | null = null;

    if (isUnit) {
        // Find current location of this unit
        const saResult = await client.query(
            'SELECT sa.*, i.id as item_id FROM storage_assignments sa JOIN items i ON sa.item_id = i.id WHERE sa.unit_code = $1 AND sa.checked_out_at IS NULL', 
            [scan_code]
        );
        const maResult = await client.query(
            'SELECT ma.*, m.code as machine_code FROM machine_assignments ma JOIN machines m ON ma.machine_id = m.id WHERE ma.unit_code = $1 AND ma.removed_at IS NULL', 
            [scan_code]
        );

        if (saResult.rows.length > 0) {
            currentAssignment = saResult.rows[0];
            sourceType = 'shelf';
            itemId = currentAssignment.item_id;
        } else if (maResult.rows.length > 0) {
            currentAssignment = maResult.rows[0];
            sourceType = 'machine';
            itemId = currentAssignment.item_id;
        }
    }

    // 2. Handle Destination: MACHINE
    if (location_code.startsWith('M/')) {
        const machineCode = location_code.replace('M/', '');
        const machineResult = await client.query('SELECT * FROM machines WHERE code = $1', [machineCode]);
        if (machineResult.rows.length === 0) throw new Error(`Machine ${machineCode} not found`);
        const machine = machineResult.rows[0];

        // Case A: Toggle Status (Already at this machine)
        if (sourceType === 'machine' && currentAssignment.machine_id === machine.id) {
            const statusMap: Record<string, any> = {
                'queued': 'processing',
                'processing': 'ready_for_storage',
                'ready_for_storage': 'processing', // Loop back or keep same
                'needs_attention': 'processing'
            };
            const nextStatus = statusMap[currentAssignment.status] || 'processing';
            
            await client.query('UPDATE machine_assignments SET status = $1, updated_at = NOW() WHERE id = $2', [nextStatus, currentAssignment.id]);
            await client.query(
                `INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
                 VALUES ($1, $2, 'note_added', $3, $4, $5, $6)`,
                [uuidv4(), itemId, 'note_added', location_code, location_code, performed_by, `Status toggled to ${nextStatus}`]
            );

            await client.query('COMMIT');
            res.json({ data: { unit_code: scan_code, location: location_code, status: nextStatus, action: 'status_toggle' } });
            return;
        }

        // Case B: Start New Production or Move to Machine
        if (!isUnit) {
            // New Item Start - need to find item by code
            const itemResult = await client.query('SELECT id, item_code FROM items WHERE item_code = $1', [scan_code]);
            if (itemResult.rows.length === 0) throw new Error(`Item template ${scan_code} not found. Create item first.`);
            const item = itemResult.rows[0];
            itemId = item.id;
            
            // Generate next unit code
            const existingCodesResult = await client.query('SELECT unit_code FROM storage_assignments UNION SELECT unit_code FROM machine_assignments');
            unitCode = getNextTrackingUnitCode(item.item_code, existingCodesResult.rows.map(r => r.unit_code));
        } else {
            // Move existing unit from somewhere else to machine
            // Checkout from old
            if (sourceType === 'shelf') {
                await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, currentAssignment.id]);
                await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0) WHERE id = $1', [currentAssignment.shelf_slot_id]);
            } else if (sourceType === 'machine') {
                await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, currentAssignment.id]);
            }
        }

        // Create new machine assignment
        const newMaId = uuidv4();
        await client.query(
            `INSERT INTO machine_assignments (id, item_id, machine_id, unit_code, status, quantity, assigned_at, assigned_by)
             VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7)`,
            [newMaId, itemId, machine.id, unitCode, 'queued', 1, performed_by]
        );

        await client.query(
            `INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
             VALUES ($1, $2, 'move', $3, $4, $5, $6)`,
            [uuidv4(), itemId, sourceType === 'shelf' ? 'Storage' : 'New', location_code, performed_by, `Started production phase`]
        );

        await client.query('COMMIT');
        res.json({ data: { unit_code: unitCode, location: location_code, status: 'queued', action: 'production_start' } });
        return;
    }

    // 3. Handle Destination: SHELF (Rack Cell)
    // Assume location_code matches Rack-X/R1C1 pattern
    const shelfResult = await client.query(`
        SELECT ss.* FROM shelf_slots ss 
        JOIN racks r ON ss.rack_id = r.id 
        WHERE build_rack_location_code(r.code, ss.row_number, ss.column_number) = $1
    `, [location_code]).catch(() => {
        // Fallback for manual cell ID scan if QR is the UUID
        return client.query('SELECT * FROM shelf_slots WHERE id = $1', [location_code]);
    });

    if (shelfResult.rows.length > 0) {
        const shelf = shelfResult.rows[0];
        if (!isUnit) throw new Error("Cannot move a template to storage. Check into a machine first to generate a Unit ID.");

        // Checkout from old
        if (sourceType === 'machine') {
            await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, currentAssignment.id]);
        } else if (sourceType === 'shelf') {
            await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, currentAssignment.id]);
            await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0) WHERE id = $1', [currentAssignment.shelf_slot_id]);
        }

        // Checkin to new shelf
        const newSaId = uuidv4();
        await client.query(
            `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
            [newSaId, itemId, shelf.id, unitCode, 1, performed_by]
        );
        await client.query('UPDATE shelf_slots SET current_count = current_count + 1 WHERE id = $1', [shelf.id]);

        await client.query('COMMIT');
        res.json({ data: { unit_code: unitCode, location: location_code, status: 'stored', action: 'storage_checkin' } });
        return;
    }

    // 4. Handle Destination: EXIT (Shipping)
    if (location_code === 'EXIT') {
        if (!isUnit || !currentAssignment) throw new Error("Unit not found or active.");
        
        if (sourceType === 'machine') {
            await client.query('UPDATE machine_assignments SET removed_at = NOW(), removed_by = $1 WHERE id = $2', [performed_by, currentAssignment.id]);
        } else {
            await client.query('UPDATE storage_assignments SET checked_out_at = NOW(), checked_out_by = $1 WHERE id = $2', [performed_by, currentAssignment.id]);
            await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0) WHERE id = $1', [currentAssignment.shelf_slot_id]);
        }

        await client.query(
            `INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
             VALUES ($1, $2, 'check_out', $3, 'SHIPPED', $4, $5)`,
            [uuidv4(), itemId, location_code, performed_by, `Final dispatch via scanner`]
        );

        await client.query('COMMIT');
        res.json({ data: { unit_code: unitCode, location: 'SHIPPED', status: 'shipped', action: 'final_checkout' } });
        return;
    }

    throw new Error("Invalid location QR code scanned.");

  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  } finally {
    client.release();
  }
}));
