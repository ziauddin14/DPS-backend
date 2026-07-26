import express from 'express';
import {
  createConversation,
  getAllConversations,
  getLatestConversation,
  getConversationById,
  updateConversation,
  appendMessages,
  deleteConversation,
} from '../controllers/conversationController.js';

const router = express.Router();

// GET /api/v1/conversations
// POST /api/v1/conversations
router.route('/').get(getAllConversations).post(createConversation);

// GET /api/v1/conversations/latest (MUST come before /:id)
router.get('/latest', getLatestConversation);

// GET /api/v1/conversations/:id
// PATCH /api/v1/conversations/:id
// DELETE /api/v1/conversations/:id
router
  .route('/:id')
  .get(getConversationById)
  .patch(updateConversation)
  .delete(deleteConversation);

// PATCH /api/v1/conversations/:id/messages
router.patch('/:id/messages', appendMessages);

export default router;
