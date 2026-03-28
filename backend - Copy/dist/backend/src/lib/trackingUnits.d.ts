export declare function sanitizeTrackingUnitPrefix(itemCode: string): string;
export declare function buildTrackingUnitCode(itemCode: string, sequence: number): string;
export declare function getNextTrackingUnitCode(itemCode: string, existingCodes: string[]): string;
export declare function resolveMoveQuantity(totalQuantity: number, requestedQuantity?: number): {
    moveQuantity: number;
    remainingQuantity: number;
    isPartial: boolean;
};
export declare function buildTrackingUnitMoveNote(moveQuantity: number, totalQuantity: number, notes?: string | null): string | null;
