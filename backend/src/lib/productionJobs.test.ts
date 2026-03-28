import { describe, expect, it } from 'vitest';
import {
  assertProductionJobStatus,
  assertProductionOutputOutcome,
  buildProductionActivityNote,
  buildProductionJobCode,
  summarizeProductionOutputs,
  validateProductionCompletion,
} from './productionJobs';

describe('production job helpers', () => {
  it('builds incrementing machine job codes', () => {
    expect(buildProductionJobCode('CUT-1', 1)).toBe('CUT-1-J001');
    expect(buildProductionJobCode('BEND-4', 12)).toBe('BEND-4-J012');
  });

  it('validates production job statuses', () => {
    expect(assertProductionJobStatus('draft')).toBe('draft');
    expect(assertProductionJobStatus('in_progress')).toBe('in_progress');
    expect(() => assertProductionJobStatus('done')).toThrow('Invalid production job status');
  });

  it('validates output outcomes', () => {
    expect(assertProductionOutputOutcome('good')).toBe('good');
    expect(assertProductionOutputOutcome('hold')).toBe('hold');
    expect(() => assertProductionOutputOutcome('broken')).toThrow('Invalid production output outcome');
  });

  it('rejects production completion with no outputs', () => {
    expect(() => validateProductionCompletion([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [])).toThrow(
      'At least one output is required',
    );
  });

  it('rejects when no input quantity is consumed', () => {
    expect(() => validateProductionCompletion([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 0 }], [{ outcome: 'good', quantity: 1 }])).toThrow(
      'Consumed quantity must be a positive integer',
    );
  });

  it('rejects overconsumption from an input unit', () => {
    expect(() => validateProductionCompletion([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 3 }], [{ outcome: 'good', quantity: 1 }])).toThrow(
      'Cannot consume 3 from input with only 2 available',
    );
  });

  it('rejects zero-quantity outputs', () => {
    expect(() => validateProductionCompletion([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [{ outcome: 'good', quantity: 0 }])).toThrow(
      'Output quantity must be a positive integer',
    );
  });

  it('requires storage outputs to have a destination', () => {
    expect(() => validateProductionCompletion([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [{ outcome: 'good', quantity: 1, destination_type: 'storage' }])).toThrow(
      'Storage outputs require a shelf slot destination',
    );
  });

  it('allows scrap outputs without a destination', () => {
    expect(
      validateProductionCompletion(
        [{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }],
        [{ outcome: 'scrap', quantity: 1, destination_type: 'none' }],
      ),
    ).toEqual({
      totalConsumed: 2,
      totalProduced: 1,
    });
  });

  it('summarizes outputs by outcome', () => {
    expect(
      summarizeProductionOutputs([
        { outcome: 'good', quantity: 2 },
        { outcome: 'scrap', quantity: 1 },
        { outcome: 'good', quantity: 3 },
      ]),
    ).toBe('Good: 5 pcs, Scrap: 1 pcs');
  });

  it('builds readable production activity notes', () => {
    expect(buildProductionActivityNote('CUT-1-J001', 'Completed good output')).toBe('Job CUT-1-J001: Completed good output');
  });
});
