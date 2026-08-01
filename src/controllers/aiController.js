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
  console.log('[aiController] === CHAT REQUEST START ===');
  console.log('[aiController] Request body:', JSON.stringify({ message, conversationId, conversationHistory }));
  
  const { message, conversationId, conversationHistory } = req.body;

  // 1. Validation
  console.log('[aiController] Step 1: Validation');
  if (!message || typeof message !== 'string' || !message.trim()) {
    console.log('[aiController] Validation failed: Message is required and cannot be empty');
    return sendError(res, 'Message is required and cannot be empty', null, 400);
  }
  console.log('[aiController] Validation passed');

  const trimmedMessage = message.trim();
  console.log('[aiController] Trimmed message:', trimmedMessage);
  let conversationDoc = null;

  // 2. Fetch or Auto-Create MongoDB Conversation Document
  console.log('[aiController] Step 2: Fetch/Create Conversation');
  console.log('[aiController] conversationId:', conversationId);
  if (conversationId && mongoose.Types.ObjectId.isValid(conversationId)) {
    console.log('[aiController] Attempting to fetch existing conversation');
    conversationDoc = await Conversation.findById(conversationId);
    console.log('[aiController] Existing conversation found:', !!conversationDoc);
  }

  if (!conversationDoc) {
    console.log('[aiController] Creating new conversation');
    conversationDoc = new Conversation({
      title: generateTitle(trimmedMessage),
      messages: [],
    });
    console.log('[aiController] New conversation created with ID:', conversationDoc._id.toString());
  }

  // Append user message to database document
  console.log('[aiController] Step 3: Append user message to conversation');
  conversationDoc.messages.push({
    role: 'user',
    content: trimmedMessage,
    createdAt: new Date(),
  });
  console.log('[aiController] User message appended. Total messages:', conversationDoc.messages.length);

  try {
    // 3. Build conversation history for context
    console.log('[aiController] Step 4: Build conversation history for context');
    const contextHistory =
      conversationDoc.messages.length > 1
        ? conversationDoc.messages.slice(0, -1).map((m) => ({ sender: m.role, text: m.content }))
        : conversationHistory;
    console.log('[aiController] Context history length:', contextHistory?.length || 0);

    // 4. Try AI Action Orchestrator first (for autonomous actions)
    console.log('[aiController] Step 5: Calling aiActionOrchestrator.orchestrateAction');
    console.log('[aiController] Params:', {
      message: trimmedMessage,
      conversationHistoryLength: contextHistory?.length || 0,
      conversationId: conversationDoc._id.toString(),
    });
    const actionResult = await orchestrateAction({
      message: trimmedMessage,
      conversationHistory: contextHistory,
      conversationId: conversationDoc._id.toString(),
    });
    console.log('[aiController] aiActionOrchestrator returned:', JSON.stringify({
      isAction: actionResult.isAction,
      reply: actionResult.reply?.substring(0, 100),
      toolUsed: actionResult.toolUsed,
      status: actionResult.status,
    }));

    let finalReply;
    let finalModel;
    let finalUsage;
    let finalResponseTime;
    let finalIsMock;
    let finalSuggestions;
    let finalToolUsed;
    let finalIsAction;

    // 5. If action was orchestrated, use that response
    console.log('[aiController] Step 6: Determine response source');
    if (actionResult.isAction && actionResult.reply) {
      console.log('[aiController] Using action-orchestrated response');
      finalReply = actionResult.reply;
      finalModel = actionResult.toolUsed || 'action-orchestrator';
      finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
      finalResponseTime = 0;
      finalIsMock = actionResult.executionResult?.isMock || false;
      finalSuggestions = actionResult.suggestions || [];
      finalToolUsed = actionResult.toolUsed;
      finalIsAction = true;
    } else {
      console.log('[aiController] Falling back to normal AI conversation');
      // 6. Fall back to normal AI conversation
      const result = await aiService.generateResponse({
        message: trimmedMessage,
        conversationHistory: contextHistory,
      });
      console.log('[aiController] aiService.generateResponse returned');

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
    console.log('[aiController] Step 7: Append AI response to conversation');
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
    console.log('[aiController] Step 8: Saving conversation to MongoDB');
    await conversationDoc.save();
    console.log('[aiController] Conversation saved successfully');

    // 8. Return Standardized DPS API Response with conversationId
    console.log('[aiController] Step 9: Sending success response');
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
    console.error('[aiController] === CHAT REQUEST ERROR ===');
    console.error('[aiController] Error name:', error.name);
    console.error('[aiController] Error message:', error.message);
    console.error('[aiController] Error stack:', error.stack);
    console.error('[aiController] Error statusCode:', error.statusCode);
    console.error('[aiController] Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    
    const statusCode = error.statusCode || 500;
    const errorMsg = error.message || 'Internal server error occurred while processing AI response.';

    return sendError(res, errorMsg, null, statusCode);
  }
});

export default {
  chat,
};
