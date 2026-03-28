"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WeightVerificationService = void 0;
// backend/src/services/weightVerificationService.ts
const pool_1 = __importDefault(require("../db/pool"));
class WeightVerificationService {
    /**
     * Identifies storage cells where sensors detect weight anomalies.
     */
    static async getDiscrepancyReport() {
        const query = `
      SELECT 
        ss.id as cell_id,
        r.code as rack_code,
        ss.row_number,
        ss.column_number,
        ss.current_weight_kg as calculated_weight,
        ss.measured_weight_kg as measured_weight,
        ss.weight_discrepancy_threshold as threshold
      FROM shelf_slots ss
      JOIN racks r ON ss.rack_id = r.id
      WHERE ABS(ss.current_weight_kg - ss.measured_weight_kg) > ss.weight_discrepancy_threshold;
    `;
        const result = await pool_1.default.query(query);
        return result.rows.map(row => {
            const diff = Number(row.measured_weight) - Number(row.calculated_weight);
            let status = 'MATCH';
            if (diff < -row.threshold) {
                status = 'MANUFACTURING_ERROR_OR_MISSING_PART';
            }
            else if (diff > row.threshold) {
                status = 'DUPLICATE_ITEM_DETECTED';
            }
            return {
                cell_id: row.cell_id,
                rack_code: row.rack_code,
                row_number: row.row_number,
                column_number: row.column_number,
                calculated_weight: Number(row.calculated_weight),
                measured_weight: Number(row.measured_weight),
                discrepancy: Number(diff.toFixed(2)),
                status
            };
        });
    }
    static async updateSensorReading(cellId, measuredWeight) {
        await pool_1.default.query('UPDATE shelf_slots SET measured_weight_kg = $1, last_measured_at = NOW() WHERE id = $2', [measuredWeight, cellId]);
    }
}
exports.WeightVerificationService = WeightVerificationService;
