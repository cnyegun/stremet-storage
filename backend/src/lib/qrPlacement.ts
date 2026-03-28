import type { PoolClient } from 'pg';
import { buildRackLocationCode } from './rackCells';

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

  if (qrMatch.rows.length > 0) return qrMatch.rows[0];

  const itemMatch = await client.query<ItemRecord>(`
    SELECT i.id, i.item_code, i.name, c.name AS customer_name, i.type, i.quantity
    FROM items i
    LEFT JOIN customers c ON c.id = i.customer_id
    WHERE i.item_code = $1 OR i.order_number = $1
    LIMIT 1
  `, [qrCode]);

  return itemMatch.rows[0] || null;
}

export async function findNearestShelfSlot(client: PoolClient, itemType: string, preferredRackId?: string | null, preferredShelfSlotId?: string | null): Promise<PlacementResult | null> {
  const preferredRack = preferredRackId ? await client.query(`SELECT id, display_order, rack_type FROM racks WHERE id = $1`, [preferredRackId]) : { rows: [] as Array<{ id: string; display_order: number; rack_type: string }> };
  const preferredSlot = preferredShelfSlotId ? await client.query(`SELECT id, rack_id, row_number, column_number FROM shelf_slots WHERE id = $1`, [preferredShelfSlotId]) : { rows: [] as Array<{ id: string; rack_id: string; row_number: number; column_number: number }> };

  const preferredRackRow = preferredRack.rows[0] || null;
  const preferredSlotRow = preferredSlot.rows[0] || null;
  const targetRackType = preferredRackRow?.rack_type || (itemType === 'customer_order' ? 'customer_orders' : 'general_stock');
  const targetRackId = preferredRackRow?.id || preferredSlotRow?.rack_id || null;
  const targetDisplayOrder = preferredRackRow?.display_order ?? null;
  const targetRow = preferredSlotRow?.row_number ?? null;
  const targetColumn = preferredSlotRow?.column_number ?? null;

  const result = await client.query(`
    SELECT ss.id AS shelf_slot_id, r.id AS rack_id, r.code AS rack_code, r.label AS rack_label, ss.row_number, ss.column_number,
      (CASE WHEN r.id = $1 THEN 0 ELSE 1 END) AS rack_priority,
      ABS(COALESCE(r.display_order, 0) - COALESCE($2::int, r.display_order)) AS display_distance,
      ABS(COALESCE(ss.row_number, 0) - COALESCE($3::int, ss.row_number)) + ABS(COALESCE(ss.column_number, 0) - COALESCE($4::int, ss.column_number)) AS cell_distance,
      CASE WHEN r.rack_type = $5 THEN 0 ELSE 1 END AS rack_type_penalty
    FROM shelf_slots ss
    JOIN racks r ON r.id = ss.rack_id
    WHERE ss.current_count < ss.capacity
    ORDER BY rack_priority ASC, rack_type_penalty ASC, display_distance ASC, cell_distance ASC, r.display_order ASC, ss.row_number ASC, ss.column_number ASC
    LIMIT 1
  `, [targetRackId, targetDisplayOrder, targetRow, targetColumn, targetRackType]);

  if (result.rows.length === 0) return null;

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
