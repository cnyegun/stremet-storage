"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pool_1 = __importDefault(require("./pool"));
async function reset() {
    const client = await pool_1.default.connect();
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
      DROP TABLE IF EXISTS zones CASCADE;
      DROP TABLE IF EXISTS _migrations CASCADE;
    `);
        console.log('Database reset complete. All tables dropped.');
    }
    finally {
        client.release();
        await pool_1.default.end();
    }
}
reset().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
});
