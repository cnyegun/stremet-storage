import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { getNextTrackingUnitCode } from './trackingUnits';

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

export function buildAssemblyCode(itemCode: string, existingCodes: string[]) {
  const prefix = itemCode.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 16).replace(/-$/g, '') || 'ASSEMBLY';
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

  await client.query(
    `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_by, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [assignmentId, params.item_id, params.shelf_slot_id, unitCode, params.quantity, params.performed_by, params.notes || null],
  );
  await client.query('UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1', [params.shelf_slot_id]);

  return { assignmentId, unitCode };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
