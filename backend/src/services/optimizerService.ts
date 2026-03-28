// backend/src/services/optimizerService.ts

/**
 * Logistical Flow Optimizer for Stremet Storage System
 * 
 * Flow Logic:
 * - PRODUCTION (Left Side): Low X-Coordinates
 * - DELIVERY DOORS (Right Side): High X-Coordinates
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
  rack_type: 'raw_materials' | 'work_in_progress' | 'finished_goods' | 'customer_orders' | 'general_stock';
  zone_x: number;
  zone_y: number;
}

export interface Item {
  type: 'customer_order' | 'general_stock' | 'raw_material' | 'work_in_progress';
  weight_kg: number;
  turnover_class: 'A' | 'B' | 'C';
  quantity: number;
  is_stackable: boolean;
  delivery_date?: string; // ISO String
}

export class OptimizerService {
  private static calculateDistance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.abs(x1 - x2) + Math.abs(y1 - y2);
  }

  /**
   * Scores a storage slot. Lower score is better.
   */
  public static scoreSlot(slot: Slot, item: Item): number {
    let score = 0;

    // --- 1. Hard Logistical Segregation ---
    // Finished goods must NOT go in Raw zones and vice-versa (Score Penalty)
    if (item.type === 'customer_order' && slot.rack_type === 'raw_materials') score += 500;
    if (item.type === 'raw_material' && slot.rack_type === 'customer_orders') score += 500;

    // --- 2. Production Side Logic (Left-Side Bias) ---
    // Raw and Interim (WIP) items want low X coordinates (Closer to Production line)
    if (item.type === 'raw_material' || item.type === 'work_in_progress') {
        // Lower X is better. Penalty for high X.
        score += (slot.zone_x * 0.5); 
    }

    // --- 3. Delivery Logic (Right-Side & Column Bias) ---
    // Finished/Customer Orders want high X coordinates (Closer to Delivery Doors)
    if (item.type === 'customer_order' && item.delivery_date) {
        const now = new Date();
        const delivery = new Date(item.delivery_date);
        const daysToDelivery = Math.max(0, (delivery.getTime() - now.getTime()) / (1000 * 3600 * 24));
        
        // Urgency weight (1 = very urgent, 0 = far in future)
        const urgency = 1 / (daysToDelivery + 1);

        // High X is better. Penalty for Low X (Away from doors).
        const maxX = 1000; // Expected factory width
        score += (maxX - slot.zone_x) * urgency * 1.5;

        // Front-Back Logic (Column)
        // High Column Number (Front of rack) for urgent items
        const maxColumn = 10;
        score += (maxColumn - slot.column_number) * urgency * 10;
    }

    // --- 4. Ergonomics (Z-Axis / Row) ---
    const goldenRows = [2, 3];
    if (item.turnover_class === 'A' && !goldenRows.includes(slot.row_number)) {
      score += 100;
    }

    // --- 5. Structural Safety (Weight & Scale) ---
    if (item.weight_kg > 25 && slot.row_number > 2) {
      score += (slot.row_number * 30);
    }

    // Density check (Favor filling up partially full slots)
    const utilization = (slot.current_count + item.quantity) / slot.capacity;
    score -= (utilization * 20);

    return score;
  }
}
