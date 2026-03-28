type RackType = 'raw_materials' | 'work_in_progress' | 'finished_goods' | 'customer_orders' | 'general_stock';
export declare function buildRackTypeFromZone(zoneCode: string, zoneName: string): RackType;
export declare function getLegacyRackCellCoordinates(shelfNumber: number): {
    row_number: number;
    column_number: number;
};
export declare function buildRackCellLabel(rackCode: string, rowNumber: number, columnNumber: number): string;
export declare function buildRackLocationCode(rackCode: string, rowNumber: number, columnNumber: number): string;
export type { RackType };
