"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultMachineAssignmentStatus = getDefaultMachineAssignmentStatus;
exports.assertMachineAssignmentStatus = assertMachineAssignmentStatus;
exports.buildMachineStatusChangeNote = buildMachineStatusChangeNote;
const MACHINE_ASSIGNMENT_STATUSES = ['queued', 'processing', 'needs_attention', 'ready_for_storage'];
function getDefaultMachineAssignmentStatus() {
    return 'queued';
}
function assertMachineAssignmentStatus(status) {
    if (!MACHINE_ASSIGNMENT_STATUSES.includes(status)) {
        throw new Error('Invalid machine assignment status');
    }
    return status;
}
function buildMachineStatusChangeNote(previousStatus, nextStatus, notes) {
    return notes
        ? `Machine status changed from ${previousStatus} to ${nextStatus}. ${notes}`
        : `Machine status changed from ${previousStatus} to ${nextStatus}`;
}
