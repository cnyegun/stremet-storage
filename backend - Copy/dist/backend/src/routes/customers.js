"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.customersRouter = void 0;
const express_1 = require("express");
const pool_1 = __importDefault(require("../db/pool"));
const asyncHandler_1 = require("../middleware/asyncHandler");
exports.customersRouter = (0, express_1.Router)();
// GET /api/customers — list all customers
exports.customersRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const result = await pool_1.default.query(`
    SELECT c.*,
      COUNT(DISTINCT i.id)::int AS item_count,
      COUNT(DISTINCT sa.id) FILTER (WHERE sa.checked_out_at IS NULL)::int AS items_in_storage
    FROM customers c
    LEFT JOIN items i ON i.customer_id = c.id
    LEFT JOIN storage_assignments sa ON sa.item_id = i.id
    GROUP BY c.id
    ORDER BY c.name
  `);
    res.json({ data: result.rows });
}));
