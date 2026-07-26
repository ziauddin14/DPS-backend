import mongoose from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import Conversation from '../models/Conversation.js';

/**
 * @desc    Create a new conversation
 * @route   POST /api/v1/conversations
 * @access  Public
 */
export const createConversation = asyncHandler(async (req, res) => {
  const { title, messages } = req.body;

  const conversation = await Conversation.create({
    title: title || 'New Conversation',
    messages: Array.isArray(messages) ? messages : [],
  });

  return sendSuccess(
    res,
    'Conversation created successfully',
    {
      conversationId: conversation._id,
      conversation,
    },
    201
  );
});

/**
 * @desc    Get all conversations
 * @route   GET /api/v1/conversations
 * @access  Public
 */
export const getAllConversations = asyncHandler(async (req, res) => {
  const conversations = await Conversation.find().sort({ updatedAt: -1 });
  return sendSuccess(res, 'Conversations retrieved successfully', conversations, 200);
});

/**
 * @desc    Get the most recently updated conversation
 * @route   GET /api/v1/conversations/latest
 * @access  Public
 */
export const getLatestConversation = asyncHandler(async (req, res) => {
  const conversation = await Conversation.findOne().sort({ updatedAt: -1 });

  if (!conversation) {
    return sendSuccess(res, 'No conversations found', null, 200);
  }

  return sendSuccess(
    res,
    'Latest conversation retrieved successfully',
    {
      conversationId: conversation._id,
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      conversation,
    },
    200
  );
});

/**
 * @desc    Get a single conversation by ID
 * @route   GET /api/v1/conversations/:id
 * @access  Public
 */
export const getConversationById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid conversation ID format', null, 400);
  }

  const conversation = await Conversation.findById(id);

  if (!conversation) {
    return sendError(res, 'Conversation not found', null, 404);
  }

  return sendSuccess(
    res,
    'Conversation retrieved successfully',
    {
      conversationId: conversation._id,
      title: conversation.title,
      messages: conversation.messages,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      conversation,
    },
    200
  );
});

/**
 * @desc    Update conversation title by ID
 * @route   PATCH /api/v1/conversations/:id
 * @access  Public
 */
export const updateConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid conversation ID format', null, 400);
  }

  if (!title || typeof title !== 'string' || !title.trim()) {
    return sendError(res, 'Title is required and cannot be empty', null, 400);
  }

  const conversation = await Conversation.findByIdAndUpdate(
    id,
    { $set: { title: title.trim() } },
    { new: true, runValidators: true }
  );

  if (!conversation) {
    return sendError(res, 'Conversation not found', null, 404);
  }

  return sendSuccess(res, 'Conversation updated successfully', conversation, 200);
});

/**
 * @desc    Append messages to an existing conversation
 * @route   PATCH /api/v1/conversations/:id/messages
 * @access  Public
 */
export const appendMessages = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const newMessages = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid conversation ID format', null, 400);
  }

  const messageList = Array.isArray(newMessages)
    ? newMessages
    : Array.isArray(req.body.messages)
    ? req.body.messages
    : null;

  if (!messageList || messageList.length === 0) {
    return sendError(res, 'Messages array is required for appending', null, 400);
  }

  const conversation = await Conversation.findByIdAndUpdate(
    id,
    {
      $push: { messages: { $each: messageList } },
    },
    { new: true, runValidators: true }
  );

  if (!conversation) {
    return sendError(res, 'Conversation not found', null, 404);
  }

  return sendSuccess(res, 'Messages appended successfully', conversation, 200);
});

/**
 * @desc    Delete a conversation by ID
 * @route   DELETE /api/v1/conversations/:id
 * @access  Public
 */
export const deleteConversation = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid conversation ID format', null, 400);
  }

  const conversation = await Conversation.findByIdAndDelete(id);

  if (!conversation) {
    return sendError(res, 'Conversation not found', null, 404);
  }

  return sendSuccess(res, 'Conversation deleted successfully', { id }, 200);
});

export default {
  createConversation,
  getAllConversations,
  getLatestConversation,
  getConversationById,
  updateConversation,
  appendMessages,
  deleteConversation,
};
