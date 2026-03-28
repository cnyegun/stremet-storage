"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.machinesRouter = void 0;
const express_1 = require("express");
const uuid_1 = require("uuid");
const pool_1 = __importDefault(require("../db/pool"));
const asyncHandler_1 = require("../middleware/asyncHandler");
const machineAssignmentStatus_1 = require("../lib/machineAssignmentStatus");
exports.machinesRouter = (0, express_1.Router)();
// GET /api/machines — list all machines with current item counts
exports.machinesRouter.get('/', (0, asyncHandler_1.asyncHandler)(async (_req, res) => {
    const result = await pool_1.default.query(`
    SELECT m.*,
      COALESCE(agg.active_items, 0)::int AS active_items,
      COALESCE(agg.total_quantity, 0)::int AS total_quantity
    FROM machines m
    LEFT JOIN (
      SELECT machine_id,
        COUNT(*)::int AS active_items,
        SUM(quantity)::int AS total_quantity
      FROM machine_assignments
      WHERE removed_at IS NULL
      GROUP BY machine_id
    ) agg ON agg.machine_id = m.id
    ORDER BY m.category, m.code
  `);
    res.json({ data: result.rows });
}));
// GET /api/machines/:id — machine detail with current items
exports.machinesRouter.get('/:id', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id } = req.params;
    const machineResult = await pool_1.default.query('SELECT * FROM machines WHERE id = $1', [id]);
    if (machineResult.rows.length === 0) {
        res.status(404).json({ error: 'Machine not found' });
        return;
    }
    const machine = machineResult.rows[0];
    const itemsResult = await pool_1.default.query(`
    SELECT ma.id AS assignment_id, ma.unit_code, ma.parent_unit_code, ma.status, ma.quantity, ma.assigned_at, ma.assigned_by, ma.notes,
      i.id AS item_id, i.item_code, i.name AS item_name, i.material, i.dimensions, i.weight_kg,
      c.name AS customer_name
    FROM machine_assignments ma
    JOIN items i ON ma.item_id = i.id
    LEFT JOIN customers c ON i.customer_id = c.id
    WHERE ma.machine_id = $1 AND ma.removed_at IS NULL
    ORDER BY ma.assigned_at DESC
  `, [id]);
    // Recent activity (moves to/from this machine)
    const activityResult = await pool_1.default.query(`
    SELECT al.*, i.item_code, i.name AS item_name
    FROM activity_log al
    JOIN items i ON al.item_id = i.id
    WHERE al.from_location = $1 OR al.to_location = $1
    ORDER BY al.created_at DESC
    LIMIT 30
  `, [`M/${machine.code}`]);
    // Stats
    const statsResult = await pool_1.default.query(`
    SELECT
      COUNT(*) FILTER (WHERE removed_at IS NULL)::int AS active_assignments,
      COALESCE(SUM(quantity) FILTER (WHERE removed_at IS NULL), 0)::int AS total_pieces,
      COUNT(*) FILTER (WHERE removed_at IS NOT NULL)::int AS completed_assignments,
      MIN(assigned_at) FILTER (WHERE removed_at IS NULL) AS oldest_assignment
    FROM machine_assignments
    WHERE machine_id = $1
  `, [id]);
    res.json({
        data: {
            ...machine,
            items: itemsResult.rows,
            activity: activityResult.rows,
            stats: statsResult.rows[0],
        },
    });
}));
// POST /api/machines/:id/assignments/:assignmentId/status — update machine assignment status
exports.machinesRouter.post('/:id/assignments/:assignmentId/status', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { id, assignmentId } = req.params;
    const { status, performed_by, notes } = req.body;
    if (!status || !performed_by) {
        res.status(400).json({ error: 'status and performed_by are required' });
        return;
    }
    const nextStatus = (0, machineAssignmentStatus_1.assertMachineAssignmentStatus)(status);
    const client = await pool_1.default.connect();
    try {
        await client.query('BEGIN');
        const assignmentResult = await client.query(`
      SELECT ma.*, i.id AS item_row_id, m.code AS machine_code
      FROM machine_assignments ma
      JOIN items i ON ma.item_id = i.id
      JOIN machines m ON ma.machine_id = m.id
      WHERE ma.id = $1 AND ma.machine_id = $2 AND ma.removed_at IS NULL
      FOR UPDATE OF ma
    `, [assignmentId, id]);
        if (assignmentResult.rows.length === 0) {
            res.status(404).json({ error: 'Active machine assignment not found' });
            await client.query('ROLLBACK');
            return;
        }
        const assignment = assignmentResult.rows[0];
        const previousStatus = assignment.status;
        if (previousStatus === nextStatus && !notes) {
            res.json({
                data: {
                    assignment_id: assignmentId,
                    unit_code: assignment.unit_code,
                    status: nextStatus,
                },
            });
            await client.query('COMMIT');
            return;
        }
        await client.query(`UPDATE machine_assignments
       SET status = $1,
           notes = CASE WHEN $2::text IS NULL OR $2::text = '' THEN notes ELSE $2 END
       WHERE id = $3`, [nextStatus, notes || null, assignmentId]);
        await client.query(`INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
       VALUES ($1, $2, 'note_added', $3, $4, $5, $6)`, [
            (0, uuid_1.v4)(),
            assignment.item_row_id,
            `M/${assignment.machine_code}`,
            `M/${assignment.machine_code}`,
            performed_by,
            (0, machineAssignmentStatus_1.buildMachineStatusChangeNote)((0, machineAssignmentStatus_1.assertMachineAssignmentStatus)(previousStatus), nextStatus, notes || null),
        ]);
        await client.query('COMMIT');
        res.json({
            data: {
                assignment_id: assignmentId,
                unit_code: assignment.unit_code,
                status: nextStatus,
            },
        });
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}));
