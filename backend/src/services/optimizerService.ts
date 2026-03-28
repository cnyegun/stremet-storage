// backend/src/services/optimizerService.ts

/**
 * Optimizer Service for Stremet Storage System (Modified Dataset Version)
 */

export interface Slot {
  shelf_slot_id: string;
  rack_id: string;
  row_number: number;
  column_number: number;
  capacity: number;
  current_count: number;
  current_weight_kg: number;
  max_weight_kg: number;
  max_height: number;
  rack_code: string;
  rack_type: string;
  zone_x: number;
  zone_y: number;
}

export interface Item {
  weight_kg: number;
  turnover_class: 'A' | 'B' | 'C';
  quantity: number;
  is_stackable: boolean;
}

export class OptimizerService {
  /**
   * Calculates factory distance using Manhattan formula (Aisle-based movement).
   */
  private static calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  /**
   * Scores a storage slot. Lower score is better.
   */
  public static scoreSlot(
    slot: Slot, 
    item: Item, 
    origin?: { x: number, y: number }, 
    destination?: { x: number, y: number }
  ): number {
    let score = 0;

    // 1. Ergonomics: Class A items (high frequency) must be at waist/shoulder height
    // Row 2 and 3 are optimal for manual picking.
    const goldenRows = [2, 3];
    if (item.turnover_class === 'A' && !goldenRows.includes(slot.row_number)) {
      score += 150; 
    }

    // 2. Safety: Heavy items (>25kg) should stay on bottom rows (Row 1 or 2)
    if (item.weight_kg > 25 && slot.row_number > 2) {
      score += (slot.row_number * 40); 
    }

    // 3. Routing Optimization (Factory Travel)
    if (destination) {
      const distToNext = this.calculateDistance(slot.zone_x, slot.zone_y, destination.x, destination.y);
      score += (distToNext * 0.7);
    }

    if (origin) {
      const distFromOrigin = this.calculateDistance(slot.zone_x, slot.zone_y, origin.x, origin.y);
      score += (distFromOrigin * 0.3);
    }

    // 4. Density & Scale Utilization
    const countUtilization = (slot.current_count + item.quantity) / slot.capacity;
    const weightUtilization = (slot.current_weight_kg + (item.weight_kg * item.quantity)) / slot.max_weight_kg;
    
    const densityScore = (countUtilization + weightUtilization) / 2;
    score -= (densityScore * 30); 

    return score;
  }
}
