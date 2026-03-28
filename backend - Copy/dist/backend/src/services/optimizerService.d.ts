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
export declare class OptimizerService {
    /**
     * Validates if an item batch fits into a cell volumetrically.
     */
    static fitsVolumetrically(cell: StorageCell, item: Item): boolean;
    /**
     * Scores a storage cell. Lower score is better.
     */
    static scoreSlot(cell: StorageCell, item: Item): number;
}
