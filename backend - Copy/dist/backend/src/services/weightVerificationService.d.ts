export interface WeightDiscrepancy {
    cell_id: string;
    rack_code: string;
    row_number: number;
    column_number: number;
    calculated_weight: number;
    measured_weight: number;
    discrepancy: number;
    status: 'MATCH' | 'MANUFACTURING_ERROR_OR_MISSING_PART' | 'DUPLICATE_ITEM_DETECTED';
}
export declare class WeightVerificationService {
    /**
     * Identifies storage cells where sensors detect weight anomalies.
     */
    static getDiscrepancyReport(): Promise<WeightDiscrepancy[]>;
    static updateSensorReading(cellId: string, measuredWeight: number): Promise<void>;
}
