import type { PoolClient } from 'pg';

type AssemblySourceRow = {
  storage_assignment_id: string;
  item_id: string;
  unit_code: string;
  quantity: number;
  shelf_slot_id: string;
  item_code: string;
};

export async function loadAssemblySources(
  client: PoolClient,
  sourceUnitCodes: string[],
  sourceAssignmentIds: string[],
) {
  if (sourceUnitCodes.length === 0 && sourceAssignmentIds.length === 0) {
    throw httpError(400, 'At least one source unit code or assignment id is required');
  }

  const result = await client.query<AssemblySourceRow>(`
    SELECT sa.id AS storage_assignment_id, sa.item_id, sa.unit_code, sa.quantity, sa.shelf_slot_id, i.item_code
    FROM storage_assignments sa
    JOIN items i ON i.id = sa.item_id
    WHERE sa.checked_out_at IS NULL
      AND (
        sa.unit_code = ANY($1::text[])
        OR sa.id::text = ANY($2::text[])
      )
    FOR UPDATE OF sa
  `, [sourceUnitCodes, sourceAssignmentIds]);

  if (result.rows.length === 0) {
    throw httpError(404, 'No active source storage units found');
  }

  const first = result.rows[0];
  const mixedItem = result.rows.some((row) => row.item_id !== first.item_id);
  if (mixedItem) {
    throw httpError(400, 'Assembly compilation requires source units from the same item');
  }

  return {
    rows: result.rows,
    first,
    totalQuantity: result.rows.reduce((sum, row) => sum + Number(row.quantity), 0),
  };
}

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}
