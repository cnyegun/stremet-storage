// backend/src/services/optimizerService.ts

/**
 * Volumetric Optimizer for Stremet Storage System
 * 
 * Hierarchy:
 * 1. Logistical Flow (Primary) - Rack/Column based on Urgency/Type
 * 2. Physical Safety (Secondary) - Row based on Weight/Ergonomics
 * 3. Volumetric Capacity - HARD CONSTRAINT
 */

export interface StorageCell {
  cell_id: string;
  rack_id: string;
  row_number: number;
  column_number: number;
  max_volume_m3: number;
  current_volume_m3: number;
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
  volume_m3: number;
  turnover_class: 'A' | 'B' | 'C';
  quantity: number;
  is_stackable: boolean;
  delivery_date?: string;
}

export class OptimizerService {
  /**
   * Validates if an item batch fits into a cell volumetrically.
   */
  public static fitsVolumetrically(cell: StorageCell, item: Item): boolean {
    const incomingVolume = Number(item.volume_m3) * Number(item.quantity);
    return (Number(cell.current_volume_m3) + incomingVolume) <= Number(cell.max_volume_m3);
  }

  /**
   * Scores a storage cell. Lower score is better.
   */
  public static scoreSlot(cell: StorageCell, item: Item): number {
    // HARD CONSTRAINT: Volumetric Check
    if (!this.fitsVolumetrically(cell, item)) {
        return 1000000; // Impossible score
    }

    // --- TIER 1: LOGISTICAL FLOW (Weight: 1000) ---
    let flowScore = 0;

    // 1.1 X-Axis Bias (Production Left -> Delivery Right)
    if (item.type === 'raw_material' || item.type === 'work_in_progress') {
        flowScore += (cell.display_order * 50);
    } 
    else if (item.type === 'customer_order') {
        const totalRacksEstimate = 10;
        flowScore += (Math.max(0, totalRacksEstimate - cell.display_order) * 50);

        if (item.delivery_date) {
            const now = new Date();
            const delivery = new Date(item.delivery_date);
            const daysToDelivery = Math.max(0, (delivery.getTime() - now.getTime()) / (1000 * 3600 * 24));
            const urgency = 1 / (daysToDelivery + 1);
            
            const maxColumn = 10;
            flowScore += (maxColumn - cell.column_number) * urgency * 100;
        }
    }

    // --- TIER 2: PHYSICAL SAFETY & ERGONOMICS (Weight: 1) ---
    let physicalScore = 0;

    if (item.weight_kg > 25) {
        physicalScore += (cell.row_number * 100); 
    } 
    else if (item.turnover_class === 'A') {
        const goldenRows = [2, 3];
        if (!goldenRows.includes(cell.row_number)) {
            physicalScore += 50;
        }
    }

    // Volumetric Utilization (Favor filling partially full cells)
    const utilization = (Number(cell.current_volume_m3) + (Number(item.volume_m3) * Number(item.quantity))) / Number(cell.max_volume_m3);
    physicalScore -= (utilization * 50);

    return (flowScore * 1000) + physicalScore;
  }
}
