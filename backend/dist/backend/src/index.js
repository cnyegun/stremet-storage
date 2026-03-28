"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const racks_1 = require("./routes/racks");
const items_1 = require("./routes/items");
const activity_1 = require("./routes/activity");
const search_1 = require("./routes/search");
const stats_1 = require("./routes/stats");
const customers_1 = require("./routes/customers");
const machines_1 = require("./routes/machines");
const productionJobs_1 = require("./routes/productionJobs");
const assistant_1 = require("./routes/assistant");
const errorHandler_1 = require("./middleware/errorHandler");
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '4000', 10);
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express_1.default.json());
// Health check
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
});
// Routes
app.use('/api/racks', racks_1.racksRouter);
app.use('/api/items', items_1.itemsRouter);
app.use('/api/activity', activity_1.activityRouter);
app.use('/api/search', search_1.searchRouter);
app.use('/api/stats', stats_1.statsRouter);
app.use('/api/customers', customers_1.customersRouter);
app.use('/api/machines', machines_1.machinesRouter);
app.use('/api/production-jobs', productionJobs_1.productionJobsRouter);
app.use('/api/assistant', assistant_1.assistantRouter);
// Global error handler (must be after routes)
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`Stremet API running on http://localhost:${PORT}`);
});
