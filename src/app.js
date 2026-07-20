import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import taskRoutes from './routes/taskRoutes.js';
import goalRoutes from './routes/goalRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import projectRoutes from './routes/projectRoutes.js';
import knowledgeRoutes from './routes/knowledgeRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import followupRoutes from './routes/followupRoutes.js';
import workLogRoutes from './routes/workLogRoutes.js';
import { errorHandler } from './middlewares/errorHandler.js';

const app = express();

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://digitalpersonelsecretory.vercel.app'
  ]
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/events', eventRoutes);
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/knowledge', knowledgeRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/followups', followupRoutes);
app.use('/api/v1/worklogs', workLogRoutes);

/**
 * Health check endpoint.
 * Returns actual MongoDB connection state so the frontend can display
 * real Backend / Database status indicators.
 *
 * mongoose.connection.readyState values:
 *   0 = disconnected | 1 = connected | 2 = connecting | 3 = disconnecting
 */
app.get('/health', (_req, res) => {
  const dbState = mongoose.connection.readyState;
  const database = dbState === 1 ? 'connected' : 'disconnected';

  res.status(200).json({
    backend: 'online',
    database,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;

