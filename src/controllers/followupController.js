import mongoose from 'mongoose';
import { FollowUp } from '../models/FollowUp.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Get all follow-ups
 * @route   GET /api/v1/followups
 * @access  Public
 */
export const getAllFollowUps = asyncHandler(async (req, res) => {
  const { search, priority, status, department, dateFilter } = req.query;
  const filter = {};

  // Search inside personName, subject, or description (case-insensitive regex)
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { personName: searchRegex },
      { subject: searchRegex },
      { description: searchRegex },
    ];
  }

  // Exact filters, skipping 'All'
  if (priority && priority !== 'All') {
    filter.priority = priority;
  }

  if (status && status !== 'All') {
    filter.status = status;
  }

  if (department && department !== 'All') {
    filter.department = department;
  }

  // Date filters
  if (dateFilter) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    if (dateFilter === 'Today') {
      filter.nextFollowupDate = {
        $gte: today,
        $lte: new Date(today.setHours(23, 59, 59, 999)),
      };
    } else if (dateFilter === 'Tomorrow') {
      filter.nextFollowupDate = {
        $gte: tomorrow,
        $lte: new Date(tomorrow.setHours(23, 59, 59, 999)),
      };
    } else if (dateFilter === 'Overdue') {
      filter.nextFollowupDate = { $lt: today };
    }
  }

  const followups = await FollowUp.find(filter).sort({ nextFollowupDate: 1 });

  // Dynamically get unique departments from existing follow-ups
  const departments = await FollowUp.distinct('department');

  return sendSuccess(res, 'Follow-ups retrieved successfully', { followups, departments }, 200);
});

/**
 * @desc    Get a single follow-up by ID
 * @route   GET /api/v1/followups/:id
 * @access  Public
 */
export const getFollowUpById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid follow-up ID format', null, 400);
  }

  const followup = await FollowUp.findById(id);

  if (!followup) {
    return sendError(res, 'Follow-up not found', null, 404);
  }

  return sendSuccess(res, 'Follow-up retrieved successfully', followup, 200);
});

/**
 * @desc    Create a new follow-up
 * @route   POST /api/v1/followups
 * @access  Public
 */
export const createFollowUp = asyncHandler(async (req, res) => {
  const {
    personName,
    company,
    phoneNumber,
    subject,
    description,
    relatedTask,
    priority,
    status,
    nextFollowupDate,
    lastContactDate,
    department,
    notes,
  } = req.body;

  // Validation
  if (!personName) {
    return sendError(res, 'Person name is required', null, 400);
  }

  if (!subject) {
    return sendError(res, 'Subject is required', null, 400);
  }

  if (!nextFollowupDate) {
    return sendError(res, 'Next follow-up date is required', null, 400);
  }

  try {
    const followup = await FollowUp.create({
      personName,
      company,
      phoneNumber,
      subject,
      description,
      relatedTask,
      priority,
      status,
      nextFollowupDate,
      lastContactDate,
      department,
      notes,
    });

    return sendSuccess(res, 'Follow-up created successfully', followup, 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update a follow-up by ID
 * @route   PUT /api/v1/followups/:id
 * @access  Public
 */
export const updateFollowUp = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid follow-up ID format', null, 400);
  }

  try {
    const followup = await FollowUp.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!followup) {
      return sendError(res, 'Follow-up not found', null, 404);
    }

    return sendSuccess(res, 'Follow-up updated successfully', followup, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Delete a follow-up by ID
 * @route   DELETE /api/v1/followups/:id
 * @access  Public
 */
export const deleteFollowUp = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid follow-up ID format', null, 400);
  }

  const followup = await FollowUp.findByIdAndDelete(id);

  if (!followup) {
    return sendError(res, 'Follow-up not found', null, 404);
  }

  return sendSuccess(res, 'Follow-up deleted successfully', followup, 200);
});
