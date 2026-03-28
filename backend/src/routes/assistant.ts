import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { handleAssistantMessage } from '../services/assistant';

export const assistantRouter = Router();

assistantRouter.post('/', asyncHandler(async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || message.length > 2000) {
    res.status(400).json({ error: 'Message is required and must be under 2000 characters' });
    return;
  }

  if (history && (!Array.isArray(history) || history.length > 30)) {
    res.status(400).json({ error: 'History must be an array with at most 30 entries' });
    return;
  }

  const validHistory = (history || []).filter(
    (h: { role?: string; content?: string }) =>
      h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string'
  );

  const result = await handleAssistantMessage(message, validHistory);
  res.json({ data: result });
}));
