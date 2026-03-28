"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildRackTypeFromZone = buildRackTypeFromZone;
exports.getLegacyRackCellCoordinates = getLegacyRackCellCoordinates;
exports.buildRackCellLabel = buildRackCellLabel;
exports.buildRackLocationCode = buildRackLocationCode;
function buildRackTypeFromZone(zoneCode, zoneName) {
    const normalizedCode = zoneCode.trim().toUpperCase();
    const normalizedName = zoneName.trim().toLowerCase();
    if (normalizedCode === 'A' || normalizedName.includes('raw'))
        return 'raw_materials';
    if (normalizedCode === 'B' || normalizedName.includes('progress'))
        return 'work_in_progress';
    if (normalizedCode === 'C' || normalizedName.includes('finished'))
        return 'finished_goods';
    if (normalizedCode === 'D' || normalizedName.includes('customer'))
        return 'customer_orders';
    return 'general_stock';
}
function getLegacyRackCellCoordinates(shelfNumber) {
    return {
        row_number: shelfNumber,
        column_number: 1,
    };
}
function buildRackCellLabel(rackCode, rowNumber, columnNumber) {
    return `${rackCode} / R${rowNumber} / C${columnNumber}`;
}
function buildRackLocationCode(rackCode, rowNumber, columnNumber) {
    return `${rackCode}/R${rowNumber}C${columnNumber}`;
}
