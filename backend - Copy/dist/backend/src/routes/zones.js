"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.zonesRouter = void 0;
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.zonesRouter = (0, express_1.Router)();
// GET /api/zones — list all zones with occupancy stats
exports.zonesRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const result = await pool_1.default.query(`
    SELECT
      z.*,
      COUNT(DISTINCT r.id)::int AS rack_count,
      COUNT(DISTINCT ss.id)::int AS slot_count,
      COALESCE(SUM(ss.capacity), 0)::int AS total_capacity,
      COALESCE(SUM(ss.current_count), 0)::int AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS slots_in_use
    FROM zones z
    LEFT JOIN racks r ON r.zone_id = z.id
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    GROUP BY z.id
    ORDER BY z.code
  `);
    res.json({ data: result.rows });
}));
// GET /api/zones/:id — zone detail with racks, shelves, and items
exports.zonesRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const zoneResult = await pool_1.default.query(`
    SELECT z.*,
      COUNT(DISTINCT r.id)::int AS rack_count,
      COUNT(DISTINCT ss.id)::int AS slot_count,
      COALESCE(SUM(ss.capacity), 0)::int AS total_capacity,
      COALESCE(SUM(ss.current_count), 0)::int AS items_stored,
      COUNT(DISTINCT ss.id) FILTER (WHERE ss.current_count > 0)::int AS slots_in_use
    FROM zones z
    LEFT JOIN racks r ON r.zone_id = z.id
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    WHERE z.id = $1
    GROUP BY z.id
  `, [id]);
    if (zoneResult.rows.length === 0) {
        res.status(404).json({ error: 'Zone not found' });
        return;
    }
    const racksResult = await pool_1.default.query(`
    SELECT r.*,
      json_agg(
        json_build_object(
          'id', ss.id,
          'shelf_number', ss.shelf_number,
          'capacity', ss.capacity,
          'current_count', ss.current_count,
          'items', (
            SELECT COALESCE(json_agg(
              json_build_object(
                 'assignment_id', sa.id,
                 'item_id', i.id,
                 'item_code', i.item_code,
                 'unit_code', sa.unit_code,
                 'item_name', i.name,
                 'customer_name', c.name,
                 'quantity', sa.quantity,
                'checked_in_at', sa.checked_in_at,
                'checked_in_by', sa.checked_in_by
              )
            ) FILTER (WHERE sa.id IS NOT NULL), '[]'::json)
            FROM storage_assignments sa
            JOIN items i ON sa.item_id = i.id
            LEFT JOIN customers c ON i.customer_id = c.id
            WHERE sa.shelf_slot_id = ss.id AND sa.checked_out_at IS NULL
          )
        ) ORDER BY ss.shelf_number
      ) AS shelves
    FROM racks r
    LEFT JOIN shelf_slots ss ON ss.rack_id = r.id
    WHERE r.zone_id = $1
    GROUP BY r.id
    ORDER BY r.position_in_zone
  `, [id]);
    res.json({
        data: {
            ...zoneResult.rows[0],
            racks: racksResult.rows,
        },
    });
}));
