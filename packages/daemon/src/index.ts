import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
// Removed import for healthRoutes
import { receiveRoutes } from './routes/receive.js';
import { statusRoutes } from './routes/status.js';
import { default as authRoutes } from './routes/auth.js';
import { parseSonglistRoutes } from './routes/parse-songlist.js';
import { default as uploadRoutes } from './routes/upload.js';
import { sendRoutes } from './routes/send.js';
import { log, logError } from '@uploadDistributor/logging';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    log('D:ROUTE', 'RO:010', 'JSON body parser called');
    log('D:ROUTE', 'RO:011', `Content-Type: ${req.headers['content-type']}`);
    log('D:ROUTE', 'RO:012', `Body length: ${buf.length}`);
    if (buf.length > 0) {
      try {
        const body = JSON.parse(buf.toString());
        log('D:ROUTE', 'RO:013', `Parsed JSON body:`, body);
      } catch (e) {
        logError('D:ROUTE', 'RO:014', 'Failed to parse JSON body for logging:', e);
      }
    }
  }
}));

// Routes
// Removed healthRoutes
app.use('/receive', receiveRoutes); // Updated to use the new endpoint name
app.use('/status', statusRoutes);
app.use('/api/auth', authRoutes);
app.use('/parse-songlist', parseSonglistRoutes);
app.use('/upload', uploadRoutes); // New upload endpoint with DJ selection support
app.use('/send', sendRoutes); // New send endpoint for the updated file sending flow

// Add a simple health check route directly
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  log('D:SYSTEM', 'SY:001', `Daemon running on http://localhost:${PORT}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  log('D:SYSTEM', 'SY:002', 'SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('SIGINT', () => {
  log('D:SYSTEM', 'SY:003', 'SIGINT signal received: closing HTTP server');
  process.exit(0);
});

export default app;
