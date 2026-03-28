import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { processAssemblyQrCompile } from '../lib/qrAssemblyCompile';
import { processProductQrIntake } from '../lib/qrProductIntake';
import { getQrScanResult, getTabletSummary } from '../lib/qrRead';

export const qrLifecycleRouter = Router();

qrLifecycleRouter.post('/product-intake', asyncHandler(async (req, res) => {
  try {
    const result = await processProductQrIntake(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    handleRouteError(res, error);
  }
}));

qrLifecycleRouter.post('/assembly-compile', asyncHandler(async (req, res) => {
  try {
    const result = await processAssemblyQrCompile(req.body);
    res.status(201).json({ data: result });
  } catch (error) {
    handleRouteError(res, error);
  }
}));

qrLifecycleRouter.get('/tablet/summary', asyncHandler(async (_req, res) => {
  const result = await getTabletSummary();
  res.json({ data: result });
}));

qrLifecycleRouter.get('/:qrCode', asyncHandler(async (req, res) => {
  try {
    const result = await getQrScanResult(req.params.qrCode as string);
    res.json({ data: result });
  } catch (error) {
    handleRouteError(res, error);
  }
}));

function handleRouteError(
  res: { status: (code: number) => { json: (body: Record<string, unknown>) => void } },
  error: unknown,
) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'statusCode' in error &&
    typeof (error as { statusCode?: unknown }).statusCode === 'number' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    res.status((error as { statusCode: number }).statusCode).json({ error: (error as { message: string }).message });
    return;
  }

  throw error;
}
