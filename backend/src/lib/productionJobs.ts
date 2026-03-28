const PRODUCTION_JOB_STATUSES = ['draft', 'in_progress', 'completed', 'cancelled'] as const;
const PRODUCTION_OUTPUT_OUTCOMES = ['good', 'scrap', 'rework', 'hold'] as const;

type ProductionJobStatus = (typeof PRODUCTION_JOB_STATUSES)[number];
type ProductionOutputOutcome = (typeof PRODUCTION_OUTPUT_OUTCOMES)[number];

type InputDraft = {
  machine_assignment_id: string;
  available_quantity: number;
  consumed_quantity: number;
};

type OutputDraft = {
  outcome: string;
  quantity: number;
  destination_type?: 'storage' | 'machine' | 'none';
  shelf_slot_id?: string;
  machine_id?: string;
};

export function buildProductionJobCode(machineCode: string, sequence: number) {
  return `${machineCode}-J${String(sequence).padStart(3, '0')}`;
}

export function assertProductionJobStatus(status: string): ProductionJobStatus {
  if (!PRODUCTION_JOB_STATUSES.includes(status as ProductionJobStatus)) {
    throw new Error('Invalid production job status');
  }

  return status as ProductionJobStatus;
}

export function assertProductionOutputOutcome(outcome: string): ProductionOutputOutcome {
  if (!PRODUCTION_OUTPUT_OUTCOMES.includes(outcome as ProductionOutputOutcome)) {
    throw new Error('Invalid production output outcome');
  }

  return outcome as ProductionOutputOutcome;
}

export function validateProductionCompletion(inputs: InputDraft[], outputs: OutputDraft[]) {
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

export function summarizeProductionOutputs(outputs: Array<{ outcome: string; quantity: number }>) {
  const totals = new Map<string, number>();
  for (const output of outputs) {
    totals.set(output.outcome, (totals.get(output.outcome) || 0) + output.quantity);
  }

  const parts: string[] = [];
  for (const [outcome, quantity] of totals.entries()) {
    parts.push(`${capitalize(outcome)}: ${quantity} pcs`);
  }
  return parts.join(', ');
}

export function buildProductionActivityNote(jobCode: string, text: string) {
  return `Job ${jobCode}: ${text}`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type { ProductionJobStatus, ProductionOutputOutcome };
