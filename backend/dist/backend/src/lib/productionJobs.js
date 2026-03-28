"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildProductionJobCode = buildProductionJobCode;
exports.assertProductionJobStatus = assertProductionJobStatus;
exports.assertProductionOutputOutcome = assertProductionOutputOutcome;
exports.validateProductionCompletion = validateProductionCompletion;
exports.summarizeProductionOutputs = summarizeProductionOutputs;
exports.buildProductionActivityNote = buildProductionActivityNote;
const PRODUCTION_JOB_STATUSES = ['draft', 'in_progress', 'completed', 'cancelled'];
const PRODUCTION_OUTPUT_OUTCOMES = ['good', 'scrap', 'rework', 'hold'];
function buildProductionJobCode(machineCode, sequence) {
    return `${machineCode}-J${String(sequence).padStart(3, '0')}`;
}
function assertProductionJobStatus(status) {
    if (!PRODUCTION_JOB_STATUSES.includes(status)) {
        throw new Error('Invalid production job status');
    }
    return status;
}
function assertProductionOutputOutcome(outcome) {
    if (!PRODUCTION_OUTPUT_OUTCOMES.includes(outcome)) {
        throw new Error('Invalid production output outcome');
    }
    return outcome;
}
function validateProductionCompletion(inputs, outputs) {
    if (outputs.length === 0) {
        throw new Error('At least one output is required');
    }
    let totalConsumed = 0;
    for (const input of inputs) {
        if (!Number.isInteger(input.consumed_quantity) || input.consumed_quantity <= 0) {
            throw new Error('Consumed quantity must be a positive integer');
        }
        if (input.consumed_quantity > input.available_quantity) {
            throw new Error(`Cannot consume ${input.consumed_quantity} from input with only ${input.available_quantity} available`);
        }
        totalConsumed += input.consumed_quantity;
    }
    let totalProduced = 0;
    for (const output of outputs) {
        const outcome = assertProductionOutputOutcome(output.outcome);
        if (!Number.isInteger(output.quantity) || output.quantity <= 0) {
            throw new Error('Output quantity must be a positive integer');
        }
        if (output.destination_type === 'storage' && !output.shelf_slot_id) {
            throw new Error('Storage outputs require a shelf slot destination');
        }
        if (output.destination_type === 'machine' && !output.machine_id) {
            throw new Error('Machine outputs require a machine destination');
        }
        if (outcome === 'good' && output.destination_type === 'none') {
            throw new Error('Good outputs must have a destination');
        }
        totalProduced += output.quantity;
    }
    return { totalConsumed, totalProduced };
}
function summarizeProductionOutputs(outputs) {
    const totals = new Map();
    for (const output of outputs) {
        totals.set(output.outcome, (totals.get(output.outcome) || 0) + output.quantity);
    }
    const parts = [];
    for (const [outcome, quantity] of totals.entries()) {
        parts.push(`${capitalize(outcome)}: ${quantity} pcs`);
    }
    return parts.join(', ');
}
function buildProductionActivityNote(jobCode, text) {
    return `Job ${jobCode}: ${text}`;
}
function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}
