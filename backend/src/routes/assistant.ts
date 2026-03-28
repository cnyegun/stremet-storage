import { Router } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { handleAssistantMessage } from '../services/assistant';

export const assistantRouter = Router();

assistantRouter.post('/', asyncHandler(async (req, res) => {
  const { message, history, imageBase64 } = req.body;

  if ((!message || typeof message !== 'string') && !imageBase64) {
    res.status(400).json({ error: 'Message or image is required' });
    return;
  }

  if (message && message.length > 2000) {
    res.status(400).json({ error: 'Message must be under 2000 characters' });
    return;
  }

  if (imageBase64 && (typeof imageBase64 !== 'string' || !imageBase64.startsWith('data:image/') || imageBase64.length > 500_000)) {
    res.status(400).json({ error: 'Image must be a valid data URL under 500KB' });
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

  const result = await handleAssistantMessage(message || '', validHistory, imageBase64);
  res.json({ data: result });
}));
