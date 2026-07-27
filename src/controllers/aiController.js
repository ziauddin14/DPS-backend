import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import aiService from '../services/aiService.js';
import { orchestrateAction } from '../services/aiActionOrchestrator.js';
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
    // 3. Build conversation history for context
    const contextHistory =
      conversationDoc.messages.length > 1
        ? conversationDoc.messages.slice(0, -1).map((m) => ({ sender: m.role, text: m.content }))
        : conversationHistory;

    // 4. Try AI Action Orchestrator first (for autonomous actions)
    const actionResult = await orchestrateAction({
      message: trimmedMessage,
      conversationHistory: contextHistory,
      conversationId: conversationDoc._id.toString(),
    });

    let finalReply;
    let finalModel;
    let finalUsage;
    let finalResponseTime;
    let finalIsMock;
    let finalSuggestions;
    let finalToolUsed;
    let finalIsAction;

    // 5. If action was orchestrated, use that response
    if (actionResult.isAction && actionResult.reply) {
      finalReply = actionResult.reply;
      finalModel = actionResult.toolUsed || 'action-orchestrator';
      finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      finalResponseTime = 0;
      finalIsMock = actionResult.executionResult?.isMock || false;
      finalSuggestions = actionResult.suggestions || [];
      finalToolUsed = actionResult.toolUsed;
      finalIsAction = true;
    } else {
      // 6. Fall back to normal AI conversation
      const result = await aiService.generateResponse({
        message: trimmedMessage,
        conversationHistory: contextHistory,
      });

      finalReply = result.reply;
      finalModel = result.model;
      finalUsage = result.usage;
      finalResponseTime = result.responseTime;
      finalIsMock = result.isMock;
      finalSuggestions = [];
      finalToolUsed = null;
      finalIsAction = false;
    }

    // 7. Append AI Assistant response to MongoDB document
    conversationDoc.messages.push({
      role: 'assistant',
      content: finalReply,
      metadata: {
        model: finalModel,
        tokens: finalUsage?.totalTokens || 0,
        responseTime: finalResponseTime || 0,
        isMock: finalIsMock || false,
        toolUsed: finalToolUsed,
        isAction: finalIsAction,
      },
      createdAt: new Date(),
    });

    // Update default title if needed
    if (conversationDoc.title === 'New Conversation') {
      conversationDoc.title = generateTitle(trimmedMessage);
    }

    // Save document to MongoDB
    await conversationDoc.save();

    // 8. Return Standardized DPS API Response with conversationId
    return sendSuccess(
      res,
      'AI response generated successfully',
      {
        conversationId: conversationDoc._id,
        reply: finalReply,
        message: finalReply, // Dual format compatibility
        model: finalModel,
        usage: finalUsage,
        responseTime: finalResponseTime,
        finishReason: finalIsAction ? 'tool_call' : 'stop',
        isMock: finalIsMock,
        suggestions: finalSuggestions,
        toolUsed: finalToolUsed,
        isAction: finalIsAction,
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
