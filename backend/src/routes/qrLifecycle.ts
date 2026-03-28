import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  buildAssemblyCode,
  buildPlacementLabel,
  createStorageAssignmentFromQr,
  findNearestShelfSlot,
  getExistingTrackingUnitCodes,
  resolveItemForQr,
} from '../lib/qrPlacement';
import {
  ensureOrderFulfillment,
  incrementFulfillment,
  retireAssemblyState,
  retireProductQrEntities,
  upsertQrEntity,
} from '../lib/qrState';

export const qrLifecycleRouter = Router();

qrLifecycleRouter.post('/product-intake', asyncHandler(async (req, res) => {
  const {
    qr_code,
    preferred_rack_id,
    preferred_shelf_slot_id,
    quantity,
    performed_by,
    notes,
  } = req.body;

  if (!qr_code || !performed_by) {
    res.status(400).json({ error: 'qr_code and performed_by are required' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const item = await resolveItemForQr(client, qr_code);
    if (!item) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'No item matches this product QR code' });
      return;
    }

    const placement = await findNearestShelfSlot(client, item.type, preferred_rack_id || null, preferred_shelf_slot_id || null);
    if (!placement) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No empty storage space is available' });
      return;
    }

    const intakeQuantity = Number.isInteger(quantity) && quantity > 0 ? quantity : 1;
    const { assignmentId, unitCode } = await createStorageAssignmentFromQr(client, {
      item_id: item.id,
      item_code: item.item_code,
      shelf_slot_id: placement.shelf_slot_id,
      quantity: intakeQuantity,
      performed_by,
      notes,
    });

    await upsertQrEntity(client, {
      qr_code,
      qr_type: 'product',
      item_id: item.id,
      storage_assignment_id: assignmentId,
    });

    const locationCode = buildPlacementLabel(placement);
    const fulfillment = await ensureOrderFulfillment(client, item.id);

    await client.query(
      `INSERT INTO inventory_events (
        id,
        unit_code,
        item_id,
        storage_assignment_id,
        source,
        event_type,
        event_status,
        quantity,
        location_code,
        reported_by,
        notes,
        metadata
      ) VALUES ($1, $2, $3, $4, 'worker', 'product_qr_intake', 'recorded', $5, $6, $7, $8, $9::jsonb)`,
      [
        uuidv4(),
        unitCode,
        item.id,
        assignmentId,
        intakeQuantity,
        locationCode,
        performed_by,
        notes || null,
        JSON.stringify({
          qr_code,
          rerouted: placement.rerouted,
          preferred_rack_id: preferred_rack_id || null,
          preferred_shelf_slot_id: preferred_shelf_slot_id || null,
        }),
      ],
    );

    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes)
       VALUES ($1, $2, 'check_in', $3, $4, $5)`,
      [
        uuidv4(),
        item.id,
        locationCode,
        performed_by,
        placement.rerouted
          ? `QR intake rerouted to nearest empty rack cell. ${notes || ''}`.trim()
          : notes || null,
      ],
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        qr_code,
        unit_code: unitCode,
        assignment_id: assignmentId,
        location_code: locationCode,
        rerouted: placement.rerouted,
        rack_code: placement.rack_code,
        rack_label: placement.rack_label,
        row_number: placement.row_number,
        column_number: placement.column_number,
        order_progress: fulfillment,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

qrLifecycleRouter.post('/assembly-compile', asyncHandler(async (req, res) => {
  const {
    source_unit_codes,
    source_assignment_ids,
    assembly_qr_code,
    preferred_rack_id,
    preferred_shelf_slot_id,
    performed_by,
    notes,
  } = req.body;

  if (!performed_by) {
    res.status(400).json({ error: 'performed_by is required' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const unitCodes: string[] = Array.isArray(source_unit_codes) ? source_unit_codes.filter(Boolean) : [];
    const assignmentIds: string[] = Array.isArray(source_assignment_ids) ? source_assignment_ids.filter(Boolean) : [];

    if (unitCodes.length === 0 && assignmentIds.length === 0) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'At least one source unit code or assignment id is required' });
      return;
    }

    const sourceResult = await client.query(`
      SELECT sa.id AS storage_assignment_id, sa.item_id, sa.unit_code, sa.quantity, sa.shelf_slot_id, i.item_code, i.name
      FROM storage_assignments sa
      JOIN items i ON i.id = sa.item_id
      WHERE sa.checked_out_at IS NULL
        AND (
          sa.unit_code = ANY($1::text[])
          OR sa.id::text = ANY($2::text[])
        )
      FOR UPDATE OF sa
    `, [unitCodes, assignmentIds]);

    if (sourceResult.rows.length === 0) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'No active source storage units found' });
      return;
    }

    const first = sourceResult.rows[0];
    const mixedItem = sourceResult.rows.some((row) => row.item_id !== first.item_id);
    if (mixedItem) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'Assembly compilation requires source units from the same item' });
      return;
    }

    const placement = await findNearestShelfSlot(client, 'customer_order', preferred_rack_id || null, preferred_shelf_slot_id || null);
    if (!placement) {
      await client.query('ROLLBACK');
      res.status(400).json({ error: 'No empty assembly storage space is available' });
      return;
    }

    const totalQuantity = sourceResult.rows.reduce((sum, row) => sum + Number(row.quantity), 0);
    const existingCodes = await getExistingTrackingUnitCodes(client);
    const assemblyCode = buildAssemblyCode(first.item_code as string, existingCodes);
    const finalAssemblyQr = assembly_qr_code || assemblyCode;
    const assemblyBatchId = uuidv4();
    const assemblyAssignmentId = uuidv4();
    const locationCode = buildPlacementLabel(placement);

    await client.query(`
      INSERT INTO assembly_batches (
        id,
        item_id,
        assembly_code,
        quantity,
        status,
        compiled_from_count,
        compiled_by,
        notes
      ) VALUES ($1, $2, $3, $4, 'stored', $5, $6, $7)
    `, [
      assemblyBatchId,
      first.item_id,
      assemblyCode,
      totalQuantity,
      sourceResult.rows.length,
      performed_by,
      notes || null,
    ]);

    await client.query(`
      INSERT INTO assembly_assignments (
        id,
        assembly_batch_id,
        shelf_slot_id,
        quantity,
        stored_by,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      assemblyAssignmentId,
      assemblyBatchId,
      placement.shelf_slot_id,
      totalQuantity,
      performed_by,
      notes || null,
    ]);

    await client.query(`
      UPDATE shelf_slots
      SET current_count = current_count + 1,
          updated_at = NOW()
      WHERE id = $1
    `, [placement.shelf_slot_id]);

    for (const row of sourceResult.rows) {
      await client.query(`
        INSERT INTO assembly_batch_inputs (
          id,
          assembly_batch_id,
          source_storage_assignment_id,
          source_unit_code,
          quantity
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        uuidv4(),
        assemblyBatchId,
        row.storage_assignment_id,
        row.unit_code,
        row.quantity,
      ]);

      await client.query(`
        UPDATE storage_assignments
        SET checked_out_at = NOW(),
            checked_out_by = $2,
            notes = COALESCE($3, notes)
        WHERE id = $1
      `, [
        row.storage_assignment_id,
        performed_by,
        notes || 'Compiled into assembly QR',
      ]);

      await client.query(`
        UPDATE shelf_slots
        SET current_count = GREATEST(current_count - 1, 0),
            updated_at = NOW()
        WHERE id = $1
      `, [row.shelf_slot_id]);
    }

    await retireProductQrEntities(client, sourceResult.rows.map((row) => row.unit_code as string));

    await upsertQrEntity(client, {
      qr_code: finalAssemblyQr,
      qr_type: 'assembly',
      assembly_batch_id: assemblyBatchId,
    });

    const fulfillment = await ensureOrderFulfillment(client, first.item_id as string);
    const updatedFulfillment = await incrementFulfillment(client, first.item_id as string, totalQuantity) || fulfillment;

    const quotaMet = updatedFulfillment.fulfilled_quantity >= updatedFulfillment.requested_quantity;
    if (quotaMet) {
      await retireAssemblyState(client, assemblyBatchId, performed_by);
    }

    await client.query(
      `INSERT INTO inventory_events (
        id,
        unit_code,
        item_id,
        source,
        event_type,
        event_status,
        quantity,
        location_code,
        reported_by,
        notes,
        metadata
      ) VALUES ($1, $2, $3, 'worker', 'assembly_qr_compiled', 'recorded', $4, $5, $6, $7, $8::jsonb)`,
      [
        uuidv4(),
        assemblyCode,
        first.item_id,
        totalQuantity,
        locationCode,
        performed_by,
        notes || null,
        JSON.stringify({
          assembly_qr_code: finalAssemblyQr,
          source_unit_codes: sourceResult.rows.map((row) => row.unit_code),
          rerouted: placement.rerouted,
          quota_met: quotaMet,
        }),
      ],
    );

    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes)
       VALUES ($1, $2, 'move', $3, $4, $5)`,
      [
        uuidv4(),
        first.item_id,
        locationCode,
        performed_by,
        quotaMet
          ? `Compiled to assembly QR ${finalAssemblyQr} and archived after quota was met`
          : `Compiled to assembly QR ${finalAssemblyQr}`,
      ],
    );

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        assembly_batch_id: assemblyBatchId,
        assembly_code: assemblyCode,
        qr_code: finalAssemblyQr,
        quantity: totalQuantity,
        location_code: locationCode,
        rerouted: placement.rerouted,
        quota_met: quotaMet,
        retired_product_qrs: sourceResult.rows.map((row) => row.unit_code),
        order_progress: updatedFulfillment,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

qrLifecycleRouter.get('/tablet/summary', asyncHandler(async (_req, res) => {
  const [productResult, assemblyResult, progressResult, alertsResult] = await Promise.all([
    pool.query(`
      SELECT
        qe.qr_code,
        sa.unit_code,
        i.item_code,
        i.name AS item_name,
        c.name AS customer_name,
        sa.quantity,
        r.code AS rack_code,
        r.label AS rack_label,
        ss.row_number,
        ss.column_number,
        CONCAT(r.code, '/R', ss.row_number, 'C', ss.column_number) AS location_code
      FROM qr_entities qe
      JOIN storage_assignments sa ON sa.id = qe.storage_assignment_id AND sa.checked_out_at IS NULL
      JOIN items i ON i.id = sa.item_id
      LEFT JOIN customers c ON c.id = i.customer_id
      JOIN shelf_slots ss ON ss.id = sa.shelf_slot_id
      JOIN racks r ON r.id = ss.rack_id
      WHERE qe.qr_type = 'product' AND qe.status = 'active'
      ORDER BY r.display_order, ss.row_number, ss.column_number
    `),
    pool.query(`
      SELECT
        qe.qr_code,
        ab.assembly_code,
        i.item_code,
        i.name AS item_name,
        aa.quantity,
        r.code AS rack_code,
        r.label AS rack_label,
        ss.row_number,
        ss.column_number,
        CONCAT(r.code, '/R', ss.row_number, 'C', ss.column_number) AS location_code,
        ab.status
      FROM qr_entities qe
      JOIN assembly_batches ab ON ab.id = qe.assembly_batch_id
      JOIN items i ON i.id = ab.item_id
      LEFT JOIN assembly_assignments aa ON aa.assembly_batch_id = ab.id AND aa.removed_at IS NULL
      LEFT JOIN shelf_slots ss ON ss.id = aa.shelf_slot_id
      LEFT JOIN racks r ON r.id = ss.rack_id
      WHERE qe.qr_type = 'assembly' AND qe.status = 'active'
      ORDER BY ab.created_at DESC
    `),
    pool.query(`
      SELECT
        ofl.item_id,
        i.item_code,
        i.name AS item_name,
        ofl.requested_quantity,
        ofl.fulfilled_quantity,
        GREATEST(ofl.requested_quantity - ofl.fulfilled_quantity, 0) AS remaining_quantity,
        ofl.status
      FROM order_fulfillments ofl
      JOIN items i ON i.id = ofl.item_id
      ORDER BY ofl.updated_at DESC
    `),
    pool.query(`
      SELECT
        ma.*,
        ie.event_type,
        ie.source AS event_source,
        ie.location_code,
        ie.unit_code,
        sd.device_code
      FROM manager_alerts ma
      JOIN inventory_events ie ON ie.id = ma.inventory_event_id
      LEFT JOIN sensor_devices sd ON sd.id = ie.sensor_device_id
      WHERE ma.status = 'open'
      ORDER BY ma.created_at DESC
      LIMIT 20
    `),
  ]);

  res.json({
    data: {
      active_product_qrs: productResult.rows,
      active_assembly_qrs: assemblyResult.rows,
      order_progress: progressResult.rows,
      open_alerts: alertsResult.rows,
    },
  });
}));

qrLifecycleRouter.get('/:qrCode', asyncHandler(async (req, res) => {
  const qrCode = req.params.qrCode as string;

  const qrResult = await pool.query(`
    SELECT
      qe.*,
      COALESCE(product_item.id, assembly_item.id) AS resolved_item_id,
      COALESCE(product_item.item_code, assembly_item.item_code) AS resolved_item_code,
      COALESCE(product_item.name, assembly_item.name) AS resolved_item_name,
      COALESCE(product_customer.name, assembly_customer.name) AS resolved_customer_name,
      sa.quantity AS storage_quantity,
      ma.quantity AS machine_quantity,
      ab.quantity AS assembly_quantity,
      r.code AS rack_code,
      ss.row_number,
      ss.column_number,
      m.code AS machine_code
    FROM qr_entities qe
    LEFT JOIN items product_item ON product_item.id = qe.item_id
    LEFT JOIN customers product_customer ON product_customer.id = product_item.customer_id
    LEFT JOIN storage_assignments sa ON sa.id = qe.storage_assignment_id AND sa.checked_out_at IS NULL
    LEFT JOIN machine_assignments ma ON ma.id = qe.machine_assignment_id AND ma.removed_at IS NULL
    LEFT JOIN assembly_batches ab ON ab.id = qe.assembly_batch_id
    LEFT JOIN items assembly_item ON assembly_item.id = ab.item_id
    LEFT JOIN customers assembly_customer ON assembly_customer.id = assembly_item.customer_id
    LEFT JOIN assembly_assignments aa ON aa.assembly_batch_id = ab.id AND aa.removed_at IS NULL
    LEFT JOIN shelf_slots ss ON ss.id = COALESCE(sa.shelf_slot_id, aa.shelf_slot_id)
    LEFT JOIN racks r ON r.id = ss.rack_id
    LEFT JOIN machines m ON m.id = ma.machine_id
    WHERE qe.qr_code = $1
    ORDER BY qe.created_at DESC
    LIMIT 1
  `, [qrCode]);

  if (qrResult.rows.length === 0) {
    res.status(404).json({ error: 'QR code not found' });
    return;
  }

  const qr = qrResult.rows[0];
  const progressResult = qr.resolved_item_id
    ? await pool.query('SELECT * FROM order_fulfillments WHERE item_id = $1', [qr.resolved_item_id])
    : { rows: [] as Record<string, unknown>[] };

  const locationCode = qr.machine_code
    ? `M/${qr.machine_code}`
    : qr.rack_code && qr.row_number && qr.column_number
      ? `${qr.rack_code}/R${qr.row_number}C${qr.column_number}`
      : null;

  res.json({
    data: {
      qr_code: qr.qr_code,
      qr_type: qr.qr_type,
      status: qr.status,
      item_id: qr.resolved_item_id,
      item_code: qr.resolved_item_code,
      item_name: qr.resolved_item_name,
      customer_name: qr.resolved_customer_name,
      quantity: qr.storage_quantity || qr.machine_quantity || qr.assembly_quantity || 0,
      location_code: locationCode,
      location_type: qr.machine_code ? 'machine' : qr.assembly_batch_id ? 'assembly' : qr.storage_assignment_id ? 'storage' : 'none',
      order_progress: progressResult.rows[0] || null,
    },
  });
}));
