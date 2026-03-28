"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const trackingUnits_1 = require("./trackingUnits");
const machineAssignmentStatus_1 = require("./machineAssignmentStatus");
(0, vitest_1.describe)('sanitizeTrackingUnitPrefix', () => {
    (0, vitest_1.it)('keeps uppercase letters, digits, and single dashes', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.sanitizeTrackingUnitPrefix)('stk-033-control-panel')).toBe('STK-033-CONTROL');
    });
    (0, vitest_1.it)('collapses spaces and punctuation into single dashes', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.sanitizeTrackingUnitPrefix)('Valm 003 / flange   b')).toBe('VALM-003-FLANGE');
    });
    (0, vitest_1.it)('falls back to UNIT when no usable characters exist', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.sanitizeTrackingUnitPrefix)('---___***')).toBe('UNIT');
    });
});
(0, vitest_1.describe)('buildTrackingUnitCode', () => {
    (0, vitest_1.it)('builds a padded tracking unit code from item code and sequence', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.buildTrackingUnitCode)('STK-033-CONTROL-PANEL', 1)).toBe('STK-033-CONTROL-U001');
    });
    (0, vitest_1.it)('trims overly long prefixes to keep unit codes compact', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.buildTrackingUnitCode)('VERY-LONG-CUSTOMER-ITEM-CODE-12345', 12)).toBe('VERY-LONG-CUSTOM-U012');
    });
});
(0, vitest_1.describe)('getNextTrackingUnitCode', () => {
    (0, vitest_1.it)('starts from sequence one when no prior units exist', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.getNextTrackingUnitCode)('STK-033-CONTROL-PANEL', [])).toBe('STK-033-CONTROL-U001');
    });
    (0, vitest_1.it)('increments from the highest sequence for the same item prefix', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.getNextTrackingUnitCode)('STK-033-CONTROL-PANEL', [
            'STK-033-CONTROL-U001',
            'STK-033-CONTROL-U002',
            'OTHER-UNIT-U999',
        ])).toBe('STK-033-CONTROL-U003');
    });
    (0, vitest_1.it)('stays unique when another item shares the same sanitized prefix', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.getNextTrackingUnitCode)('STK-033-CONTROL-PLATE', [
            'STK-033-CONTROL-U001',
            'STK-033-CONTROL-U002',
        ])).toBe('STK-033-CONTROL-U003');
    });
    (0, vitest_1.it)('ignores malformed existing unit codes', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.getNextTrackingUnitCode)('STK-033-CONTROL-PANEL', ['STK-033-CONTROL', 'STK-033-CONTROL-UABC'])).toBe('STK-033-CONTROL-U001');
    });
});
(0, vitest_1.describe)('resolveMoveQuantity', () => {
    (0, vitest_1.it)('uses the full quantity when no specific amount is requested', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.resolveMoveQuantity)(12)).toEqual({
            moveQuantity: 12,
            remainingQuantity: 0,
            isPartial: false,
        });
    });
    (0, vitest_1.it)('treats an exact move as non-partial', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.resolveMoveQuantity)(12, 12)).toEqual({
            moveQuantity: 12,
            remainingQuantity: 0,
            isPartial: false,
        });
    });
    (0, vitest_1.it)('returns partial move metadata when moving less than available', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.resolveMoveQuantity)(12, 5)).toEqual({
            moveQuantity: 5,
            remainingQuantity: 7,
            isPartial: true,
        });
    });
    (0, vitest_1.it)('rejects non-integer quantities', () => {
        (0, vitest_1.expect)(() => (0, trackingUnits_1.resolveMoveQuantity)(12, 2.5)).toThrow('Quantity must be a positive integer');
    });
    (0, vitest_1.it)('rejects zero or negative quantities', () => {
        (0, vitest_1.expect)(() => (0, trackingUnits_1.resolveMoveQuantity)(12, 0)).toThrow('Quantity must be a positive integer');
        (0, vitest_1.expect)(() => (0, trackingUnits_1.resolveMoveQuantity)(12, -1)).toThrow('Quantity must be a positive integer');
    });
    (0, vitest_1.it)('rejects quantities above the available amount', () => {
        (0, vitest_1.expect)(() => (0, trackingUnits_1.resolveMoveQuantity)(12, 13)).toThrow('Cannot move 13 — only 12 available');
    });
});
(0, vitest_1.describe)('buildTrackingUnitMoveNote', () => {
    (0, vitest_1.it)('describes partial moves clearly', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.buildTrackingUnitMoveNote)(5, 12)).toBe('Split 5 from unit of 12');
    });
    (0, vitest_1.it)('appends user notes for partial moves', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.buildTrackingUnitMoveNote)(5, 12, 'Staging for shipment')).toBe('Split 5 from unit of 12. Staging for shipment');
    });
    (0, vitest_1.it)('passes through notes for full moves', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.buildTrackingUnitMoveNote)(12, 12, 'Sent to machine')).toBe('Sent to machine');
    });
    (0, vitest_1.it)('returns null for full moves without notes', () => {
        (0, vitest_1.expect)((0, trackingUnits_1.buildTrackingUnitMoveNote)(12, 12)).toBeNull();
    });
});
(0, vitest_1.describe)('machine assignment status helpers', () => {
    (0, vitest_1.it)('uses queued as the default machine assignment status', () => {
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.getDefaultMachineAssignmentStatus)()).toBe('queued');
    });
    (0, vitest_1.it)('accepts all supported statuses', () => {
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.assertMachineAssignmentStatus)('queued')).toBe('queued');
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.assertMachineAssignmentStatus)('processing')).toBe('processing');
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.assertMachineAssignmentStatus)('needs_attention')).toBe('needs_attention');
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.assertMachineAssignmentStatus)('ready_for_storage')).toBe('ready_for_storage');
    });
    (0, vitest_1.it)('rejects unknown statuses', () => {
        (0, vitest_1.expect)(() => (0, machineAssignmentStatus_1.assertMachineAssignmentStatus)('broken')).toThrow('Invalid machine assignment status');
    });
    (0, vitest_1.it)('builds a readable note for status changes', () => {
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.buildMachineStatusChangeNote)('queued', 'needs_attention')).toBe('Machine status changed from queued to needs_attention');
        (0, vitest_1.expect)((0, machineAssignmentStatus_1.buildMachineStatusChangeNote)('queued', 'processing', 'Started cutting')).toBe('Machine status changed from queued to processing. Started cutting');
    });
});
