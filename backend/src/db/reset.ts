import pool from './pool';

async function reset(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS activity_log CASCADE;
      DROP TABLE IF EXISTS machine_assignments CASCADE;
      DROP TABLE IF EXISTS machines CASCADE;
      DROP TABLE IF EXISTS storage_assignments CASCADE;
      DROP TABLE IF EXISTS items CASCADE;
      DROP TABLE IF EXISTS customers CASCADE;
      DROP TABLE IF EXISTS shelf_slots CASCADE;
      DROP TABLE IF EXISTS racks CASCADE;
      DROP TABLE IF EXISTS _migrations CASCADE;
    `);
    console.log('Database reset complete. All tables dropped.');
  } finally {
    client.release();
    await pool.end();
  }
}

reset().catch((err: unknown) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
