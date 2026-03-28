"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assistantRouter = void 0;
const express_1 = require("express");
const asyncHandler_1 = require("../middleware/asyncHandler");
const assistant_1 = require("../services/assistant");
exports.assistantRouter = (0, express_1.Router)();
exports.assistantRouter.post('/', (0, asyncHandler_1.asyncHandler)(async (req, res) => {
    const { message, history } = req.body;
    if (!message || typeof message !== 'string' || message.length > 2000) {
        res.status(400).json({ error: 'Message is required and must be under 2000 characters' });
        return;
    }
    if (history && (!Array.isArray(history) || history.length > 30)) {
        res.status(400).json({ error: 'History must be an array with at most 30 entries' });
        return;
    }
    const validHistory = (history || []).filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string');
    const result = await (0, assistant_1.handleAssistantMessage)(message, validHistory);
    res.json({ data: result });
}));
