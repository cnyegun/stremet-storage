"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
// Load .env if it exists, but don't overwrite existing process.env variables
dotenv_1.default.config();
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('DATABASE_URL is not set in environment variables');
}
const pool = new pg_1.Pool({
    connectionString: databaseUrl,
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
exports.default = pool;
