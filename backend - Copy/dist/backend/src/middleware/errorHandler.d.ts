import type { NextFunction, Request, Response } from 'express';
interface PgError extends Error {
    code?: string;
    routine?: string;
}
export declare function errorHandler(err: PgError, _req: Request, res: Response, next: NextFunction): void;
export {};
