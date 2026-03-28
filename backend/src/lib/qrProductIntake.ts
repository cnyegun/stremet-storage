import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import {
  buildPlacementLabel,
  findNearestShelfSlot,
  resolveItemForQr,
} from './qrPlacement';
import { createStorageAssignmentFromQr } from './qrCodes';
import { buildQrScanUrl, extractQrToken } from './qrLinks';
import { ensureOrderFulfillment, upsertQrEntity } from './qrState';

type ProductIntakeInput = {
  qr_code?: string;
  preferred_rack_id?: string;
  preferred_shelf_slot_id?: string;
  quantity?: number;
  performed_by?: string;
  notes?: string;
};

type ProductIntakeResult = {
  qr_code: string;
  scan_url: string;
  unit_code: string;
  assignment_id: string;
  location_code: string;
  rerouted: boolean;
  rack_code: string;
  rack_label: string;
  row_number: number;
  column_number: number;
  order_progress: Record<string, unknown>;
};

export async function processProductQrIntake(input: ProductIntakeInput): Promise<ProductIntakeResult> {
  const { qr_code, preferred_rack_id, preferred_shelf_slot_id, quantity, performed_by, notes } = input;
  const qrToken = qr_code ? extractQrToken(qr_code) : '';

  if (!qrToken || !performed_by) {
    throw httpError(400, 'qr_code and performed_by are required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const item = await resolveItemForQr(client, qrToken);
    if (!item) {
      throw httpError(404, 'No item matches this product QR code');
    }

    const placement = await findNearestShelfSlot(
      client,
      item.type,
      preferred_rack_id || null,
      preferred_shelf_slot_id || null,
      item.customer_id,
    );
    if (!placement) {
      throw httpError(400, 'No empty storage space is available');
    }

    const intakeQuantity = Number.isInteger(quantity) && quantity! > 0 ? Number(quantity) : 1;
    const { assignmentId, unitCode } = await createStorageAssignmentFromQr(client, {
      item_id: item.id,
      item_code: item.item_code,
      shelf_slot_id: placement.shelf_slot_id,
      quantity: intakeQuantity,
      performed_by,
      notes,
    });

    await upsertQrEntity(client, {
      qr_code: qrToken,
      qr_type: 'product',
      item_id: item.id,
      storage_assignment_id: assignmentId,
    });

    const locationCode = buildPlacementLabel(placement);
    const fulfillment = await ensureOrderFulfillment(client, item.id);

    await client.query(
      `INSERT INTO inventory_events (id, unit_code, item_id, storage_assignment_id, source, event_type, event_status, quantity, location_code, reported_by, notes, metadata)
       VALUES ($1, $2, $3, $4, 'worker', 'product_qr_intake', 'recorded', $5, $6, $7, $8, $9::jsonb)`,
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
          qr_token: qrToken,
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
        placement.rerouted ? `QR intake rerouted to nearest empty rack cell. ${notes || ''}`.trim() : notes || null,
      ],
    );

    await client.query('COMMIT');

    return {
      qr_code: qrToken,
      scan_url: buildQrScanUrl(qrToken),
      unit_code: unitCode,
      assignment_id: assignmentId,
      location_code: locationCode,
      rerouted: placement.rerouted,
      rack_code: placement.rack_code,
      rack_label: placement.rack_label,
      row_number: placement.row_number,
      column_number: placement.column_number,
      order_progress: fulfillment,
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
