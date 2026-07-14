import express from 'express';
import {
  getAllFollowUps,
  getFollowUpById,
  createFollowUp,
  updateFollowUp,
  deleteFollowUp,
} from '../controllers/followupController.js';

const router = express.Router();

// GET /api/v1/followups - Get all follow-ups
router.get('/', getAllFollowUps);

// GET /api/v1/followups/:id - Get a single follow-up
router.get('/:id', getFollowUpById);

// POST /api/v1/followups - Create a new follow-up
router.post('/', createFollowUp);

// PUT /api/v1/followups/:id - Update a follow-up
router.put('/:id', updateFollowUp);

// DELETE /api/v1/followups/:id - Delete a follow-up
router.delete('/:id', deleteFollowUp);

export default router;
