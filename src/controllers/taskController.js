import mongoose from 'mongoose';
import { Task } from '../models/Task.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Get all tasks
 * @route   GET /api/v1/tasks
 * @access  Public
 */
export const getAllTasks = asyncHandler(async (req, res) => {
  const { search, priority, status, category, department, dependency, month } = req.query;
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
  if (priority && priority !== 'All') {
    filter.priority = priority;
  }

  if (status && status !== 'All') {
    filter.status = status;
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  if (department && department !== 'All') {
    filter.department = department;
  }

  if (dependency && dependency !== 'All') {
    filter.dependency = { $in: [dependency] };
  }

  // Month filter - filter tasks by deadline month
  if (month && month !== 'All') {
    const monthIndex = parseInt(month, 10);
    if (!isNaN(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
      const currentYear = new Date().getFullYear();
      const startDate = new Date(currentYear, monthIndex, 1);
      const endDate = new Date(currentYear, monthIndex + 1, 0, 23, 59, 59, 999);
      filter.deadline = {
        $gte: startDate,
        $lte: endDate
      };
    }
  }

  const tasks = await Task.find(filter).sort({ createdAt: -1 });

  // Dynamically get unique categories from existing tasks
  const categories = await Task.distinct('category');
  // Dynamically get unique departments from existing tasks
  const departments = await Task.distinct('department');

  return sendSuccess(res, 'Tasks retrieved successfully', { tasks, categories, departments }, 200);
});

/**
 * @desc    Get a single task by ID
 * @route   GET /api/v1/tasks/:id
 * @access  Public
 */
export const getTaskById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid task ID format', null, 400);
  }

  const task = await Task.findById(id);
  if (!task) {
    return sendError(res, 'Task not found', null, 404);
  }

  return sendSuccess(res, 'Task retrieved successfully', task, 200);
});

/**
 * @desc    Create a new task
 * @route   POST /api/v1/tasks
 * @access  Public
 */
export const createTask = asyncHandler(async (req, res) => {
  
  const { title, description, priority, status, category, department, dependency, deadline, delayReason, completed } = req.body;

  // Validation
  if (!title) {
    return sendError(res, 'Title is required', null, 400);
  }

  // Handle dependency: convert string to array for backward compatibility
  let dependencyArray = [];
  if (Array.isArray(dependency)) {
    dependencyArray = dependency;
  } else if (typeof dependency === 'string' && dependency.trim() !== '') {
    dependencyArray = [dependency];
  }

  try {
    const task = await Task.create({
      title,
      description,
      priority,
      status,
      category,
      department,
      dependency: dependencyArray,
      deadline,
      delayReason,
      completed,
    });

    return sendSuccess(res, 'Task created successfully', task, 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update a task by ID
 * @route   PUT /api/v1/tasks/:id
 * @access  Public
 */
export const updateTask = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { dependency, ...otherFields } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid task ID format', null, 400);
  }

  // Handle dependency: convert string to array for backward compatibility
  let updateData = { ...otherFields };
  if (dependency !== undefined) {
    if (Array.isArray(dependency)) {
      updateData.dependency = dependency;
    } else if (typeof dependency === 'string' && dependency.trim() !== '') {
      updateData.dependency = [dependency];
    } else {
      updateData.dependency = [];
    }
  }

  try {
    const task = await Task.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!task) {
      return sendError(res, 'Task not found', null, 404);
    }

    return sendSuccess(res, 'Task updated successfully', task, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Delete a task by ID
 * @route   DELETE /api/v1/tasks/:id
 * @access  Public
 */
export const deleteTask = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid task ID format', null, 400);
  }

  const task = await Task.findByIdAndDelete(id);
  if (!task) {
    return sendError(res, 'Task not found', null, 404);
  }

  return sendSuccess(res, 'Task deleted successfully', null, 200);
});
