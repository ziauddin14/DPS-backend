import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

/**
 * @desc    Get all events
 * @route   GET /api/v1/events
 * @access  Public
 */
export const getAllEvents = asyncHandler(async (req, res) => {
  const { search, type, date, fromDate, toDate } = req.query;
  const filter = {};

  // Search in title or description (case-insensitive regex)
  if (search) {
    const searchRegex = new RegExp(search, 'i');
    filter.$or = [
      { title: searchRegex },
      { description: searchRegex },
    ];
  }

  // Filter by event type, skipping 'All'
  if (type && type !== 'All') {
    filter.type = type;
  }

  // Date range filter (fromDate/toDate) takes priority over single-day filter
  if (fromDate || toDate) {
    filter.startDate = {};
    if (fromDate) filter.startDate.$gte = new Date(fromDate);
    if (toDate)   filter.startDate.$lte = new Date(toDate);
  } else if (date && date !== 'All') {
    // Legacy single-day filter: start of day to end of day
    const startOfDay = new Date(date);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setUTCHours(23, 59, 59, 999);
    filter.startDate = { $gte: startOfDay, $lte: endOfDay };
  }

  // Sort by startDate ascending so nearest events appear first
  const events = await Event.find(filter).sort({ startDate: 1 });

  return sendSuccess(res, 'Events retrieved successfully', events, 200);
});

/**
 * @desc    Get a single event by ID
 * @route   GET /api/v1/events/:id
 * @access  Public
 */
export const getEventById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid event ID format', null, 400);
  }

  const event = await Event.findById(id);
  if (!event) {
    return sendError(res, 'Event not found', null, 404);
  }

  return sendSuccess(res, 'Event retrieved successfully', event, 200);
});

/**
 * @desc    Create a new event
 * @route   POST /api/v1/events
 * @access  Public
 */
export const createEvent = asyncHandler(async (req, res) => {
  const {
    title,
    description,
    type,
    startDate,
    endDate,
    time,
    location,
    reminder,
    reminderTime,
    notes,
    color,
  } = req.body;

  // Validation
  if (!title) {
    return sendError(res, 'Title is required', null, 400);
  }
  if (!type) {
    return sendError(res, 'Type is required', null, 400);
  }
  if (!startDate) {
    return sendError(res, 'Start date is required', null, 400);
  }

  try {
    const event = await Event.create({
      title,
      description,
      type,
      startDate,
      endDate,
      time,
      location,
      reminder,
      reminderTime,
      notes,
      color,
    });

    return sendSuccess(res, 'Event created successfully', event, 201);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Update an event by ID
 * @route   PUT /api/v1/events/:id
 * @access  Public
 */
export const updateEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid event ID format', null, 400);
  }

  // Pre-validate empty fields if provided in update payload
  if (req.body.title === null || req.body.title === '') {
    return sendError(res, 'Title cannot be empty', null, 400);
  }
  if (req.body.type === null || req.body.type === '') {
    return sendError(res, 'Type cannot be empty', null, 400);
  }
  if (req.body.startDate === null || req.body.startDate === '') {
    return sendError(res, 'Start date cannot be empty', null, 400);
  }

  try {
    const event = await Event.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!event) {
      return sendError(res, 'Event not found', null, 404);
    }

    return sendSuccess(res, 'Event updated successfully', event, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((val) => val.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});

/**
 * @desc    Delete an event by ID
 * @route   DELETE /api/v1/events/:id
 * @access  Public
 */
export const deleteEvent = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, 'Invalid event ID format', null, 400);
  }

  const event = await Event.findByIdAndDelete(id);
  if (!event) {
    return sendError(res, 'Event not found', null, 404);
  }

  return sendSuccess(res, 'Event deleted successfully', null, 200);
});
