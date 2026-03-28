import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { buildPlacementLabel, findNearestShelfSlot } from './qrPlacement';
import { buildAssemblyCode, getExistingTrackingUnitCodes } from './qrCodes';
import { ensureOrderFulfillment, incrementFulfillment, retireAssemblyState, retireProductQrEntities, upsertQrEntity } from './qrState';
import { loadAssemblySources } from './qrAssemblySources';

type AssemblyCompileInput = {
  source_unit_codes?: string[];
  source_assignment_ids?: string[];
  assembly_qr_code?: string;
  preferred_rack_id?: string;
  preferred_shelf_slot_id?: string;
  performed_by?: string;
  notes?: string;
};

export async function processAssemblyQrCompile(input: AssemblyCompileInput) {
  const { source_unit_codes, source_assignment_ids, assembly_qr_code, preferred_rack_id, preferred_shelf_slot_id, performed_by, notes } = input;
  if (!performed_by) throw httpError(400, 'performed_by is required');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const sourceUnitCodes = Array.isArray(source_unit_codes) ? source_unit_codes.filter(Boolean) : [];
    const sourceAssignmentIds = Array.isArray(source_assignment_ids) ? source_assignment_ids.filter(Boolean) : [];
    const { rows, first, totalQuantity } = await loadAssemblySources(client, sourceUnitCodes, sourceAssignmentIds);

    const placement = await findNearestShelfSlot(client, 'customer_order', preferred_rack_id || null, preferred_shelf_slot_id || null);
    if (!placement) throw httpError(400, 'No empty assembly storage space is available');

    const existingCodes = await getExistingTrackingUnitCodes(client);
    const assemblyCode = buildAssemblyCode(first.item_code, existingCodes);
    const finalAssemblyQr = assembly_qr_code || assemblyCode;
    const assemblyBatchId = uuidv4();
    const locationCode = buildPlacementLabel(placement);

    await client.query(
      `INSERT INTO assembly_batches (id, item_id, assembly_code, quantity, status, compiled_from_count, compiled_by, notes)
       VALUES ($1, $2, $3, $4, 'stored', $5, $6, $7)`,
      [assemblyBatchId, first.item_id, assemblyCode, totalQuantity, rows.length, performed_by, notes || null],
    );

    await client.query(
      `INSERT INTO assembly_assignments (id, assembly_batch_id, shelf_slot_id, quantity, stored_by, notes)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), assemblyBatchId, placement.shelf_slot_id, totalQuantity, performed_by, notes || null],
    );
    await client.query('UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1', [placement.shelf_slot_id]);

    for (const row of rows) {
      await client.query(
        `INSERT INTO assembly_batch_inputs (id, assembly_batch_id, source_storage_assignment_id, source_unit_code, quantity)
         VALUES ($1, $2, $3, $4, $5)`,
        [uuidv4(), assemblyBatchId, row.storage_assignment_id, row.unit_code, row.quantity],
      );
      await client.query(
        `UPDATE storage_assignments
         SET checked_out_at = NOW(), checked_out_by = $2, notes = COALESCE($3, notes)
         WHERE id = $1`,
        [row.storage_assignment_id, performed_by, notes || 'Compiled into assembly QR'],
      );
      await client.query('UPDATE shelf_slots SET current_count = GREATEST(current_count - 1, 0), updated_at = NOW() WHERE id = $1', [row.shelf_slot_id]);
    }

    await retireProductQrEntities(client, rows.map((row) => row.unit_code));
    await upsertQrEntity(client, { qr_code: finalAssemblyQr, qr_type: 'assembly', assembly_batch_id: assemblyBatchId });

    const fulfillment = await ensureOrderFulfillment(client, first.item_id);
    const updatedFulfillment = await incrementFulfillment(client, first.item_id, totalQuantity) || fulfillment;
    const quotaMet = updatedFulfillment.fulfilled_quantity >= updatedFulfillment.requested_quantity;
    if (quotaMet) await retireAssemblyState(client, assemblyBatchId, performed_by);

    await client.query(
      `INSERT INTO inventory_events (id, unit_code, item_id, source, event_type, event_status, quantity, location_code, reported_by, notes, metadata)
       VALUES ($1, $2, $3, 'worker', 'assembly_qr_compiled', 'recorded', $4, $5, $6, $7, $8::jsonb)`,
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
          source_unit_codes: rows.map((row) => row.unit_code),
          rerouted: placement.rerouted,
          quota_met: quotaMet,
        }),
      ],
    );

    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes)
       VALUES ($1, $2, 'move', $3, $4, $5)`,
      [uuidv4(), first.item_id, locationCode, performed_by, quotaMet ? `Compiled to assembly QR ${finalAssemblyQr} and archived after quota was met` : `Compiled to assembly QR ${finalAssemblyQr}`],
    );

    await client.query('COMMIT');
    return {
      assembly_batch_id: assemblyBatchId,
      assembly_code: assemblyCode,
      qr_code: finalAssemblyQr,
      quantity: totalQuantity,
      location_code: locationCode,
      rerouted: placement.rerouted,
      quota_met: quotaMet,
      retired_product_qrs: rows.map((row) => row.unit_code),
      order_progress: updatedFulfillment,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}
