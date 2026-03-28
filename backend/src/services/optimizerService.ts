// backend/src/services/optimizerService.ts

/**
 * Tiered Optimizer for Stremet Storage System
 * 
 * Hierarchy:
 * 1. Logistical Flow (Primary) - Rack/Column based on Urgency/Type
 * 2. Physical Safety (Secondary) - Row based on Weight/Ergonomics
 */

export interface StorageCell {
  cell_id: string;
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
  display_order: number;
  position_x: number;
  position_y: number;
}

export interface Item {
  type: 'customer_order' | 'general_stock' | 'raw_material' | 'work_in_progress';
  weight_kg: number;
  turnover_class: 'A' | 'B' | 'C';
  quantity: number;
  is_stackable: boolean;
  delivery_date?: string;
}

export class OptimizerService {
  public static scoreSlot(cell: StorageCell, item: Item): number {
    // --- TIER 1: LOGISTICAL FLOW (Weight: 1000) ---
    // This decides which Rack and which Column the item belongs in.
    let flowScore = 0;

    // 1.1 Hard Zone Enforcement
    if (item.type === 'customer_order' && cell.rack_type === 'raw_materials') flowScore += 500;
    if (item.type === 'raw_material' && cell.rack_type === 'customer_orders') flowScore += 500;

    // 1.2 X-Axis Bias (Left-to-Right Flow)
    if (item.type === 'raw_material' || item.type === 'work_in_progress') {
        // Prioritize Rack 1 (Low X)
        flowScore += (cell.display_order * 50);
    } 
    else if (item.type === 'customer_order') {
        // Prioritize Final Rack (High X)
        const totalRacksEstimate = 10;
        flowScore += (Math.max(0, totalRacksEstimate - cell.display_order) * 50);

        // 1.3 Urgency-Driven Column Bias
        if (item.delivery_date) {
            const now = new Date();
            const delivery = new Date(item.delivery_date);
            const daysToDelivery = Math.max(0, (delivery.getTime() - now.getTime()) / (1000 * 3600 * 24));
            const urgency = 1 / (daysToDelivery + 1); // 1.0 for today, 0.1 for 10 days out
            
            // Higher column = front of rack. Urgent items MUST be in front.
            const maxColumn = 10;
            flowScore += (maxColumn - cell.column_number) * urgency * 100;
        }
    }

    // --- TIER 2: PHYSICAL SAFETY & ERGONOMICS (Weight: 1) ---
    // This decides which Row (Height) within the chosen Rack/Column is best.
    let physicalScore = 0;

    // 2.1 Heavy Item Safety (Force to bottom Row 1)
    if (item.weight_kg > 25) {
        // Massive penalty for putting heavy items high
        physicalScore += (cell.row_number * 100); 
    } 
    // 2.2 Golden Zone (Rows 2-3 for fast-movers)
    else if (item.turnover_class === 'A') {
        const goldenRows = [2, 3];
        if (!goldenRows.includes(cell.row_number)) {
            physicalScore += 50;
        }
    }

    // 2.3 Consolidation (Favor partially filled cells)
    const utilization = (cell.current_count + item.quantity) / cell.capacity;
    physicalScore -= (utilization * 20);

    // --- TOTAL HIERARCHICAL SCORE ---
    // We multiply Flow by 1000 to ensure a better logistical location 
    // is ALWAYS chosen over a better ergonomic location.
    return (flowScore * 1000) + physicalScore;
  }
}
