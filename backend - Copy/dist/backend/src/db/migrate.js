"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pool_1 = __importDefault(require("./pool"));
async function migrate() {
    const client = await pool_1.default.connect();
    try {
        // Create migrations tracking table
        await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
        // Read migration files
        const migrationsDir = path_1.default.join(__dirname, '../../../database/migrations');
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(f => f.endsWith('.sql'))
            .sort();
        for (const file of files) {
            // Check if already applied
            const result = await client.query('SELECT id FROM _migrations WHERE name = $1', [file]);
            if (result.rows.length > 0) {
                console.log(`  skip: ${file} (already applied)`);
                continue;
            }
            // Apply migration
            const sql = fs_1.default.readFileSync(path_1.default.join(migrationsDir, file), 'utf-8');
            await client.query('BEGIN');
            try {
                await client.query(sql);
                await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
                await client.query('COMMIT');
                console.log(`  done: ${file}`);
            }
            catch (err) {
                await client.query('ROLLBACK');
                throw err;
            }
        }
        console.log('Migrations complete.');
    }
    finally {
        client.release();
        await pool_1.default.end();
    }
}
migrate().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
