"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.racksRouter = void 0;
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.racksRouter = (0, express_1.Router)();
// GET /api/racks — list all racks with occupancy stats
exports.racksRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const result = await pool_1.default.query(`
    SELECT
      r.*,
      COUNT(DISTINCT ss.id)::int AS cell_count,
      COALESCE(SUM(ss.max_volume_m3), 0)::float AS total_capacity,
      COALESCE(SUM(ss.current_volume_m3), 0)::float AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS cells_in_use
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY r.id
    ORDER BY r.display_order, r.code
  `);
    res.json({ data: result.rows });
}));
// GET /api/racks/:id — rack detail with row/column cells and items
exports.racksRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const rackResult = await pool_1.default.query(`
    SELECT r.*,
      COUNT(DISTINCT ss.id)::int AS total_cells,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS occupied_cells,
      COALESCE(SUM(ss.current_count), 0)::int AS total_items
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    WHERE r.id = $1
    GROUP BY r.id
  `, [id]);
    if (rackResult.rows.length === 0) {
        res.status(404).json({ error: 'Rack not found' });
        return;
    }
    const shelvesResult = await pool_1.default.query(`
    SELECT ss.*,
      r.code AS rack_code,
      r.label AS rack_label,
      COALESCE(json_agg(
        json_build_object(
           'assignment_id', sa.id,
           'item_id', i.id,
           'item_code', i.item_code,
           'unit_code', sa.unit_code,
           'item_name', i.name,
           'customer_name', c.name,
           'material', i.material,
           'quantity', sa.quantity,
           'checked_in_at', sa.checked_in_at,
           'checked_in_by', sa.checked_in_by
        )
      ) FILTER (WHERE sa.id IS NOT NULL), '[]'::json) AS items
    FROM shelf_slots ss
    JOIN racks r ON ss.rack_id = r.id
    LEFT JOIN storage_assignments sa ON sa.shelf_slot_id = ss.id AND sa.checked_out_at IS NULL
    LEFT JOIN items i ON sa.item_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE ss.rack_id = $1
    GROUP BY ss.id, r.code, r.label
    ORDER BY ss.row_number, ss.column_number
  `, [id]);
    res.json({
        data: {
            ...rackResult.rows[0],
            shelves: shelvesResult.rows,
        },
    });
}));
