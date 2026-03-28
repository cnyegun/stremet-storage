"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const rackCells_1 = require("./rackCells");
(0, vitest_1.describe)('buildRackTypeFromZone', () => {
    (0, vitest_1.it)('maps old zone codes to rack types', () => {
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('A', 'Raw materials')).toBe('raw_materials');
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('B', 'Work-in-progress')).toBe('work_in_progress');
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('C', 'Finished goods')).toBe('finished_goods');
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('D', 'Customer orders')).toBe('customer_orders');
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('E', 'General stock')).toBe('general_stock');
    });
    (0, vitest_1.it)('falls back by zone name when code is unknown', () => {
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('X', 'Finished goods area')).toBe('finished_goods');
    });
    (0, vitest_1.it)('defaults to general_stock when no match exists', () => {
        (0, vitest_1.expect)((0, rackCells_1.buildRackTypeFromZone)('X', 'Miscellaneous')).toBe('general_stock');
    });
});
(0, vitest_1.describe)('getLegacyRackCellCoordinates', () => {
    (0, vitest_1.it)('maps shelf numbers to row/column coordinates for migration', () => {
        (0, vitest_1.expect)((0, rackCells_1.getLegacyRackCellCoordinates)(1)).toEqual({ row_number: 1, column_number: 1 });
        (0, vitest_1.expect)((0, rackCells_1.getLegacyRackCellCoordinates)(4)).toEqual({ row_number: 4, column_number: 1 });
    });
});
(0, vitest_1.describe)('rack cell labels', () => {
    (0, vitest_1.it)('builds readable rack cell labels', () => {
        (0, vitest_1.expect)((0, rackCells_1.buildRackCellLabel)('A-R1', 2, 3)).toBe('A-R1 / R2 / C3');
    });
    (0, vitest_1.it)('builds compact machine/location codes for logs', () => {
        (0, vitest_1.expect)((0, rackCells_1.buildRackLocationCode)('A-R1', 2, 3)).toBe('A-R1/R2C3');
    });
});
