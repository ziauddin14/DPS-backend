import mongoose from 'mongoose';
import { Knowledge } from '../models/Knowledge.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Get all knowledge entries
 * @route   GET /api/v1/knowledge
 * @access  Public
 */
export const getAllKnowledge = asyncHandler(async (req, res) => {
  const { search, type, category, favorite } = req.query;
  const filter = {};

  // Search in title, content, or tags (case-insensitive regex)
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { title: searchRegex },
      { content: searchRegex },
      { tags: searchRegex },
    ];
  }

  // Exact filters, skipping 'All'
  if (type && type !== 'All') {
    filter.type = type;
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  // favorite filter: only apply when explicitly 'true'
  if (favorite === 'true') {
    filter.favorite = true;
  }

  // Return entries sorted newest first
  const knowledge = await Knowledge.find(filter).sort({ createdAt: -1 });

  // Dynamically get unique categories from existing entries
  const categories = await Knowledge.distinct('category');

  return sendSuccess(
    res,
    'Knowledge entries retrieved successfully',
    { knowledge, categories },
    200
  );
});

/**
 * @desc    Get a single knowledge entry by ID
 * @route   GET /api/v1/knowledge/:id
 * @access  Public
 */
export const getKnowledgeById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid knowledge ID format', null, 400);
  }

  const entry = await Knowledge.findById(id);
  if (!entry) {
    return sendError(res, 'Knowledge entry not found', null, 404);
  }

  return sendSuccess(res, 'Knowledge entry retrieved successfully', entry, 200);
});

/**
 * @desc    Create a new knowledge entry
 * @route   POST /api/v1/knowledge
 * @access  Public
 */
export const createKnowledge = asyncHandler(async (req, res) => {
  const { title, content, type, category, tags, source, favorite, color, icon } =
    req.body;

  if (!title) {
    return sendError(res, 'Title is required', null, 400);
  }
  if (!type) {
    return sendError(res, 'Type is required', null, 400);
  }

  try {
    const entry = await Knowledge.create({
      title,
      content,
      type,
      category,
      tags,
      source,
      favorite,
      color,
      icon,
    });

    return sendSuccess(res, 'Knowledge entry created successfully', entry, 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update a knowledge entry by ID
 * @route   PUT /api/v1/knowledge/:id
 * @access  Public
 */
export const updateKnowledge = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid knowledge ID format', null, 400);
  }

  try {
    const entry = await Knowledge.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!entry) {
      return sendError(res, 'Knowledge entry not found', null, 404);
    }

    return sendSuccess(res, 'Knowledge entry updated successfully', entry, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Delete a knowledge entry by ID
 * @route   DELETE /api/v1/knowledge/:id
 * @access  Public
 */
export const deleteKnowledge = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid knowledge ID format', null, 400);
  }

  const entry = await Knowledge.findByIdAndDelete(id);
  if (!entry) {
    return sendError(res, 'Knowledge entry not found', null, 404);
  }

  return sendSuccess(res, 'Knowledge entry deleted successfully', null, 200);
});
