import express from 'express';
import { chat } from '../controllers/aiController.js';

const router = express.Router();

// POST /api/v1/ai/chat
router.post('/chat', chat);

export default router;
