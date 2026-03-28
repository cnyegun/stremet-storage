declare const PRODUCTION_JOB_STATUSES: readonly ["draft", "in_progress", "completed", "cancelled"];
declare const PRODUCTION_OUTPUT_OUTCOMES: readonly ["good", "scrap", "rework", "hold"];
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
export declare function buildProductionJobCode(machineCode: string, sequence: number): string;
export declare function assertProductionJobStatus(status: string): ProductionJobStatus;
export declare function assertProductionOutputOutcome(outcome: string): ProductionOutputOutcome;
export declare function validateProductionCompletion(inputs: InputDraft[], outputs: OutputDraft[]): {
    totalConsumed: number;
    totalProduced: number;
};
export declare function summarizeProductionOutputs(outputs: Array<{
    outcome: string;
    quantity: number;
}>): string;
export declare function buildProductionActivityNote(jobCode: string, text: string): string;
export type { ProductionJobStatus, ProductionOutputOutcome };
