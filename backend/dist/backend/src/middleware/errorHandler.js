"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, next) {
    void next;
    console.error(`[ERROR] ${err.message}`);
    // PostgreSQL invalid input syntax (e.g., malformed UUID)
    if (err.code === '22P02') {
        res.status(400).json({ error: 'Invalid ID format' });
        return;
    }
    // PostgreSQL foreign key violation
    if (err.code === '23503') {
        res.status(400).json({ error: 'Referenced record not found' });
        return;
    }
    // PostgreSQL unique violation
    if (err.code === '23505') {
        res.status(409).json({ error: 'Duplicate record' });
        return;
    }
    res.status(500).json({ error: 'Internal server error' });
}
