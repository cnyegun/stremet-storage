import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  assertProductionJobStatus,
  buildProductionActivityNote,
  buildProductionJobCode,
  summarizeProductionOutputs,
  validateProductionCompletion,
} from '../lib/productionJobs';
import { getDefaultMachineAssignmentStatus } from '../lib/machineAssignmentStatus';
import { buildRackLocationCode } from '../lib/rackCells';
import { getNextTrackingUnitCode } from '../lib/trackingUnits';

export const productionJobsRouter = Router();

async function getExistingUnitCodes() {
  const result = await pool.query<{ unit_code: string }>(
    `SELECT unit_code FROM storage_assignments WHERE unit_code IS NOT NULL
     UNION
     SELECT unit_code FROM machine_assignments WHERE unit_code IS NOT NULL
     UNION
     SELECT unit_code FROM production_job_outputs WHERE unit_code IS NOT NULL`,
  );

  return result.rows.map((row) => row.unit_code);
}

productionJobsRouter.get('/', asyncHandler(async (req, res) => {
  const { machine_id, status } = req.query;
  const conditions: string[] = [];
  const params: string[] = [];

  if (machine_id && typeof machine_id === 'string') {
    params.push(machine_id);
    conditions.push(`pj.machine_id = $${params.length}`);
  }

  if (status && typeof status === 'string') {
    params.push(assertProductionJobStatus(status));
    conditions.push(`pj.status = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await pool.query(
    `SELECT pj.*, m.code AS machine_code, m.name AS machine_name,
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
     ${whereClause}
     ORDER BY pj.created_at DESC`,
    params,
  );

  res.json({ data: result.rows });
}));

productionJobsRouter.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const jobResult = await pool.query(
    `SELECT pj.*, m.code AS machine_code, m.name AS machine_name,
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
     WHERE pj.id = $1`,
    [id],
  );

  if (jobResult.rows.length === 0) {
    res.status(404).json({ error: 'Production job not found' });
    return;
  }

  const inputsResult = await pool.query(
    `SELECT pji.*, i.item_code, i.name AS item_name, c.name AS customer_name,
       COALESCE(ma.quantity, 0)::int AS available_quantity
     FROM production_job_inputs pji
     JOIN items i ON pji.item_id = i.id
     LEFT JOIN customers c ON i.customer_id = c.id
     LEFT JOIN machine_assignments ma ON ma.id = pji.machine_assignment_id AND ma.removed_at IS NULL
     WHERE pji.production_job_id = $1
     ORDER BY pji.created_at`,
    [id],
  );

  const outputsResult = await pool.query(
    `SELECT pjo.*, i.item_code, i.name AS item_name, c.name AS customer_name
     FROM production_job_outputs pjo
     JOIN items i ON pjo.item_id = i.id
     LEFT JOIN customers c ON i.customer_id = c.id
     WHERE pjo.production_job_id = $1
     ORDER BY pjo.created_at`,
    [id],
  );

  res.json({
    data: {
      ...jobResult.rows[0],
      inputs: inputsResult.rows,
      outputs: outputsResult.rows,
    },
  });
}));

productionJobsRouter.post('/', asyncHandler(async (req, res) => {
  const { machine_id, input_assignment_ids, assigned_by, notes } = req.body as {
    machine_id?: string;
    input_assignment_ids?: string[];
    assigned_by?: string;
    notes?: string;
  };

  if (!machine_id || !Array.isArray(input_assignment_ids) || input_assignment_ids.length === 0 || !assigned_by) {
    res.status(400).json({ error: 'machine_id, input_assignment_ids, and assigned_by are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const machineResult = await client.query('SELECT * FROM machines WHERE id = $1', [machine_id]);
    if (machineResult.rows.length === 0) {
      res.status(404).json({ error: 'Machine not found' });
      await client.query('ROLLBACK');
      return;
    }

    const machine = machineResult.rows[0];
    const inputRows = await client.query(
      `SELECT ma.id AS machine_assignment_id, ma.item_id, ma.unit_code, ma.quantity
       FROM machine_assignments ma
       WHERE ma.machine_id = $1 AND ma.removed_at IS NULL AND ma.id = ANY($2::uuid[])
       FOR UPDATE OF ma`,
      [machine_id, input_assignment_ids],
    );

    if (inputRows.rows.length !== input_assignment_ids.length) {
      res.status(400).json({ error: 'Some selected machine units are no longer active' });
      await client.query('ROLLBACK');
      return;
    }

    const existingCount = await client.query(`SELECT COUNT(*)::int AS total FROM production_jobs WHERE machine_id = $1`, [machine_id]);
    const jobCode = buildProductionJobCode(machine.code as string, (existingCount.rows[0]?.total || 0) + 1);
    const jobId = uuidv4();

    await client.query(
      `INSERT INTO production_jobs (id, job_code, machine_id, status, assigned_by, notes)
       VALUES ($1, $2, $3, 'draft', $4, $5)`,
      [jobId, jobCode, machine_id, assigned_by, notes || null],
    );

    for (const input of inputRows.rows) {
      await client.query(
        `INSERT INTO production_job_inputs (id, production_job_id, machine_assignment_id, item_id, unit_code, planned_quantity, consumed_quantity, outcome)
         VALUES ($1, $2, $3, $4, $5, $6, 0, 'planned')`,
        [uuidv4(), jobId, input.machine_assignment_id, input.item_id, input.unit_code, input.quantity],
      );
    }

    const itemId = inputRows.rows[0].item_id;
    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes, production_job_id, machine_id)
       VALUES ($1, $2, 'job_created', $3, $4, $5, $6, $7)`,
      [uuidv4(), itemId, `M/${machine.code}`, assigned_by, buildProductionActivityNote(jobCode, 'Production job created'), jobId, machine_id],
    );

    await client.query('COMMIT');
    const detail = await pool.query(
      `SELECT pj.*, m.code AS machine_code, m.name AS machine_name,
         (SELECT COUNT(*)::int FROM production_job_inputs WHERE production_job_id = pj.id) AS input_count,
         (SELECT COUNT(*)::int FROM production_job_outputs WHERE production_job_id = pj.id) AS output_count
       FROM production_jobs pj
       JOIN machines m ON pj.machine_id = m.id
       WHERE pj.id = $1`,
      [jobId],
    );

    res.status(201).json({ data: detail.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

productionJobsRouter.post('/:id/start', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { performed_by } = req.body as { performed_by?: string };

  if (!performed_by) {
    res.status(400).json({ error: 'performed_by is required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const jobResult = await client.query('SELECT * FROM production_jobs WHERE id = $1 FOR UPDATE', [id]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Production job not found' });
      await client.query('ROLLBACK');
      return;
    }

    const job = jobResult.rows[0];
    if (job.status === 'completed' || job.status === 'cancelled') {
      res.status(400).json({ error: 'Only draft jobs can be started' });
      await client.query('ROLLBACK');
      return;
    }

    await client.query(
      `UPDATE production_jobs SET status = 'in_progress', started_at = COALESCE(started_at, NOW()), updated_at = NOW() WHERE id = $1`,
      [id],
    );

    const inputResult = await client.query(`SELECT item_id, machine_id, job_code FROM production_job_inputs pji JOIN production_jobs pj ON pji.production_job_id = pj.id WHERE pji.production_job_id = $1 LIMIT 1`, [id]);
    if (inputResult.rows.length > 0) {
      const entry = inputResult.rows[0];
      await client.query(
        `INSERT INTO activity_log (id, item_id, action, performed_by, notes, production_job_id, machine_id)
         VALUES ($1, $2, 'job_started', $3, $4, $5, $6)`,
        [uuidv4(), entry.item_id, performed_by, buildProductionActivityNote(entry.job_code, 'Production job started'), id, entry.machine_id],
      );
    }

    await client.query('COMMIT');
    res.json({ data: { id, status: 'in_progress' } });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

productionJobsRouter.post('/:id/complete', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { completed_by, notes, inputs, outputs } = req.body as {
    completed_by?: string;
    notes?: string;
    inputs?: Array<{ machine_assignment_id: string; consumed_quantity: number }>;
    outputs?: Array<{
      item_id: string;
      quantity: number;
      outcome: string;
      destination_type: 'storage' | 'machine' | 'none';
      shelf_slot_id?: string;
      machine_id?: string;
      notes?: string;
    }>;
  };

  if (!completed_by || !Array.isArray(inputs) || !Array.isArray(outputs)) {
    res.status(400).json({ error: 'completed_by, inputs, and outputs are required' });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const jobResult = await client.query(`SELECT pj.*, m.code AS machine_code FROM production_jobs pj JOIN machines m ON pj.machine_id = m.id WHERE pj.id = $1 FOR UPDATE`, [id]);
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Production job not found' });
      await client.query('ROLLBACK');
      return;
    }

    const job = jobResult.rows[0];
    if (job.status === 'completed' || job.status === 'cancelled') {
      res.status(400).json({ error: 'Production job is already closed' });
      await client.query('ROLLBACK');
      return;
    }

    const inputAssignmentsResult = await client.query(
      `SELECT ma.id AS machine_assignment_id, ma.item_id, ma.unit_code, ma.quantity AS available_quantity
       FROM machine_assignments ma
       WHERE ma.machine_id = $1 AND ma.removed_at IS NULL AND ma.id = ANY($2::uuid[])
       FOR UPDATE OF ma`,
      [job.machine_id, inputs.map((input) => input.machine_assignment_id)],
    );

    const assignmentById = new Map(inputAssignmentsResult.rows.map((row) => [row.machine_assignment_id as string, row]));
    if (assignmentById.size !== inputs.length) {
      res.status(400).json({ error: 'Some input units are no longer active at this machine' });
      await client.query('ROLLBACK');
      return;
    }

    validateProductionCompletion(
      inputs.map((input) => {
        const assignment = assignmentById.get(input.machine_assignment_id)!;
        return {
          machine_assignment_id: input.machine_assignment_id,
          available_quantity: assignment.available_quantity as number,
          consumed_quantity: input.consumed_quantity,
        };
      }),
      outputs,
    );

    for (const input of inputs) {
      const assignment = assignmentById.get(input.machine_assignment_id)!;
      const remaining = (assignment.available_quantity as number) - input.consumed_quantity;

      if (remaining === 0) {
        await client.query(
          `UPDATE machine_assignments
           SET removed_at = NOW(), removed_by = $1, notes = COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE E'\n' END || $2
           WHERE id = $3`,
          [completed_by, `Consumed in production job ${job.job_code}`, input.machine_assignment_id],
        );
      } else {
        await client.query(
          `UPDATE machine_assignments
           SET quantity = $1,
               notes = COALESCE(notes, '') || CASE WHEN COALESCE(notes, '') = '' THEN '' ELSE E'\n' END || $2
           WHERE id = $3`,
          [remaining, `Partially consumed ${input.consumed_quantity} in production job ${job.job_code}`, input.machine_assignment_id],
        );
      }

      await client.query(
        `UPDATE production_job_inputs
         SET consumed_quantity = $1,
             outcome = $2,
             notes = $3
         WHERE production_job_id = $4 AND machine_assignment_id = $5`,
        [input.consumed_quantity, remaining === 0 ? 'consumed' : 'partial', remaining === 0 ? null : `${remaining} pcs remain at machine`, id, input.machine_assignment_id],
      );

      await client.query(
        `INSERT INTO activity_log (id, item_id, action, from_location, performed_by, notes, production_job_id, tracking_unit_code, machine_id)
         VALUES ($1, $2, 'unit_consumed', $3, $4, $5, $6, $7, $8)`,
        [
          uuidv4(),
          assignment.item_id,
          `M/${job.machine_code}`,
          completed_by,
          buildProductionActivityNote(job.job_code, `Consumed ${input.consumed_quantity} pcs from ${assignment.unit_code}`),
          id,
          assignment.unit_code,
          job.machine_id,
        ],
      );
    }

    const existingCodes = await getExistingUnitCodes();
    let firstOutputItemId: string | null = null;
    for (const output of outputs) {
      const itemResult = await client.query('SELECT * FROM items WHERE id = $1', [output.item_id]);
      if (itemResult.rows.length === 0) {
        res.status(404).json({ error: 'Output item not found' });
        await client.query('ROLLBACK');
        return;
      }

      const item = itemResult.rows[0];
      if (!firstOutputItemId) {
        firstOutputItemId = item.id as string;
      }
      const unitCode = getNextTrackingUnitCode(item.item_code as string, existingCodes);
      existingCodes.push(unitCode);

      let storageAssignmentId: string | null = null;
      let machineAssignmentId: string | null = null;
      let toLocation: string | null = null;

      if (output.destination_type === 'storage') {
        const slotResult = await client.query(`
          SELECT ss.*, r.code AS rack_code, ss.row_number, ss.column_number
          FROM shelf_slots ss
          JOIN racks r ON ss.rack_id = r.id
          WHERE ss.id = $1
          FOR UPDATE OF ss
        `, [output.shelf_slot_id]);
        if (slotResult.rows.length === 0) {
          res.status(404).json({ error: 'Output shelf cell not found' });
          await client.query('ROLLBACK');
          return;
        }

        const slot = slotResult.rows[0];
        if (slot.current_count >= slot.capacity) {
          res.status(400).json({ error: 'Output shelf cell is full' });
          await client.query('ROLLBACK');
          return;
        }

        storageAssignmentId = uuidv4();
        await client.query(
          `INSERT INTO storage_assignments (id, item_id, shelf_slot_id, unit_code, quantity, checked_in_at, checked_in_by, notes)
           VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
          [storageAssignmentId, output.item_id, output.shelf_slot_id, unitCode, output.quantity, completed_by, output.notes || null],
        );
        await client.query('UPDATE shelf_slots SET current_count = current_count + 1, updated_at = NOW() WHERE id = $1', [output.shelf_slot_id]);
        toLocation = buildRackLocationCode(slot.rack_code as string, slot.row_number as number, slot.column_number as number);
      } else if (output.destination_type === 'machine') {
        const machineResult = await client.query('SELECT * FROM machines WHERE id = $1', [output.machine_id]);
        if (machineResult.rows.length === 0) {
          res.status(404).json({ error: 'Output machine not found' });
          await client.query('ROLLBACK');
          return;
        }

        machineAssignmentId = uuidv4();
        await client.query(
          `INSERT INTO machine_assignments (id, item_id, machine_id, unit_code, status, quantity, assigned_at, assigned_by, notes)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8)`,
          [machineAssignmentId, output.item_id, output.machine_id, unitCode, getDefaultMachineAssignmentStatus(), output.quantity, completed_by, output.notes || null],
        );
        toLocation = `M/${machineResult.rows[0].code}`;
      }

      await client.query(
        `INSERT INTO production_job_outputs (id, production_job_id, item_id, unit_code, output_type, storage_assignment_id, machine_assignment_id, quantity, outcome, created_by, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [uuidv4(), id, output.item_id, unitCode, output.destination_type, storageAssignmentId, machineAssignmentId, output.quantity, output.outcome, completed_by, output.notes || null],
      );

      const action = output.outcome === 'scrap'
        ? 'unit_scrapped'
        : output.outcome === 'rework'
          ? 'unit_reworked'
          : output.outcome === 'hold'
            ? 'unit_held'
            : 'unit_produced';

      await client.query(
        `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes, production_job_id, tracking_unit_code, machine_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          uuidv4(),
          output.item_id,
          action,
          toLocation,
          completed_by,
          buildProductionActivityNote(job.job_code, `${output.outcome} output created as ${unitCode}`),
          id,
          unitCode,
          job.machine_id,
        ],
      );
    }

    await client.query(
      `UPDATE production_jobs
       SET status = 'completed',
           completed_at = NOW(),
           completed_by = $1,
           notes = COALESCE($2, notes),
           result_summary = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [completed_by, notes || null, summarizeProductionOutputs(outputs), id],
    );

    if (firstOutputItemId) {
      await client.query(
        `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes, production_job_id, machine_id)
         VALUES ($1, $2, 'job_completed', $3, $4, $5, $6, $7)`,
        [uuidv4(), firstOutputItemId, `M/${job.machine_code}`, completed_by, buildProductionActivityNote(job.job_code, 'Production job completed'), id, job.machine_id],
      );
    }

    await client.query('COMMIT');
    const detail = await pool.query(
      `SELECT pj.*, m.code AS machine_code, m.name AS machine_name,
         (SELECT COUNT(*)::int FROM production_job_inputs WHERE production_job_id = pj.id) AS input_count,
         (SELECT COUNT(*)::int FROM production_job_outputs WHERE production_job_id = pj.id) AS output_count
       FROM production_jobs pj
       JOIN machines m ON pj.machine_id = m.id
       WHERE pj.id = $1`,
      [id],
    );
    res.json({ data: detail.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));
