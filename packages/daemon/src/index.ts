import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { healthRoutes } from './routes/health.js';
import { receiveRoutes } from './routes/receive.js';
import { statusRoutes } from './routes/status.js';
import { default as authRoutes } from './routes/auth.js';
import { parseSonglistRoutes } from './routes/parse-songlist.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/receive', receiveRoutes); // Updated to use the new endpoint name
app.use('/status', statusRoutes);
app.use('/api/auth', authRoutes);
app.use('/parse-songlist', parseSonglistRoutes);

// Start server
app.listen(PORT, () => {
  console.log(`Daemon running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;
