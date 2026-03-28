// backend/src/services/weightVerificationService.ts
import pool from '../db/pool';

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

export class WeightVerificationService {
  /**
   * Identifies storage cells where sensors detect weight anomalies.
   */
  public static async getDiscrepancyReport(): Promise<WeightDiscrepancy[]> {
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

    const result = await pool.query(query);

    return result.rows.map(row => {
      const diff = Number(row.measured_weight) - Number(row.calculated_weight);
      let status: 'MATCH' | 'MANUFACTURING_ERROR_OR_MISSING_PART' | 'DUPLICATE_ITEM_DETECTED' = 'MATCH';

      if (diff < -row.threshold) {
          status = 'MANUFACTURING_ERROR_OR_MISSING_PART';
      } else if (diff > row.threshold) {
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

  public static async updateSensorReading(cellId: string, measuredWeight: number): Promise<void> {
    await pool.query(
      'UPDATE shelf_slots SET measured_weight_kg = $1, last_measured_at = NOW() WHERE id = $2',
      [measuredWeight, cellId]
    );
  }
}
