import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { racksRouter } from './routes/racks';
import { itemsRouter } from './routes/items';
import { activityRouter } from './routes/activity';
import { searchRouter } from './routes/search';
import { statsRouter } from './routes/stats';
import { customersRouter } from './routes/customers';
import { machinesRouter } from './routes/machines';
import { productionJobsRouter } from './routes/productionJobs';
import { assistantRouter } from './routes/assistant';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '4000', 10);

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
}));
app.use(express.json());

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/racks', racksRouter);
app.use('/api/items', itemsRouter);
app.use('/api/activity', activityRouter);
app.use('/api/search', searchRouter);
app.use('/api/stats', statsRouter);
app.use('/api/customers', customersRouter);
app.use('/api/machines', machinesRouter);
app.use('/api/production-jobs', productionJobsRouter);
app.use('/api/assistant', assistantRouter);

// Global error handler (must be after routes)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Stremet API running on http://localhost:${PORT}`);
});
