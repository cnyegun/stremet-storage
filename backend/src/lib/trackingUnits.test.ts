import { describe, expect, it } from 'vitest';
import {
  buildTrackingUnitCode,
  buildTrackingUnitMoveNote,
  getNextTrackingUnitCode,
  resolveMoveQuantity,
  sanitizeTrackingUnitPrefix,
} from './trackingUnits';
import {
  assertMachineAssignmentStatus,
  buildMachineStatusChangeNote,
  getDefaultMachineAssignmentStatus,
} from './machineAssignmentStatus';

describe('sanitizeTrackingUnitPrefix', () => {
  it('keeps uppercase letters, digits, and single dashes', () => {
    expect(sanitizeTrackingUnitPrefix('stk-033-control-panel')).toBe('STK-033-CONTROL');
  });

  it('collapses spaces and punctuation into single dashes', () => {
    expect(sanitizeTrackingUnitPrefix('Valm 003 / flange   b')).toBe('VALM-003-FLANGE');
  });

  it('falls back to UNIT when no usable characters exist', () => {
    expect(sanitizeTrackingUnitPrefix('---___***')).toBe('UNIT');
  });
});

describe('buildTrackingUnitCode', () => {
  it('builds a padded tracking unit code from item code and sequence', () => {
    expect(buildTrackingUnitCode('STK-033-CONTROL-PANEL', 1)).toBe('STK-033-CONTROL-U001');
  });

  it('trims overly long prefixes to keep unit codes compact', () => {
    expect(buildTrackingUnitCode('VERY-LONG-CUSTOMER-ITEM-CODE-12345', 12)).toBe('VERY-LONG-CUSTOM-U012');
  });
});

describe('getNextTrackingUnitCode', () => {
  it('starts from sequence one when no prior units exist', () => {
    expect(getNextTrackingUnitCode('STK-033-CONTROL-PANEL', [])).toBe('STK-033-CONTROL-U001');
  });

  it('increments from the highest sequence for the same item prefix', () => {
    expect(
      getNextTrackingUnitCode('STK-033-CONTROL-PANEL', [
        'STK-033-CONTROL-U001',
        'STK-033-CONTROL-U002',
        'OTHER-UNIT-U999',
      ]),
    ).toBe('STK-033-CONTROL-U003');
  });

  it('stays unique when another item shares the same sanitized prefix', () => {
    expect(
      getNextTrackingUnitCode('STK-033-CONTROL-PLATE', [
        'STK-033-CONTROL-U001',
        'STK-033-CONTROL-U002',
      ]),
    ).toBe('STK-033-CONTROL-U003');
  });

  it('ignores malformed existing unit codes', () => {
    expect(
      getNextTrackingUnitCode('STK-033-CONTROL-PANEL', ['STK-033-CONTROL', 'STK-033-CONTROL-UABC']),
    ).toBe('STK-033-CONTROL-U001');
  });
});

describe('resolveMoveQuantity', () => {
  it('uses the full quantity when no specific amount is requested', () => {
    expect(resolveMoveQuantity(12)).toEqual({
      moveQuantity: 12,
      remainingQuantity: 0,
      isPartial: false,
    });
  });

  it('treats an exact move as non-partial', () => {
    expect(resolveMoveQuantity(12, 12)).toEqual({
      moveQuantity: 12,
      remainingQuantity: 0,
      isPartial: false,
    });
  });

  it('returns partial move metadata when moving less than available', () => {
    expect(resolveMoveQuantity(12, 5)).toEqual({
      moveQuantity: 5,
      remainingQuantity: 7,
      isPartial: true,
    });
  });

  it('rejects non-integer quantities', () => {
    expect(() => resolveMoveQuantity(12, 2.5)).toThrow('Quantity must be a positive integer');
  });

  it('rejects zero or negative quantities', () => {
    expect(() => resolveMoveQuantity(12, 0)).toThrow('Quantity must be a positive integer');
    expect(() => resolveMoveQuantity(12, -1)).toThrow('Quantity must be a positive integer');
  });

  it('rejects quantities above the available amount', () => {
    expect(() => resolveMoveQuantity(12, 13)).toThrow('Cannot move 13 — only 12 available');
  });
});

describe('buildTrackingUnitMoveNote', () => {
  it('describes partial moves clearly', () => {
    expect(buildTrackingUnitMoveNote(5, 12)).toBe('Split 5 from unit of 12');
  });

  it('appends user notes for partial moves', () => {
    expect(buildTrackingUnitMoveNote(5, 12, 'Staging for shipment')).toBe('Split 5 from unit of 12. Staging for shipment');
  });

  it('passes through notes for full moves', () => {
    expect(buildTrackingUnitMoveNote(12, 12, 'Sent to machine')).toBe('Sent to machine');
  });

  it('returns null for full moves without notes', () => {
    expect(buildTrackingUnitMoveNote(12, 12)).toBeNull();
  });
});

describe('machine assignment status helpers', () => {
  it('uses queued as the default machine assignment status', () => {
    expect(getDefaultMachineAssignmentStatus()).toBe('queued');
  });

  it('accepts all supported statuses', () => {
    expect(assertMachineAssignmentStatus('queued')).toBe('queued');
    expect(assertMachineAssignmentStatus('processing')).toBe('processing');
    expect(assertMachineAssignmentStatus('needs_attention')).toBe('needs_attention');
    expect(assertMachineAssignmentStatus('ready_for_storage')).toBe('ready_for_storage');
  });

  it('rejects unknown statuses', () => {
    expect(() => assertMachineAssignmentStatus('broken')).toThrow('Invalid machine assignment status');
  });

  it('builds a readable note for status changes', () => {
    expect(buildMachineStatusChangeNote('queued', 'needs_attention')).toBe('Machine status changed from queued to needs_attention');
    expect(buildMachineStatusChangeNote('queued', 'processing', 'Started cutting')).toBe('Machine status changed from queued to processing. Started cutting');
  });
});
