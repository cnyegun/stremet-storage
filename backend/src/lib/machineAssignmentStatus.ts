const MACHINE_ASSIGNMENT_STATUSES = ['queued', 'processing', 'needs_attention', 'ready_for_storage'] as const;

type MachineAssignmentStatus = (typeof MACHINE_ASSIGNMENT_STATUSES)[number];

export function getDefaultMachineAssignmentStatus(): MachineAssignmentStatus {
  return 'queued';
}

export function assertMachineAssignmentStatus(status: string): MachineAssignmentStatus {
  if (!MACHINE_ASSIGNMENT_STATUSES.includes(status as MachineAssignmentStatus)) {
    throw new Error('Invalid machine assignment status');
  }

  return status as MachineAssignmentStatus;
}

export function buildMachineStatusChangeNote(previousStatus: MachineAssignmentStatus, nextStatus: MachineAssignmentStatus, notes?: string | null) {
  return notes
    ? `Machine status changed from ${previousStatus} to ${nextStatus}. ${notes}`
    : `Machine status changed from ${previousStatus} to ${nextStatus}`;
}

export type { MachineAssignmentStatus };
