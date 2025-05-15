import express, { Request, Response } from 'express';

const router = express.Router();

/**
 * Health check endpoint
 * @route GET /health
 * @returns {object} 200 - Health status
 */
router.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

export { router as healthRoutes };
