import mongoose from 'mongoose';
import { Project } from '../models/Project.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Get all projects
 * @route   GET /api/v1/projects
 * @access  Public
 */
export const getAllProjects = asyncHandler(async (req, res) => {
  const { search, status, priority, category } = req.query;
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
  if (status && status !== 'All') {
    filter.status = status;
  }

  if (priority && priority !== 'All') {
    filter.priority = priority;
  }

  if (category && category !== 'All') {
    filter.category = category;
  }

  // Return projects sorted newest first
  const projects = await Project.find(filter).sort({ createdAt: -1 });

  // Dynamically get unique categories from existing projects
  const categories = await Project.distinct('category');

  return sendSuccess(res, 'Projects retrieved successfully', { projects, categories }, 200);
});

/**
 * @desc    Get a single project by ID
 * @route   GET /api/v1/projects/:id
 * @access  Public
 */
export const getProjectById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid project ID format', null, 400);
  }

  const project = await Project.findById(id);
  if (!project) {
    return sendError(res, 'Project not found', null, 404);
  }

  return sendSuccess(res, 'Project retrieved successfully', project, 200);
});

/**
 * @desc    Create a new project
 * @route   POST /api/v1/projects
 * @access  Public
 */
export const createProject = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    status,
    priority,
    category,
    progress,
    startDate,
    deadline,
    client,
    technologies,
    notes,
    color,
  } = req.body;

  // Validation
  if (!title) {
    return sendError(res, 'Title is required', null, 400);
  }

  try {
    const project = await Project.create({
      title,
      description,
      status,
      priority,
      category,
      progress,
      startDate,
      deadline,
      client,
      technologies,
      notes,
      color,
    });

    return sendSuccess(res, 'Project created successfully', project, 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update a project by ID
 * @route   PUT /api/v1/projects/:id
 * @access  Public
 */
export const updateProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid project ID format', null, 400);
  }

  try {
    const project = await Project.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!project) {
      return sendError(res, 'Project not found', null, 404);
    }

    return sendSuccess(res, 'Project updated successfully', project, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Delete a project by ID
 * @route   DELETE /api/v1/projects/:id
 * @access  Public
 */
export const deleteProject = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid project ID format', null, 400);
  }

  const project = await Project.findByIdAndDelete(id);
  if (!project) {
    return sendError(res, 'Project not found', null, 404);
  }

  return sendSuccess(res, 'Project deleted successfully', null, 200);
});
