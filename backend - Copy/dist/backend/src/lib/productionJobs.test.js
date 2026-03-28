"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const productionJobs_1 = require("./productionJobs");
(0, vitest_1.describe)('production job helpers', () => {
    (0, vitest_1.it)('builds incrementing machine job codes', () => {
        (0, vitest_1.expect)((0, productionJobs_1.buildProductionJobCode)('CUT-1', 1)).toBe('CUT-1-J001');
        (0, vitest_1.expect)((0, productionJobs_1.buildProductionJobCode)('BEND-4', 12)).toBe('BEND-4-J012');
    });
    (0, vitest_1.it)('validates production job statuses', () => {
        (0, vitest_1.expect)((0, productionJobs_1.assertProductionJobStatus)('draft')).toBe('draft');
        (0, vitest_1.expect)((0, productionJobs_1.assertProductionJobStatus)('in_progress')).toBe('in_progress');
        (0, vitest_1.expect)(() => (0, productionJobs_1.assertProductionJobStatus)('done')).toThrow('Invalid production job status');
    });
    (0, vitest_1.it)('validates output outcomes', () => {
        (0, vitest_1.expect)((0, productionJobs_1.assertProductionOutputOutcome)('good')).toBe('good');
        (0, vitest_1.expect)((0, productionJobs_1.assertProductionOutputOutcome)('hold')).toBe('hold');
        (0, vitest_1.expect)(() => (0, productionJobs_1.assertProductionOutputOutcome)('broken')).toThrow('Invalid production output outcome');
    });
    (0, vitest_1.it)('rejects production completion with no outputs', () => {
        (0, vitest_1.expect)(() => (0, productionJobs_1.validateProductionCompletion)([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [])).toThrow('At least one output is required');
    });
    (0, vitest_1.it)('rejects when no input quantity is consumed', () => {
        (0, vitest_1.expect)(() => (0, productionJobs_1.validateProductionCompletion)([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 0 }], [{ outcome: 'good', quantity: 1 }])).toThrow('Consumed quantity must be a positive integer');
    });
    (0, vitest_1.it)('rejects overconsumption from an input unit', () => {
        (0, vitest_1.expect)(() => (0, productionJobs_1.validateProductionCompletion)([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 3 }], [{ outcome: 'good', quantity: 1 }])).toThrow('Cannot consume 3 from input with only 2 available');
    });
    (0, vitest_1.it)('rejects zero-quantity outputs', () => {
        (0, vitest_1.expect)(() => (0, productionJobs_1.validateProductionCompletion)([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [{ outcome: 'good', quantity: 0 }])).toThrow('Output quantity must be a positive integer');
    });
    (0, vitest_1.it)('requires storage outputs to have a destination', () => {
        (0, vitest_1.expect)(() => (0, productionJobs_1.validateProductionCompletion)([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [{ outcome: 'good', quantity: 1, destination_type: 'storage' }])).toThrow('Storage outputs require a shelf slot destination');
    });
    (0, vitest_1.it)('allows scrap outputs without a destination', () => {
        (0, vitest_1.expect)((0, productionJobs_1.validateProductionCompletion)([{ machine_assignment_id: 'a', available_quantity: 2, consumed_quantity: 2 }], [{ outcome: 'scrap', quantity: 1, destination_type: 'none' }])).toEqual({
            totalConsumed: 2,
            totalProduced: 1,
        });
    });
    (0, vitest_1.it)('summarizes outputs by outcome', () => {
        (0, vitest_1.expect)((0, productionJobs_1.summarizeProductionOutputs)([
            { outcome: 'good', quantity: 2 },
            { outcome: 'scrap', quantity: 1 },
            { outcome: 'good', quantity: 3 },
        ])).toBe('Good: 5 pcs, Scrap: 1 pcs');
    });
    (0, vitest_1.it)('builds readable production activity notes', () => {
        (0, vitest_1.expect)((0, productionJobs_1.buildProductionActivityNote)('CUT-1-J001', 'Completed good output')).toBe('Job CUT-1-J001: Completed good output');
    });
});
