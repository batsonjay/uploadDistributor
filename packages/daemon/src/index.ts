import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import { healthRoutes } from './routes/health';
import { uploadRoutes } from './routes/upload';
import { statusRoutes } from './routes/status';

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
app.use('/upload', uploadRoutes);
app.use('/status', statusRoutes);

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
