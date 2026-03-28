import type { PoolClient } from 'pg';

export async function getExistingTrackingUnitCodes(client: PoolClient): Promise<string[]> {
  const result = await client.query(`
    SELECT unit_code FROM storage_assignments
    UNION
    SELECT unit_code FROM machine_assignments
  `);
  return result.rows.map((row) => row.unit_code);
}

const TRACKING_UNIT_PREFIX_LENGTH = 16;

export function sanitizeTrackingUnitPrefix(itemCode: string): string {
  const normalized = itemCode
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  if (!normalized) {
    return 'UNIT';
  }

  return normalized.slice(0, TRACKING_UNIT_PREFIX_LENGTH).replace(/-$/g, '') || 'UNIT';
}

export function buildTrackingUnitCode(itemCode: string, sequence: number): string {
  return `${sanitizeTrackingUnitPrefix(itemCode)}-U${String(sequence).padStart(3, '0')}`;
}

export function getNextTrackingUnitCode(itemCode: string, existingCodes: string[]): string {
  const prefix = sanitizeTrackingUnitPrefix(itemCode);
  const pattern = new RegExp(`^${escapeRegExp(prefix)}-U(\\d+)$`);
  const sequences = existingCodes
    .map((code) => code.match(pattern))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value) && value > 0);

  const nextSequence = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
  return `${prefix}-U${String(nextSequence).padStart(3, '0')}`;
}

export function resolveMoveQuantity(totalQuantity: number, requestedQuantity?: number) {
  const moveQuantity = requestedQuantity ?? totalQuantity;

  if (!Number.isInteger(moveQuantity) || moveQuantity <= 0) {
    throw new Error('Quantity must be a positive integer');
  }

  if (moveQuantity > totalQuantity) {
    throw new Error(`Cannot move ${moveQuantity} — only ${totalQuantity} available`);
  }

  return {
    moveQuantity,
    remainingQuantity: totalQuantity - moveQuantity,
    isPartial: moveQuantity < totalQuantity,
  };
}

export function buildTrackingUnitMoveNote(moveQuantity: number, totalQuantity: number, notes?: string | null) {
  if (moveQuantity < totalQuantity) {
    return notes ? `Split ${moveQuantity} from unit of ${totalQuantity}. ${notes}` : `Split ${moveQuantity} from unit of ${totalQuantity}`;
  }

  return notes || null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
