"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsRouter = void 0;
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.statsRouter = (0, express_1.Router)();
// GET /api/stats — rack-first warehouse occupancy stats
exports.statsRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const racksResult = await pool_1.default.query(`
    SELECT
      r.*,
      COUNT(DISTINCT ss.id)::int AS cell_count,
      COALESCE(SUM(ss.capacity), 0)::int AS total_capacity,
      COALESCE(SUM(ss.current_count), 0)::int AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS cells_in_use
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY r.id
    ORDER BY r.display_order, r.code
  `);
    let totalRacks = 0;
    let totalSlots = 0;
    let totalCapacity = 0;
    let totalItemsStored = 0;
    let totalSlotsInUse = 0;
    for (const rack of racksResult.rows) {
        totalRacks++;
        totalSlots += rack.cell_count;
        totalCapacity += rack.total_capacity;
        totalItemsStored += rack.items_stored;
        totalSlotsInUse += rack.cells_in_use;
    }
    res.json({
        data: {
            total_racks: totalRacks,
            total_slots: totalSlots,
            total_capacity: totalCapacity,
            items_stored: totalItemsStored,
            slots_in_use: totalSlotsInUse,
            occupancy_percent: totalCapacity > 0 ? Math.round((totalItemsStored / totalCapacity) * 100) : 0,
            racks: racksResult.rows,
        },
    });
}));
