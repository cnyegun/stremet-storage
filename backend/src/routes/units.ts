import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import { getRecentUnitUpdates, getUnitContext } from '../lib/unitMonitoring';

export const unitsRouter = Router();

unitsRouter.get('/:unitCode', asyncHandler(async (req, res) => {
  const unitCode = req.params.unitCode as string;
  const client = await pool.connect();

  try {
    const context = await getUnitContext(client, unitCode);

    if (!context) {
      res.status(404).json({ error: 'Tracked unit not found' });
      return;
    }

    const latestUpdates = await getRecentUnitUpdates(client, unitCode);

    res.json({
      data: {
        ...context,
        latest_updates: latestUpdates,
      },
    });
  } finally {
    client.release();
  }
}));

unitsRouter.post('/:unitCode/worker-updates', asyncHandler(async (req, res) => {
  const unitCode = req.params.unitCode as string;
  const {
    update_category,
    status,
    quantity,
    location_confirmed = false,
    reported_by,
    notes,
  } = req.body;

  if (!update_category || !status || !reported_by) {
    res.status(400).json({ error: 'update_category, status, and reported_by are required' });
    return;
  }

  if (!['assembly', 'storage'].includes(update_category)) {
    res.status(400).json({ error: 'update_category must be assembly or storage' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const context = await getUnitContext(client, unitCode);
    if (!context) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Tracked unit not found' });
      return;
    }

    const updateId = uuidv4();
    const eventId = uuidv4();

    await client.query(
      `INSERT INTO unit_field_updates (
        id,
        unit_code,
        item_id,
        storage_assignment_id,
        machine_assignment_id,
        update_category,
        status,
        quantity,
        location_confirmed,
        reported_by,
        notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        updateId,
        context.unit_code,
        context.item_id,
        context.storage_assignment_id,
        context.machine_assignment_id,
        update_category,
        status,
        quantity ?? null,
        Boolean(location_confirmed),
        reported_by,
        notes || null,
      ],
    );

    await client.query(
      `INSERT INTO inventory_events (
        id,
        unit_code,
        item_id,
        storage_assignment_id,
        machine_assignment_id,
        source,
        event_type,
        event_status,
        quantity,
        location_code,
        reported_by,
        notes,
        metadata
      ) VALUES ($1, $2, $3, $4, $5, 'worker', $6, 'recorded', $7, $8, $9, $10, $11::jsonb)`,
      [
        eventId,
        context.unit_code,
        context.item_id,
        context.storage_assignment_id,
        context.machine_assignment_id,
        `${update_category}:${status}`,
        quantity ?? null,
        context.location_code,
        reported_by,
        notes || null,
        JSON.stringify({
          update_category,
          location_confirmed: Boolean(location_confirmed),
          active_location_type: context.active_location_type,
        }),
      ],
    );

    await client.query(
      `INSERT INTO activity_log (id, item_id, action, to_location, performed_by, notes)
       VALUES ($1, $2, 'note_added', $3, $4, $5)`,
      [
        uuidv4(),
        context.item_id,
        context.location_code,
        reported_by,
        `[${update_category}] ${status}${notes ? ` - ${notes}` : ''}`,
      ],
    );

    await client.query('COMMIT');

    const created = await client.query('SELECT * FROM unit_field_updates WHERE id = $1', [updateId]);
    res.status(201).json({ data: created.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));
