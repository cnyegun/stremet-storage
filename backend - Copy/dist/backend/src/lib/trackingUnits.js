"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeTrackingUnitPrefix = sanitizeTrackingUnitPrefix;
exports.buildTrackingUnitCode = buildTrackingUnitCode;
exports.getNextTrackingUnitCode = getNextTrackingUnitCode;
exports.resolveMoveQuantity = resolveMoveQuantity;
exports.buildTrackingUnitMoveNote = buildTrackingUnitMoveNote;
const TRACKING_UNIT_PREFIX_LENGTH = 16;
function sanitizeTrackingUnitPrefix(itemCode) {
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
function buildTrackingUnitCode(itemCode, sequence) {
    return `${sanitizeTrackingUnitPrefix(itemCode)}-U${String(sequence).padStart(3, '0')}`;
}
function getNextTrackingUnitCode(itemCode, existingCodes) {
    const prefix = sanitizeTrackingUnitPrefix(itemCode);
    const pattern = new RegExp(`^${escapeRegExp(prefix)}-U(\\d+)$`);
    const sequences = existingCodes
        .map((code) => code.match(pattern))
        .filter((match) => Boolean(match))
        .map((match) => Number(match[1]))
        .filter((value) => Number.isInteger(value) && value > 0);
    const nextSequence = sequences.length > 0 ? Math.max(...sequences) + 1 : 1;
    return `${prefix}-U${String(nextSequence).padStart(3, '0')}`;
}
function resolveMoveQuantity(totalQuantity, requestedQuantity) {
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
function buildTrackingUnitMoveNote(moveQuantity, totalQuantity, notes) {
    if (moveQuantity < totalQuantity) {
        return notes ? `Split ${moveQuantity} from unit of ${totalQuantity}. ${notes}` : `Split ${moveQuantity} from unit of ${totalQuantity}`;
    }
    return notes || null;
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
