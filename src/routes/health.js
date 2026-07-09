import { Router } from 'express';
import { sendSuccess } from '../utils/apiResponse.js';

const router = Router();

/**
 * GET /api/v1/health
 * Returns application health status.
 */
router.get('/health', (req, res) => {
  return sendSuccess(res, 'DPS Backend is running successfully', {
    status: 'healthy',
  });
});

export default router;
