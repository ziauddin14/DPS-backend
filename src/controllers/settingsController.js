import mongoose from 'mongoose';
import { Settings } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME_RE    = /^([01]\d|2[0-3]):[0-5]\d$/;

const VALID_THEMES      = ['Light', 'Dark', 'System'];
const VALID_PRIORITIES  = ['High', 'Medium', 'Low'];
const VALID_LANGUAGES   = ['English', 'Arabic', 'French', 'Spanish', 'German', 'Urdu'];
const VALID_TIMEZONES   = [
  'UTC', 'Asia/Karachi', 'Asia/Kolkata', 'Asia/Dubai',
  'Europe/London', 'Europe/Berlin', 'America/New_York',
  'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney',
];
const VALID_DATE_FORMATS = ['YYYY-MM-DD', 'MM/DD/YYYY', 'DD/MM/YYYY', 'DD MMM YYYY'];
const VALID_TIME_FORMATS = ['12-hour', '24-hour'];

/**
 * Validate and sanitise a settings payload.
 * Returns { errors: string[], cleaned: object }.
 * @param {object} body - Raw request body.
 */
function validateBody(body) {
  const errors  = [];
  const cleaned = {};

  // userName — required, non-empty after trim
  const userName = typeof body.userName === 'string' ? body.userName.trim() : '';
  if (!userName) {
    errors.push('Full Name is required.');
  } else {
    cleaned.userName = userName;
  }

  // designation — optional string
  if (body.designation !== undefined) {
    cleaned.designation = String(body.designation).trim();
  }

  // email — optional but validated when provided
  if (body.email !== undefined) {
    const email = String(body.email).trim();
    if (email && !EMAIL_RE.test(email)) {
      errors.push('Email address is not valid.');
    } else {
      cleaned.email = email;
    }
  }

  // phone — optional string, trimmed
  if (body.phone !== undefined) {
    cleaned.phone = String(body.phone).trim();
  }

  // company — optional string, trimmed
  if (body.company !== undefined) {
    cleaned.company = String(body.company).trim();
  }

  // about — optional string, trimmed
  if (body.about !== undefined) {
    cleaned.about = String(body.about).trim();
  }

  // theme — must be a valid enum value
  if (body.theme !== undefined) {
    if (!VALID_THEMES.includes(body.theme)) {
      errors.push(`Theme must be one of: ${VALID_THEMES.join(', ')}.`);
    } else {
      cleaned.theme = body.theme;
    }
  }

  // language
  if (body.language !== undefined) {
    if (!VALID_LANGUAGES.includes(body.language)) {
      errors.push(`Language must be one of: ${VALID_LANGUAGES.join(', ')}.`);
    } else {
      cleaned.language = body.language;
    }
  }

  // timezone
  if (body.timezone !== undefined) {
    if (!VALID_TIMEZONES.includes(body.timezone)) {
      errors.push('Invalid timezone value.');
    } else {
      cleaned.timezone = body.timezone;
    }
  }

  // dateFormat
  if (body.dateFormat !== undefined) {
    if (!VALID_DATE_FORMATS.includes(body.dateFormat)) {
      errors.push(`Date format must be one of: ${VALID_DATE_FORMATS.join(', ')}.`);
    } else {
      cleaned.dateFormat = body.dateFormat;
    }
  }

  // timeFormat
  if (body.timeFormat !== undefined) {
    if (!VALID_TIME_FORMATS.includes(body.timeFormat)) {
      errors.push(`Time format must be one of: ${VALID_TIME_FORMATS.join(', ')}.`);
    } else {
      cleaned.timeFormat = body.timeFormat;
    }
  }

  // workingHoursStart / End — HH:MM format
  if (body.workingHoursStart !== undefined) {
    const val = String(body.workingHoursStart).trim();
    if (val && !TIME_RE.test(val)) {
      errors.push('Working Hours Start must be in HH:MM format.');
    } else {
      cleaned.workingHoursStart = val;
    }
  }

  if (body.workingHoursEnd !== undefined) {
    const val = String(body.workingHoursEnd).trim();
    if (val && !TIME_RE.test(val)) {
      errors.push('Working Hours End must be in HH:MM format.');
    } else {
      cleaned.workingHoursEnd = val;
    }
  }

  // defaultPriority
  if (body.defaultPriority !== undefined) {
    if (!VALID_PRIORITIES.includes(body.defaultPriority)) {
      errors.push(`Default Priority must be one of: ${VALID_PRIORITIES.join(', ')}.`);
    } else {
      cleaned.defaultPriority = body.defaultPriority;
    }
  }

  // Boolean toggles
  const boolFields = [
    'dashboardGreeting',
    'dailyReminder',
    'emailNotifications',
    'desktopNotifications',
    'autoBackup',
  ];
  for (const field of boolFields) {
    if (body[field] !== undefined) {
      cleaned[field] = Boolean(body[field]);
    }
  }

  return { errors, cleaned };
}

// ── Singleton enforcement helper ──────────────────────────────────────────────

/**
 * Returns the single Settings document.
 * If multiple exist (data anomaly), keeps the oldest and removes extras.
 * If none exists, creates one with schema defaults.
 */
async function getSingletonSettings() {
  const all = await Settings.find({}).sort({ createdAt: 1 }).lean();

  if (all.length === 0) {
    return Settings.create({});
  }

  if (all.length > 1) {
    // Keep oldest; delete all others
    const extraIds = all.slice(1).map((s) => s._id);
    await Settings.deleteMany({ _id: { $in: extraIds } });
  }

  // Return the canonical (oldest) document as a full Mongoose doc
  return Settings.findById(all[0]._id);
}

// ── Controllers ───────────────────────────────────────────────────────────────

/**
 * @desc    Get application configuration settings (singleton).
 * @route   GET /api/v1/settings
 * @access  Public
 */
export const getSettings = asyncHandler(async (_req, res) => {
  const settings = await getSingletonSettings();
  return sendSuccess(res, 'Settings retrieved successfully', settings, 200);
});

/**
 * @desc    Update application configuration settings (singleton, whitelisted).
 * @route   PUT /api/v1/settings
 * @access  Public
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const { errors, cleaned } = validateBody(req.body);

  if (errors.length > 0) {
    return sendError(res, errors.join(' '), null, 400);
  }

  // Locate (or create) the singleton document
  const existing = await getSingletonSettings();

  try {
    const settings = await Settings.findByIdAndUpdate(
      existing._id,
      { $set: cleaned },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, 'Settings updated successfully', settings, 200);
  } catch (error) {
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return sendError(res, messages.join(', '), null, 400);
    }
    throw error;
  }
});
