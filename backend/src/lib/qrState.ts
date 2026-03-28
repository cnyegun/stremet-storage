import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';

export async function ensureOrderFulfillment(client: PoolClient, itemId: string) {
  await client.query(`
    INSERT INTO order_fulfillments (id, item_id, requested_quantity, fulfilled_quantity, status)
    SELECT $1, i.id, i.quantity, 0, 'active'
    FROM items i
    WHERE i.id = $2
    ON CONFLICT (item_id) DO UPDATE
    SET requested_quantity = EXCLUDED.requested_quantity,
        updated_at = NOW()
  `, [uuidv4(), itemId]);

  const result = await client.query('SELECT * FROM order_fulfillments WHERE item_id = $1', [itemId]);
  return result.rows[0];
}

export async function upsertQrEntity(client: PoolClient, params: {
  qr_code: string;
  qr_type: 'product' | 'assembly';
  item_id?: string | null;
  storage_assignment_id?: string | null;
  machine_assignment_id?: string | null;
  assembly_batch_id?: string | null;
}) {
  const existing = await client.query('SELECT id FROM qr_entities WHERE qr_code = $1', [params.qr_code]);

  if (existing.rows.length > 0) {
    await client.query(`
      UPDATE qr_entities
      SET qr_type = $2,
          item_id = $3,
          storage_assignment_id = $4,
          machine_assignment_id = $5,
          assembly_batch_id = $6,
          status = 'active',
          retired_at = NULL
      WHERE qr_code = $1
    `, [
      params.qr_code,
      params.qr_type,
      params.item_id || null,
      params.storage_assignment_id || null,
      params.machine_assignment_id || null,
      params.assembly_batch_id || null,
    ]);
    return;
  }

  await client.query(`
    INSERT INTO qr_entities (
      id,
      qr_code,
      qr_type,
      item_id,
      storage_assignment_id,
      machine_assignment_id,
      assembly_batch_id,
      status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
  `, [
    uuidv4(),
    params.qr_code,
    params.qr_type,
    params.item_id || null,
    params.storage_assignment_id || null,
    params.machine_assignment_id || null,
    params.assembly_batch_id || null,
  ]);
}

export async function retireProductQrEntities(client: PoolClient, unitCodes: string[]) {
  if (unitCodes.length === 0) return;

  await client.query(`
    UPDATE qr_entities
    SET status = 'retired',
        retired_at = NOW(),
        storage_assignment_id = NULL,
        machine_assignment_id = NULL
    WHERE qr_type = 'product'
      AND status = 'active'
      AND (
        storage_assignment_id IN (
          SELECT id FROM storage_assignments WHERE unit_code = ANY($1::text[])
        )
        OR machine_assignment_id IN (
          SELECT id FROM machine_assignments WHERE unit_code = ANY($1::text[])
        )
        OR qr_code = ANY($1::text[])
      )
  `, [unitCodes]);
}

export async function incrementFulfillment(client: PoolClient, itemId: string, quantity: number) {
  const result = await client.query(`
    UPDATE order_fulfillments
    SET fulfilled_quantity = fulfilled_quantity + $2,
        status = CASE
          WHEN fulfilled_quantity + $2 >= requested_quantity THEN 'quota_met'
          ELSE status
        END,
        updated_at = NOW()
    WHERE item_id = $1
    RETURNING *
  `, [itemId, quantity]);

  return result.rows[0] || null;
}

export async function retireAssemblyState(client: PoolClient, assemblyBatchId: string, performedBy: string) {
  const assignmentResult = await client.query(`
    SELECT aa.id, aa.shelf_slot_id
    FROM assembly_assignments aa
    WHERE aa.assembly_batch_id = $1 AND aa.removed_at IS NULL
    FOR UPDATE
  `, [assemblyBatchId]);

  if (assignmentResult.rows.length > 0) {
    const assignment = assignmentResult.rows[0];
    await client.query(`
      UPDATE assembly_assignments
      SET removed_at = NOW(),
          removed_by = $2
      WHERE id = $1
    `, [assignment.id, performedBy]);

    await client.query(`
      UPDATE shelf_slots
      SET current_count = GREATEST(current_count - 1, 0),
          updated_at = NOW()
      WHERE id = $1
    `, [assignment.shelf_slot_id]);
  }

  await client.query(`
    UPDATE assembly_batches
    SET status = 'quota_met',
        archived_at = NOW()
    WHERE id = $1
  `, [assemblyBatchId]);

  await client.query(`
    UPDATE qr_entities
    SET status = 'retired',
        retired_at = NOW()
    WHERE assembly_batch_id = $1
      AND qr_type = 'assembly'
      AND status = 'active'
  `, [assemblyBatchId]);
}
