import type { NextFunction, Request, Response } from 'express';

interface PgError extends Error {
  code?: string;
  routine?: string;
}

export function errorHandler(
  err: PgError,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
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

  res.status(500).json({ 
    error: 'INTERNAL_DEBUG_ERROR',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    code: err.code
  });
}
