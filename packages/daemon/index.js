import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Daemon running on http://localhost:${PORT}`);
});
