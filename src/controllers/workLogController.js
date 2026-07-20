import { WorkLog } from '../models/WorkLog.js';
import { Task } from '../models/Task.js';
import { FollowUp } from '../models/FollowUp.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Get all work logs with optional filters
 * @route   GET /api/v1/worklogs
 * @access  Public
 */
export const getAllWorkLogs = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    department,
    dateFilter,
    startDate,
    endDate,
  } = req.query;

  // Build query
  const query = {};

  // Search in title and description
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  // Category filter
  if (category && category !== 'All') {
    query.category = category;
  }

  // Department filter
  if (department && department !== 'All') {
    query.department = department;
  }

  // Date filters
  if (dateFilter || startDate || endDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const startOfWeek = new Date(today);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    if (dateFilter === 'Today') {
      query.activityDate = { $gte: today, $lte: endOfDay };
    } else if (dateFilter === 'Yesterday') {
      query.activityDate = { $gte: yesterday, $lt: today };
    } else if (dateFilter === 'This Week') {
      query.activityDate = { $gte: startOfWeek, $lte: endOfDay };
    } else if (dateFilter === 'This Month') {
      query.activityDate = { $gte: startOfMonth, $lte: endOfDay };
    } else if (startDate || endDate) {
      query.activityDate = {};
      if (startDate) {
        query.activityDate.$gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.activityDate.$lte = end;
      }
    }
  }

  // Populate related task and followup
  const workLogs = await WorkLog.find(query)
    .populate('relatedTask', 'title')
    .populate('relatedFollowup', 'personName subject')
    .sort({ activityDate: -1, createdAt: -1 });

  return sendSuccess(res, 'Work logs retrieved successfully', workLogs, 200);
});

/**
 * @desc    Get single work log by ID
 * @route   GET /api/v1/worklogs/:id
 * @access  Public
 */
export const getWorkLogById = asyncHandler(async (req, res) => {
  const workLog = await WorkLog.findById(req.params.id)
    .populate('relatedTask', 'title')
    .populate('relatedFollowup', 'personName subject');

  if (!workLog) {
    return sendError(res, 'Work log not found', 404);
  }

  return sendSuccess(res, 'Work log retrieved successfully', workLog, 200);
});

/**
 * @desc    Create new work log
 * @route   POST /api/v1/worklogs
 * @access  Public
 */
export const createWorkLog = asyncHandler(async (req, res) => {
  const {
    title,
    category,
    description,
    activityDate,
    startTime,
    endTime,
    durationMinutes,
    relatedTask,
    relatedFollowup,
    department,
    createdBy,
  } = req.body;

  // Calculate duration if start and end time provided
  let calculatedDuration = durationMinutes;
  if (startTime && endTime && !durationMinutes) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const diffMs = end - start;
    const duration = Math.floor(diffMs / 60000); // Convert to minutes
    // Only use calculated duration if it's positive
    if (duration > 0) {
      calculatedDuration = duration;
    }
  }

  const workLog = await WorkLog.create({
    title,
    category,
    description,
    activityDate,
    startTime,
    endTime,
    durationMinutes: calculatedDuration,
    relatedTask,
    relatedFollowup,
    department,
    createdBy,
  });

  const populatedWorkLog = await WorkLog.findById(workLog._id)
    .populate('relatedTask', 'title')
    .populate('relatedFollowup', 'personName subject');

  return sendSuccess(res, 'Work log created successfully', populatedWorkLog, 201);
});

/**
 * @desc    Update work log
 * @route   PUT /api/v1/worklogs/:id
 * @access  Public
 */
export const updateWorkLog = asyncHandler(async (req, res) => {
  const {
    title,
    category,
    description,
    activityDate,
    startTime,
    endTime,
    durationMinutes,
    relatedTask,
    relatedFollowup,
    department,
  } = req.body;

  const workLog = await WorkLog.findById(req.params.id);

  if (!workLog) {
    return sendError(res, 'Work log not found', 404);
  }

  // Calculate duration if start and end time provided
  let calculatedDuration = durationMinutes;
  if (startTime && endTime && !durationMinutes) {
    const start = new Date(`2000-01-01 ${startTime}`);
    const end = new Date(`2000-01-01 ${endTime}`);
    const diffMs = end - start;
    const duration = Math.floor(diffMs / 60000); // Convert to minutes
    // Only use calculated duration if it's positive
    if (duration > 0) {
      calculatedDuration = duration;
    }
  }

  workLog.title = title || workLog.title;
  workLog.category = category || workLog.category;
  workLog.description = description !== undefined ? description : workLog.description;
  workLog.activityDate = activityDate || workLog.activityDate;
  workLog.startTime = startTime !== undefined ? startTime : workLog.startTime;
  workLog.endTime = endTime !== undefined ? endTime : workLog.endTime;
  workLog.durationMinutes = calculatedDuration !== undefined ? calculatedDuration : workLog.durationMinutes;
  workLog.relatedTask = relatedTask !== undefined ? relatedTask : workLog.relatedTask;
  workLog.relatedFollowup = relatedFollowup !== undefined ? relatedFollowup : workLog.relatedFollowup;
  workLog.department = department !== undefined ? department : workLog.department;

  await workLog.save();

  const populatedWorkLog = await WorkLog.findById(workLog._id)
    .populate('relatedTask', 'title')
    .populate('relatedFollowup', 'personName subject');

  return sendSuccess(res, 'Work log updated successfully', populatedWorkLog, 200);
});

/**
 * @desc    Delete work log
 * @route   DELETE /api/v1/worklogs/:id
 * @access  Public
 */
export const deleteWorkLog = asyncHandler(async (req, res) => {
  const workLog = await WorkLog.findById(req.params.id);

  if (!workLog) {
    return sendError(res, 'Work log not found', 404);
  }

  await WorkLog.findByIdAndDelete(req.params.id);

  return sendSuccess(res, 'Work log deleted successfully', null, 200);
});
