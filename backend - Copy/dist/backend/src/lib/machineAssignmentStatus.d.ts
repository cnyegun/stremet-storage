declare const MACHINE_ASSIGNMENT_STATUSES: readonly ["queued", "processing", "needs_attention", "ready_for_storage"];
type MachineAssignmentStatus = (typeof MACHINE_ASSIGNMENT_STATUSES)[number];
export declare function getDefaultMachineAssignmentStatus(): MachineAssignmentStatus;
export declare function assertMachineAssignmentStatus(status: string): MachineAssignmentStatus;
export declare function buildMachineStatusChangeNote(previousStatus: MachineAssignmentStatus, nextStatus: MachineAssignmentStatus, notes?: string | null): string;
export type { MachineAssignmentStatus };
