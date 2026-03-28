import pool from '../db/pool';

export async function getQrScanResult(qrCode: string) {
  const qrResult = await pool.query(`
    SELECT
      qe.*,
      COALESCE(product_item.id, assembly_item.id) AS resolved_item_id,
      COALESCE(product_item.item_code, assembly_item.item_code) AS resolved_item_code,
      COALESCE(product_item.name, assembly_item.name) AS resolved_item_name,
      COALESCE(product_customer.name, assembly_customer.name) AS resolved_customer_name,
      sa.quantity AS storage_quantity,
      ma.quantity AS machine_quantity,
      ab.quantity AS assembly_quantity,
      r.code AS rack_code,
      ss.row_number,
      ss.column_number,
      m.code AS machine_code
    FROM qr_entities qe
    LEFT JOIN items product_item ON product_item.id = qe.item_id
    LEFT JOIN customers product_customer ON product_customer.id = product_item.customer_id
    LEFT JOIN storage_assignments sa ON sa.id = qe.storage_assignment_id AND sa.checked_out_at IS NULL
    LEFT JOIN machine_assignments ma ON ma.id = qe.machine_assignment_id AND ma.removed_at IS NULL
    LEFT JOIN assembly_batches ab ON ab.id = qe.assembly_batch_id
    LEFT JOIN items assembly_item ON assembly_item.id = ab.item_id
    LEFT JOIN customers assembly_customer ON assembly_customer.id = assembly_item.customer_id
    LEFT JOIN assembly_assignments aa ON aa.assembly_batch_id = ab.id AND aa.removed_at IS NULL
    LEFT JOIN shelf_slots ss ON ss.id = COALESCE(sa.shelf_slot_id, aa.shelf_slot_id)
    LEFT JOIN racks r ON r.id = ss.rack_id
    LEFT JOIN machines m ON m.id = ma.machine_id
    WHERE qe.qr_code = $1
    ORDER BY qe.created_at DESC
    LIMIT 1
  `, [qrCode]);

  if (qrResult.rows.length === 0) {
    throw httpError(404, 'QR code not found');
  }

  const qr = qrResult.rows[0];
  const progressResult = qr.resolved_item_id
    ? await pool.query('SELECT * FROM order_fulfillments WHERE item_id = $1', [qr.resolved_item_id])
    : { rows: [] as Record<string, unknown>[] };

  const locationCode = qr.machine_code
    ? `M/${qr.machine_code}`
    : qr.rack_code && qr.row_number && qr.column_number
      ? `${qr.rack_code}/R${qr.row_number}C${qr.column_number}`
      : null;

  return {
    qr_code: qr.qr_code,
    qr_type: qr.qr_type,
    status: qr.status,
    item_id: qr.resolved_item_id,
    item_code: qr.resolved_item_code,
    item_name: qr.resolved_item_name,
    customer_name: qr.resolved_customer_name,
    quantity: qr.storage_quantity || qr.machine_quantity || qr.assembly_quantity || 0,
    location_code: locationCode,
    location_type: qr.machine_code ? 'machine' : qr.assembly_batch_id ? 'assembly' : qr.storage_assignment_id ? 'storage' : 'none',
    order_progress: progressResult.rows[0] || null,
  };
}

export async function getTabletSummary() {
  const [productResult, assemblyResult, progressResult, alertsResult] = await Promise.all([
    pool.query(`
      SELECT qe.qr_code, sa.unit_code, i.item_code, i.name AS item_name, c.name AS customer_name, sa.quantity,
        r.code AS rack_code, r.label AS rack_label, ss.row_number, ss.column_number,
        CONCAT(r.code, '/R', ss.row_number, 'C', ss.column_number) AS location_code
      FROM qr_entities qe
      JOIN storage_assignments sa ON sa.id = qe.storage_assignment_id AND sa.checked_out_at IS NULL
      JOIN items i ON i.id = sa.item_id
      LEFT JOIN customers c ON c.id = i.customer_id
      JOIN shelf_slots ss ON ss.id = sa.shelf_slot_id
      JOIN racks r ON r.id = ss.rack_id
      WHERE qe.qr_type = 'product' AND qe.status = 'active'
      ORDER BY r.display_order, ss.row_number, ss.column_number
    `),
    pool.query(`
      SELECT qe.qr_code, ab.assembly_code, i.item_code, i.name AS item_name, aa.quantity,
        r.code AS rack_code, r.label AS rack_label, ss.row_number, ss.column_number,
        CONCAT(r.code, '/R', ss.row_number, 'C', ss.column_number) AS location_code, ab.status
      FROM qr_entities qe
      JOIN assembly_batches ab ON ab.id = qe.assembly_batch_id
      JOIN items i ON i.id = ab.item_id
      LEFT JOIN assembly_assignments aa ON aa.assembly_batch_id = ab.id AND aa.removed_at IS NULL
      LEFT JOIN shelf_slots ss ON ss.id = aa.shelf_slot_id
      LEFT JOIN racks r ON r.id = ss.rack_id
      WHERE qe.qr_type = 'assembly' AND qe.status = 'active'
      ORDER BY ab.created_at DESC
    `),
    pool.query(`
      SELECT ofl.item_id, i.item_code, i.name AS item_name, ofl.requested_quantity, ofl.fulfilled_quantity,
        GREATEST(ofl.requested_quantity - ofl.fulfilled_quantity, 0) AS remaining_quantity, ofl.status
      FROM order_fulfillments ofl
      JOIN items i ON i.id = ofl.item_id
      ORDER BY ofl.updated_at DESC
    `),
    pool.query(`
      SELECT ma.*, ie.event_type, ie.source AS event_source, ie.location_code, ie.unit_code, sd.device_code
      FROM manager_alerts ma
      JOIN inventory_events ie ON ie.id = ma.inventory_event_id
      LEFT JOIN sensor_devices sd ON sd.id = ie.sensor_device_id
      WHERE ma.status = 'open'
      ORDER BY ma.created_at DESC
      LIMIT 20
    `),
  ]);

  return {
    active_product_qrs: productResult.rows,
    active_assembly_qrs: assemblyResult.rows,
    order_progress: progressResult.rows,
    open_alerts: alertsResult.rows,
  };
}

function httpError(statusCode: number, message: string) {
  return Object.assign(new Error(message), { statusCode });
}
