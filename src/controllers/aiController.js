import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import aiService from '../services/aiService.js';
import Conversation from '../models/Conversation.js';

/**
 * Clean short title generator from initial user message text.
 */
function generateTitle(text) {
  if (!text) return 'New Conversation';
  const cleaned = text
    .replace(/[^\w\s]/gi, '')
    .replace(/\b(can|you|please|i|want|to|the|a|an|me|my|for|on|in|at|with|regarding|about|should|do)\b/gi, '')
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'Work Discussion';
  return words.slice(0, 4).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * @desc    Process AI chat prompt, auto-persist to MongoDB Conversation document, and return AI response
 * @route   POST /api/v1/ai/chat
 * @access  Public
 */
export const chat = asyncHandler(async (req, res) => {
  const { message, conversationId, conversationHistory } = req.body;

  // 1. Validation
  if (!message || typeof message !== 'string' || !message.trim()) {
    return sendError(res, 'Message is required and cannot be empty', null, 400);
  }

  const trimmedMessage = message.trim();
  let conversationDoc = null;

  // 2. Fetch or Auto-Create MongoDB Conversation Document
  if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
    conversationDoc = await Conversation.findById(conversationId);
  }

  if (!conversationDoc) {
    conversationDoc = new Conversation({
      title: generateTitle(trimmedMessage),
      messages: [],
    });
  }

  // Append user message to database document
  conversationDoc.messages.push({
    role: 'user',
    content: trimmedMessage,
    createdAt: new Date(),
  });

  try {
    // 3. Call AI Service (passing current conversation history from database or body fallback)
    const contextHistory =
      conversationDoc.messages.length > 1
        ? conversationDoc.messages.slice(0, -1).map((m) => ({ sender: m.role, text: m.content }))
        : conversationHistory;

    const result = await aiService.generateResponse({
      message: trimmedMessage,
      conversationHistory: contextHistory,
    });

    // 4. Append AI Assistant response to MongoDB document
    conversationDoc.messages.push({
      role: 'assistant',
      content: result.reply,
      metadata: {
        model: result.model,
        tokens: result.usage?.totalTokens || 0,
        responseTime: result.responseTime || 0,
        isMock: result.isMock || false,
      },
      createdAt: new Date(),
    });

    // Update default title if needed
    if (conversationDoc.title === 'New Conversation') {
      conversationDoc.title = generateTitle(trimmedMessage);
    }

    // Save document to MongoDB
    await conversationDoc.save();

    // 5. Return Standardized DPS API Response with conversationId
    return sendSuccess(
      res,
      'AI response generated successfully',
      {
        conversationId: conversationDoc._id,
        reply: result.reply,
        message: result.reply, // Dual format compatibility
        model: result.model,
        usage: result.usage,
        responseTime: result.responseTime,
        finishReason: result.finishReason,
        isMock: result.isMock,
      },
      200
    );
  } catch (error) {
    console.error('[aiController Chat Error]:', error);
    const statusCode = error.statusCode || 500;
    const errorMsg = error.message || 'Internal server error occurred while processing AI response.';

    return sendError(res, errorMsg, null, statusCode);
  }
});

export default {
  chat,
};
