import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { buildRackLocationCode } from './rackCells';
import { getNextTrackingUnitCode } from './trackingUnits';

type PlacementResult = {
  shelf_slot_id: string;
  rack_id: string;
  rack_code: string;
  rack_label: string;
  row_number: number;
  column_number: number;
  rerouted: boolean;
};

type ItemRecord = {
  id: string;
  item_code: string;
  name: string;
  customer_name: string | null;
  type: string;
  quantity: number;
};

export async function getExistingTrackingUnitCodes(client: PoolClient): Promise<string[]> {
  const result = await client.query<{ unit_code: string }>(
    `SELECT unit_code FROM storage_assignments WHERE unit_code IS NOT NULL
     UNION
     SELECT unit_code FROM machine_assignments WHERE unit_code IS NOT NULL
     UNION
     SELECT assembly_code AS unit_code FROM assembly_batches WHERE assembly_code IS NOT NULL`,
  );

  return result.rows.map((row) => row.unit_code);
}

export async function resolveItemForQr(client: PoolClient, qrCode: string): Promise<ItemRecord | null> {
  const qrMatch = await client.query<ItemRecord>(`
    SELECT i.id, i.item_code, i.name, c.name AS customer_name, i.type, i.quantity
    FROM qr_entities qe
    JOIN items i ON i.id = qe.item_id
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE qe.qr_code = $1
      AND qe.qr_type = 'product'
    ORDER BY CASE WHEN qe.status = 'active' THEN 0 ELSE 1 END, qe.created_at DESC
    LIMIT 1
  `, [qrCode]);

  if (qrMatch.rows.length > 0) {
    return qrMatch.rows[0];
  }

  const itemMatch = await client.query<ItemRecord>(`
    SELECT i.id, i.item_code, i.name, c.name AS customer_name, i.type, i.quantity
    FROM items i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.item_code = $1 OR i.order_number = $1
    LIMIT 1
  `, [qrCode]);

  return itemMatch.rows[0] || null;
}

export async function findNearestShelfSlot(
  client: PoolClient,
  itemType: string,
  preferredRackId?: string | null,
  preferredShelfSlotId?: string | null,
): Promise<PlacementResult | null> {
  const preferredRack = preferredRackId
    ? await client.query(`
        SELECT id, display_order, rack_type
        FROM racks
        WHERE id = $1
      `, [preferredRackId])
    : { rows: [] as Array<{ id: string; display_order: number; rack_type: string }> };

  const preferredSlot = preferredShelfSlotId
    ? await client.query(`
        SELECT id, rack_id, row_number, column_number
        FROM shelf_slots
        WHERE id = $1
      `, [preferredShelfSlotId])
    : { rows: [] as Array<{ id: string; rack_id: string; row_number: number; column_number: number }> };

  const preferredRackRow = preferredRack.rows[0] || null;
  const preferredSlotRow = preferredSlot.rows[0] || null;
  const targetRackType = preferredRackRow?.rack_type || (itemType === 'customer_order' ? 'customer_orders' : 'general_stock');
  const targetRackId = preferredRackRow?.id || preferredSlotRow?.rack_id || null;
  const targetDisplayOrder = preferredRackRow?.display_order ?? null;
  const targetRow = preferredSlotRow?.row_number ?? null;
  const targetColumn = preferredSlotRow?.column_number ?? null;

  const result = await client.query(`
    SELECT
      ss.id AS shelf_slot_id,
      r.id AS rack_id,
      r.code AS rack_code,
      r.label AS rack_label,
      ss.row_number,
      ss.column_number,
      (CASE WHEN r.id = $1 THEN 0 ELSE 1 END) AS rack_priority,
      ABS(COALESCE(r.display_order, 0) - COALESCE($2::int, r.display_order)) AS display_distance,
      ABS(COALESCE(ss.row_number, 0) - COALESCE($3::int, ss.row_number))
        + ABS(COALESCE(ss.column_number, 0) - COALESCE($4::int, ss.column_number)) AS cell_distance,
      CASE WHEN r.rack_type = $5 THEN 0 ELSE 1 END AS rack_type_penalty
    FROM shelf_slots ss
    JOIN racks r ON r.id = ss.rack_id
    WHERE ss.current_count < ss.capacity
    ORDER BY
      rack_priority ASC,
      rack_type_penalty ASC,
      display_distance ASC,
      cell_distance ASC,
      r.display_order ASC,
      ss.row_number ASC,
      ss.column_number ASC
    LIMIT 1
  `, [
    targetRackId,
    targetDisplayOrder,
    targetRow,
    targetColumn,
    targetRackType,
  ]);

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    shelf_slot_id: row.shelf_slot_id,
    rack_id: row.rack_id,
    rack_code: row.rack_code,
    rack_label: row.rack_label,
    row_number: row.row_number,
    column_number: row.column_number,
    rerouted: Boolean(targetRackId && row.rack_id !== targetRackId),
  };
}

export function buildPlacementLabel(placement: PlacementResult) {
  return buildRackLocationCode(placement.rack_code, placement.row_number, placement.column_number);
}

export function buildAssemblyCode(itemCode: string, existingCodes: string[]) {
  const prefix = itemCode
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 16)
    .replace(/-$/g, '') || 'ASSEMBLY';
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-A(\\d+)$`);
  const sequence = existingCodes
    .map((code) => code.match(pattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value) && value > 0);
  const next = sequence.length > 0 ? Math.max(...sequence) + 1 : 1;
  return `${prefix}-A${String(next).padStart(3, '0')}`;
}

export async function createStorageAssignmentFromQr(client: PoolClient, params: {
  item_id: string;
  item_code: string;
  shelf_slot_id: string;
  quantity: number;
  performed_by: string;
  notes?: string | null;
}) {
  const unitCode = getNextTrackingUnitCode(params.item_code, await getExistingTrackingUnitCodes(client));
  const assignmentId = uuidv4();

  await client.query(`
    INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_by, notes)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [
    assignmentId,
    params.item_id,
    params.shelf_slot_id,
    unitCode,
    params.quantity,
    params.performed_by,
    params.notes || null,
  ]);

  await client.query(`
    UPDATE shelf_slots
    SET current_count = current_count + 1,
        updated_at = NOW()
    WHERE id = $1
  `, [params.shelf_slot_id]);

  return { assignmentId, unitCode };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
