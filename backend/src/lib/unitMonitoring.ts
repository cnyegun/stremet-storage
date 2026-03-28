import type { PoolClient } from 'pg';
import { buildRackLocationCode } from './rackCells';

type UnitContext = {
  unit_code: string;
  item_id: string;
  item_code: string;
  item_name: string;
  customer_name: string | null;
  active_location_type: 'storage' | 'machine';
  storage_assignment_id: string | null;
  machine_assignment_id: string | null;
  location_code: string;
  rack_code: string | null;
  rack_label: string | null;
  row_number: number | null;
  column_number: number | null;
  machine_code: string | null;
  machine_name: string | null;
  quantity: number;
};

type SensorContext = {
  sensor_device_id: string;
  device_code: string;
  rack_id: string | null;
  shelf_slot_id: string | null;
  rack_code: string | null;
  rack_label: string | null;
  row_number: number | null;
  column_number: number | null;
  threshold: number;
  baseline_weight_kg: number;
};

export async function getUnitContext(client: PoolClient, unitCode: string): Promise<UnitContext | null> {
  const storageResult = await client.query<UnitContext>(`
    SELECT
      sa.unit_code,
      i.id AS item_id,
      i.item_code,
      i.name AS item_name,
      c.name AS customer_name,
      'storage'::text AS active_location_type,
      sa.id AS storage_assignment_id,
      NULL::uuid AS machine_assignment_id,
      r.code AS rack_code,
      r.label AS rack_label,
      ss.row_number,
      ss.column_number,
      NULL::text AS machine_code,
      NULL::text AS machine_name,
      sa.quantity
    FROM storage_assignments sa
    JOIN items i ON i.id = sa.item_id
    LEFT JOIN customers c ON c.id = i.customer_id
    JOIN shelf_slots ss ON ss.id = sa.shelf_slot_id
    JOIN racks r ON r.id = ss.rack_id
    WHERE sa.unit_code = $1
      AND sa.checked_out_at IS NULL
    ORDER BY sa.checked_in_at DESC
    LIMIT 1
  `, [unitCode]);

  if (storageResult.rows.length > 0) {
    const row = storageResult.rows[0];
    return {
      ...row,
      location_code: buildRackLocationCode(row.rack_code || '?', row.row_number || 0, row.column_number || 0),
    };
  }

  const machineResult = await client.query<UnitContext>(`
    SELECT
      ma.unit_code,
      i.id AS item_id,
      i.item_code,
      i.name AS item_name,
      c.name AS customer_name,
      'machine'::text AS active_location_type,
      NULL::uuid AS storage_assignment_id,
      ma.id AS machine_assignment_id,
      NULL::text AS rack_code,
      NULL::text AS rack_label,
      NULL::integer AS row_number,
      NULL::integer AS column_number,
      m.code AS machine_code,
      m.name AS machine_name,
      ma.quantity
    FROM machine_assignments ma
    JOIN items i ON i.id = ma.item_id
    LEFT JOIN customers c ON c.id = i.customer_id
    JOIN machines m ON m.id = ma.machine_id
    WHERE ma.unit_code = $1
      AND ma.removed_at IS NULL
    ORDER BY ma.assigned_at DESC
    LIMIT 1
  `, [unitCode]);

  if (machineResult.rows.length === 0) {
    return null;
  }

  const row = machineResult.rows[0];
  return {
    ...row,
    location_code: row.machine_code || 'MACHINE',
  };
}

export async function getRecentUnitUpdates(client: PoolClient, unitCode: string) {
  const result = await client.query(`
    SELECT *
    FROM unit_field_updates
    WHERE unit_code = $1
    ORDER BY created_at DESC
    LIMIT 10
  `, [unitCode]);

  return result.rows;
}

export async function getSensorContextByDeviceCode(client: PoolClient, deviceCode: string): Promise<SensorContext | null> {
  const result = await client.query<SensorContext>(`
    SELECT
      sd.id AS sensor_device_id,
      sd.device_code,
      sd.rack_id,
      sd.shelf_slot_id,
      r.code AS rack_code,
      r.label AS rack_label,
      ss.row_number,
      ss.column_number,
      sd.alert_drop_threshold_kg AS threshold,
      sd.baseline_weight_kg
    FROM sensor_devices sd
    LEFT JOIN shelf_slots ss ON ss.id = sd.shelf_slot_id
    LEFT JOIN racks r ON r.id = COALESCE(ss.rack_id, sd.rack_id)
    WHERE sd.device_code = $1
    LIMIT 1
  `, [deviceCode]);

  return result.rows[0] || null;
}

export function buildSensorLocationCode(context: SensorContext) {
  if (context.rack_code && context.row_number && context.column_number) {
    return buildRackLocationCode(context.rack_code, context.row_number, context.column_number);
  }

  if (context.rack_code) {
    return context.rack_code;
  }

  return context.device_code;
}

export async function listCandidateUnitCodesForSensor(client: PoolClient, context: SensorContext) {
  if (context.shelf_slot_id) {
    const result = await client.query<{ unit_code: string }>(`
      SELECT sa.unit_code
      FROM storage_assignments sa
      WHERE sa.shelf_slot_id = $1
        AND sa.checked_out_at IS NULL
      ORDER BY sa.checked_in_at DESC
    `, [context.shelf_slot_id]);

    return result.rows.map((row) => row.unit_code);
  }

  if (context.rack_id) {
    const result = await client.query<{ unit_code: string }>(`
      SELECT sa.unit_code
      FROM storage_assignments sa
      JOIN shelf_slots ss ON ss.id = sa.shelf_slot_id
      WHERE ss.rack_id = $1
        AND sa.checked_out_at IS NULL
      ORDER BY sa.checked_in_at DESC
    `, [context.rack_id]);

    return result.rows.map((row) => row.unit_code);
  }

  return [];
}
