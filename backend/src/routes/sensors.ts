import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/pool';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  buildSensorLocationCode,
  getSensorContextByDeviceCode,
  listCandidateUnitCodesForSensor,
} from '../lib/unitMonitoring';

export const sensorsRouter = Router();

sensorsRouter.post('/readings', asyncHandler(async (req, res) => {
  const {
    device_code,
    weight_kg,
    recorded_at,
    battery_level,
    raw_payload,
  } = req.body;

  if (!device_code || typeof weight_kg !== 'number') {
    res.status(400).json({ error: 'device_code and numeric weight_kg are required' });
    return;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const sensor = await getSensorContextByDeviceCode(client, device_code);
    if (!sensor) {
      await client.query('ROLLBACK');
      res.status(404).json({ error: 'Sensor device not found' });
      return;
    }

    const previousReadingResult = await client.query<{ weight_kg: string }>(`
      SELECT weight_kg
      FROM sensor_readings
      WHERE sensor_device_id = $1
      ORDER BY recorded_at DESC
      LIMIT 1
    `, [sensor.sensor_device_id]);

    const readingId = uuidv4();
    await client.query(
      `INSERT INTO sensor_readings (
        id,
        sensor_device_id,
        recorded_at,
        weight_kg,
        battery_level,
        raw_payload
      ) VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4, $5, $6::jsonb)`,
      [
        readingId,
        sensor.sensor_device_id,
        recorded_at || null,
        weight_kg,
        battery_level ?? null,
        JSON.stringify(raw_payload || {}),
      ],
    );

    await client.query(
      `UPDATE sensor_devices
       SET last_seen_at = COALESCE($2::timestamptz, NOW()),
           status = 'active',
           updated_at = NOW()
       WHERE id = $1`,
      [sensor.sensor_device_id, recorded_at || null],
    );

    const previousWeight = previousReadingResult.rows[0] ? Number(previousReadingResult.rows[0].weight_kg) : null;
    const delta = previousWeight === null ? null : weight_kg - previousWeight;

    let eventId: string | null = null;
    let alertId: string | null = null;

    if (delta !== null && Math.abs(delta) >= Number(sensor.threshold)) {
      const candidateUnitCodes = await listCandidateUnitCodesForSensor(client, sensor);
      const locationCode = buildSensorLocationCode(sensor);
      const isDrop = delta < 0;

      eventId = uuidv4();
      await client.query(
        `INSERT INTO inventory_events (
          id,
          sensor_device_id,
          source,
          event_type,
          event_status,
          location_code,
          notes,
          metadata
        ) VALUES ($1, $2, 'sensor', $3, $4, $5, $6, $7::jsonb)`,
        [
          eventId,
          sensor.sensor_device_id,
          isDrop ? 'sensor_weight_drop' : 'sensor_weight_increase',
          isDrop ? 'open' : 'recorded',
          locationCode,
          `Sensor ${device_code} reported weight delta ${delta.toFixed(2)} kg`,
          JSON.stringify({
            device_code,
            previous_weight_kg: previousWeight,
            current_weight_kg: weight_kg,
            delta_kg: delta,
            candidate_unit_codes: candidateUnitCodes,
          }),
        ],
      );

      if (isDrop) {
        alertId = uuidv4();
        await client.query(
          `INSERT INTO manager_alerts (
            id,
            inventory_event_id,
            alert_type,
            severity,
            status,
            summary,
            details
          ) VALUES ($1, $2, 'unconfirmed_weight_drop', 'medium', 'open', $3, $4)`,
          [
            alertId,
            eventId,
            `Weight drop detected at ${locationCode}`,
            candidateUnitCodes.length > 0
              ? `Candidate units in area: ${candidateUnitCodes.join(', ')}`
              : 'No active tracked units were found in the sensor area.',
          ],
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      data: {
        reading_id: readingId,
        sensor_device_id: sensor.sensor_device_id,
        delta_kg: delta,
        event_id: eventId,
        alert_id: alertId,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}));

sensorsRouter.get('/alerts', asyncHandler(async (req, res) => {
  const { status = 'open' } = req.query;
  const params: string[] = [];
  let whereClause = '';

  if (typeof status === 'string' && status) {
    params.push(status);
    whereClause = 'WHERE ma.status = $1';
  }

  const result = await pool.query(`
    SELECT
      ma.*,
      ie.event_type,
      ie.source AS event_source,
      ie.location_code,
      ie.unit_code,
      sd.device_code
    FROM manager_alerts ma
    JOIN inventory_events ie ON ie.id = ma.inventory_event_id
    LEFT JOIN sensor_devices sd ON sd.id = ie.sensor_device_id
    ${whereClause}
    ORDER BY ma.created_at DESC
  `, params);

  res.json({
    data: result.rows,
    total: result.rows.length,
    page: 1,
    per_page: result.rows.length,
  });
}));
