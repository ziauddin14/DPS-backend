import mongoose from 'mongoose';
import { Goal } from '../models/Goal.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * Helper function to synchronize Goal status and progress.
 * If progress is 100, status becomes Completed.
 * If status is Completed, progress becomes 100.
 * If status is On Hold, it is left unchanged.
 *
 * @param {object} payload - The request body updates.
 * @param {object} [existingGoal] - The existing Goal document (for PUT).
 */
const syncGoalStatusAndProgress = (payload, existingGoal = null) => {
  const currentStatus = payload.status !== undefined
    ? payload.status
    : (existingGoal ? existingGoal.status : undefined);

  const currentProgress = payload.progress !== undefined
    ? Number(payload.progress)
    : (existingGoal ? existingGoal.progress : undefined);

  // If status is On Hold, leave it unchanged
  if (currentStatus === 'On Hold') {
    return;
  }

  if (currentProgress === 100) {
    payload.status = 'Completed';
  } else if (currentStatus === 'Completed') {
    payload.progress = 100;
  }
};

/**
 * @desc    Get all goals
 * @route   GET /api/v1/goals
 * @access  Public
 */
export const getAllGoals = asyncHandler(async (req, res) => {
  const { search, type, status, priority, category } = req.query;
  const filter = {};

  // Search inside title or description (case-insensitive regex)
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { title: searchRegex },
      { description: searchRegex },
    ];
  }

  // Exact filters, skipping 'All'
  if (type && type !== 'All') {
    filter.type = type;
  }

  if (priority && priority !== 'All') {
    filter.priority = priority;
  }

  if (status && status !== 'All') {
    filter.status = status;
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  const goals = await Goal.find(filter).sort({ createdAt: -1 });

  // Dynamically get unique categories from existing goals
  const categories = await Goal.distinct('category');

  return sendSuccess(res, 'Goals retrieved successfully', { goals, categories }, 200);
});

/**
 * @desc    Get a single goal by ID
 * @route   GET /api/v1/goals/:id
 * @access  Public
 */
export const getGoalById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid goal ID format', null, 400);
  }

  const goal = await Goal.findById(id);
  if (!goal) {
    return sendError(res, 'Goal not found', null, 404);
  }

  return sendSuccess(res, 'Goal retrieved successfully', goal, 200);
});

/**
 * @desc    Create a new goal
 * @route   POST /api/v1/goals
 * @access  Public
 */
export const createGoal = asyncHandler(async (req, res) => {
  // Sync status and progress in request body
  syncGoalStatusAndProgress(req.body);

  const {
    title,
    description,
    type,
    priority,
    status,
    progress,
    startDate,
    targetDate,
    completedDate,
    category,
    notes,
    color,
    icon,
  } = req.body;

  // Validation checks for required fields before saving
  if (!title) {
    return sendError(res, 'Title is required', null, 400);
  }
  if (!type) {
    return sendError(res, 'Type is required', null, 400);
  }

  try {
    const goal = await Goal.create({
      title,
      description,
      type,
      priority,
      status,
      progress,
      startDate,
      targetDate,
      completedDate,
      category,
      notes,
      color,
      icon,
    });

    return sendSuccess(res, 'Goal created successfully', goal, 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update a goal by ID
 * @route   PUT /api/v1/goals/:id
 * @access  Public
 */
export const updateGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid goal ID format', null, 400);
  }

  // Pre-validate required field checks in request body if provided
  if (req.body.title === null || req.body.title === '') {
    return sendError(res, 'Title cannot be empty', null, 400);
  }
  if (req.body.type === null || req.body.type === '') {
    return sendError(res, 'Type cannot be empty', null, 400);
  }

  const existingGoal = await Goal.findById(id);
  if (!existingGoal) {
    return sendError(res, 'Goal not found', null, 404);
  }

  // Sync status and progress in request body using existingGoal for context
  syncGoalStatusAndProgress(req.body, existingGoal);

  try {
    const goal = await Goal.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, 'Goal updated successfully', goal, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Delete a goal by ID
 * @route   DELETE /api/v1/goals/:id
 * @access  Public
 */
export const deleteGoal = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid goal ID format', null, 400);
  }

  const goal = await Goal.findByIdAndDelete(id);
  if (!goal) {
    return sendError(res, 'Goal not found', null, 404);
  }

  return sendSuccess(res, 'Goal deleted successfully', null, 200);
});
