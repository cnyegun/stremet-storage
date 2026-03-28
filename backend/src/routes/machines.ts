import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { assertMachineAssignmentStatus, buildMachineStatusChangeNote } from '../lib/machineAssignmentStatus';

export const machinesRouter = Router();

// GET /api/machines — list all machines with current item counts
machinesRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query(`
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
machinesRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const machineResult = await pool.query('SELECT * FROM machines WHERE id = $1', [id]);
  if (machineResult.rows.length === 0) {
    res.status(404).json({ error: 'Machine not found' });
    return;
  }

  const machine = machineResult.rows[0];

  const itemsResult = await pool.query(`
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
  const activityResult = await pool.query(`
    SELECT al.*, i.item_code, i.name AS item_name
    FROM activity_log al
    JOIN items i ON al.item_id = i.id
    WHERE al.from_location = $1 OR al.to_location = $1 OR al.machine_id = $2
    ORDER BY al.created_at DESC
    LIMIT 30
  `, [`M/${machine.code}`, id]);

  // Stats
  const statsResult = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE removed_at IS NULL)::int AS active_assignments,
      COALESCE(SUM(quantity) FILTER (WHERE removed_at IS NULL), 0)::int AS total_pieces,
      COUNT(*) FILTER (WHERE removed_at IS NOT NULL)::int AS completed_assignments,
      MIN(assigned_at) FILTER (WHERE removed_at IS NULL) AS oldest_assignment
    FROM machine_assignments
    WHERE machine_id = $1
  `, [id]);

  const jobsResult = await pool.query(`
    SELECT pj.*, m.code AS machine_code, m.name AS machine_name,
      COALESCE(input_counts.input_count, 0)::int AS input_count,
      COALESCE(output_counts.output_count, 0)::int AS output_count
    FROM production_jobs pj
    JOIN machines m ON pj.machine_id = m.id
    LEFT JOIN (
      SELECT production_job_id, COUNT(*)::int AS input_count
      FROM production_job_inputs
      GROUP BY production_job_id
    ) input_counts ON input_counts.production_job_id = pj.id
    LEFT JOIN (
      SELECT production_job_id, COUNT(*)::int AS output_count
      FROM production_job_outputs
      GROUP BY production_job_id
    ) output_counts ON output_counts.production_job_id = pj.id
    WHERE pj.machine_id = $1
    ORDER BY pj.created_at DESC
    LIMIT 20
  `, [id]);

  res.json({
    data: {
      ...machine,
      items: itemsResult.rows,
      jobs: jobsResult.rows,
      activity: activityResult.rows,
      stats: statsResult.rows[0],
    },
  });
}));

// POST /api/machines/:id/assignments/:assignmentId/status — update machine assignment status
machinesRouter.post('/:id/assignments/:assignmentId/status', asyncHandler(async (req, res) => {
  const { id, assignmentId } = req.params;
  const { status, performed_by, notes } = req.body as {
    status?: string;
    performed_by?: string;
    notes?: string;
  };

  if (!status || !performed_by) {
    res.status(400).json({ error: 'status and performed_by are required' });
    return;
  }

  const nextStatus = assertMachineAssignmentStatus(status);
  const client = await pool.connect();

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
    const previousStatus = assignment.status as string;

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

    await client.query(
      `UPDATE machine_assignments
       SET status = $1,
           notes = CASE WHEN $2::text IS NULL OR $2::text = '' THEN notes ELSE $2 END
       WHERE id = $3`,
      [nextStatus, notes || null, assignmentId],
    );

    await client.query(
      `INSERT INTO activity_log (id, item_id, action, from_location, to_location, performed_by, notes)
       VALUES ($1, $2, 'note_added', $3, $4, $5, $6)`,
      [
        uuidv4(),
        assignment.item_row_id,
        `M/${assignment.machine_code}`,
        `M/${assignment.machine_code}`,
        performed_by,
        buildMachineStatusChangeNote(assertMachineAssignmentStatus(previousStatus), nextStatus, notes || null),
      ],
    );

    await client.query('COMMIT');

    res.json({
      data: {
        assignment_id: assignmentId,
        unit_code: assignment.unit_code,
        status: nextStatus,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));
