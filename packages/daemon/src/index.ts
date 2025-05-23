import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
// Removed import for healthRoutes
import { receiveRoutes } from './routes/receive.js';
import { statusRoutes } from './routes/status.js';
import { default as authRoutes } from './routes/auth.js';
import { parseSonglistRoutes } from './routes/parse-songlist.js';
import { default as uploadRoutes } from './routes/upload.js';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({
  verify: (req, res, buf, encoding) => {
    console.log('JSON body parser called');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Body length:', buf.length);
    if (buf.length > 0) {
      try {
        const body = JSON.parse(buf.toString());
        console.log('Parsed JSON body:', body);
      } catch (e) {
        console.error('Failed to parse JSON body for logging:', e);
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

// Add a simple health check route directly
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

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
