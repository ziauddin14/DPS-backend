import { getTool, toolExists } from '../tools/toolRegistry.js';
import Task from '../models/Task.js';
import Goal from '../models/Goal.js';
import Project from '../models/Project.js';
import Event from '../models/Event.js';
import FollowUp from '../models/FollowUp.js';
import Knowledge from '../models/Knowledge.js';
import WorkLog from '../models/WorkLog.js';
import mongoose from 'mongoose';

// ============================================================
//  IN-MEMORY AUDIT LOG STORE
// ============================================================
const executionAuditLogs = [];
const MAX_AUDIT_LOGS = 500;

/**
 * Log a tool execution event to the internal audit trail.
 */
function recordAuditLog({ conversationId, tool, status, executionTimeMs, parameters, error = null }) {
  const entry = {
    id: `exec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString(),
    conversationId: conversationId || null,
    tool,
    status,
    executionTimeMs,
    parameters: parameters || {},
    error,
  };

  executionAuditLogs.unshift(entry);
  if (executionAuditLogs.length > MAX_AUDIT_LOGS) {
    executionAuditLogs.pop();
  }

  // Audit log recorded (no console.log per BUG #2 fix)
}

// ============================================================
//  VALIDATION HELPERS
// ============================================================

/**
 * Validate MongoDB ObjectId format
 */
function isValidObjectId(id) {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * Check for duplicate task title
 */
async function isDuplicateTask(title) {
  const existing = await Task.findOne({ title: title.trim() });
  return existing !== null;
}

/**
 * Check for duplicate goal title
 */
async function isDuplicateGoal(title) {
  const existing = await Goal.findOne({ title: title.trim() });
  return existing !== null;
}

/**
 * Check for duplicate project title
 */
async function isDuplicateProject(title) {
  const existing = await Project.findOne({ title: title.trim() });
  return existing !== null;
}

// ============================================================
//  TOOL HANDLER IMPLEMENTATIONS (Dispatches to Mongoose Models)
// ============================================================

const HANDLERS = {
  // ── TASKS ─────────────────────────────────────────────────
  createTask: async (params) => {
    // Duplicate validation
    const duplicate = await isDuplicateTask(params.title);
    if (duplicate) {
      throw new Error(`A task with the title "${params.title}" already exists.`);
    }
    
    const task = await Task.create({
      title: params.title,
      description: params.description || '',
      priority: params.priority || 'Medium',
      status: params.status || 'Pending',
      deadline: params.deadline ? new Date(params.deadline) : undefined,
      category: params.category || 'General',
      department: params.department || 'General',
      dependency: Array.isArray(params.dependency) ? params.dependency : [],
    });
    return task;
  },

  updateTask: async (params) => {
    const { id, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid task ID format: '${id}'.`);
    }
    if (updates.deadline) updates.deadline = new Date(updates.deadline);
    const task = await Task.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!task) throw new Error(`Task with ID '${id}' not found.`);
    return task;
  },

  deleteTask: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid task ID format: '${params.id}'.`);
    }
    const task = await Task.findByIdAndDelete(params.id);
    if (!task) throw new Error(`Task with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  getTask: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid task ID format: '${params.id}'.`);
    }
    const task = await Task.findById(params.id);
    if (!task) throw new Error(`Task with ID '${params.id}' not found.`);
    return task;
  },

  getTasks: async (params) => {
    const filter = {};
    if (params.status) filter.status = params.status;
    if (params.priority) filter.priority = params.priority;
    if (params.category) filter.category = params.category;
    const limit = params.limit ? Number(params.limit) : 50;
    const tasks = await Task.find(filter).sort({ createdAt: -1 }).limit(limit);
    return tasks;
  },

  completeTask: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid task ID format: '${params.id}'.`);
    }
    const task = await Task.findByIdAndUpdate(
      params.id,
      { status: 'Completed', completed: true },
      { new: true }
    );
    if (!task) throw new Error(`Task with ID '${params.id}' not found.`);
    return task;
  },

  // ── GOALS ─────────────────────────────────────────────────
  createGoal: async (params) => {
    // Duplicate validation
    const duplicate = await isDuplicateGoal(params.title);
    if (duplicate) {
      throw new Error(`A goal with the title "${params.title}" already exists.`);
    }
    
    const goal = await Goal.create({
      title: params.title,
      description: params.description || '',
      type: params.type || 'Weekly',
      priority: params.priority || 'Medium',
      status: params.status || 'Not Started',
      targetDate: params.deadline ? new Date(params.deadline) : undefined,
    });
    return goal;
  },

  updateGoal: async (params) => {
    const { id, deadline, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid goal ID format: '${id}'.`);
    }
    if (deadline) updates.targetDate = new Date(deadline);
    const goal = await Goal.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!goal) throw new Error(`Goal with ID '${id}' not found.`);
    return goal;
  },

  deleteGoal: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid goal ID format: '${params.id}'.`);
    }
    const goal = await Goal.findByIdAndDelete(params.id);
    if (!goal) throw new Error(`Goal with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  getGoals: async (params) => {
    const filter = {};
    if (params.status) filter.status = params.status;
    if (params.priority) filter.priority = params.priority;
    const limit = params.limit ? Number(params.limit) : 50;
    const goals = await Goal.find(filter).sort({ createdAt: -1 }).limit(limit);
    return goals;
  },

  // ── PROJECTS ──────────────────────────────────────────────
  createProject: async (params) => {
    // Duplicate validation
    const duplicate = await isDuplicateProject(params.title);
    if (duplicate) {
      throw new Error(`A project with the title "${params.title}" already exists.`);
    }
    
    const project = await Project.create({
      title: params.title,
      description: params.description || '',
      status: params.status || 'Planning',
      priority: params.priority || 'Medium',
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      deadline: params.endDate ? new Date(params.endDate) : undefined,
      department: params.department || 'General',
    });
    return project;
  },

  updateProject: async (params) => {
    const { id, endDate, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid project ID format: '${id}'.`);
    }
    if (endDate) updates.deadline = new Date(endDate);
    const project = await Project.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!project) throw new Error(`Project with ID '${id}' not found.`);
    return project;
  },

  deleteProject: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid project ID format: '${params.id}'.`);
    }
    const project = await Project.findByIdAndDelete(params.id);
    if (!project) throw new Error(`Project with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  getProjects: async (params) => {
    const filter = {};
    if (params.status) filter.status = params.status;
    if (params.priority) filter.priority = params.priority;
    const limit = params.limit ? Number(params.limit) : 50;
    const projects = await Project.find(filter).sort({ createdAt: -1 }).limit(limit);
    return projects;
  },

  // ── MEETINGS (Events) ──────────────────────────────────────
  createMeeting: async (params) => {
    const meeting = await Event.create({
      title: params.title,
      description: params.description || '',
      type: 'Meeting',
      startDate: params.date ? new Date(params.date) : new Date(),
      time: params.startTime || '',
      location: params.location || '',
      notes: Array.isArray(params.attendees) ? `Attendees: ${params.attendees.join(', ')}` : '',
    });
    return meeting;
  },

  updateMeeting: async (params) => {
    const { id, date, startTime, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid meeting ID format: '${id}'.`);
    }
    if (date) updates.startDate = new Date(date);
    if (startTime) updates.time = startTime;
    const meeting = await Event.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!meeting) throw new Error(`Meeting with ID '${id}' not found.`);
    return meeting;
  },

  deleteMeeting: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid meeting ID format: '${params.id}'.`);
    }
    const meeting = await Event.findByIdAndDelete(params.id);
    if (!meeting) throw new Error(`Meeting with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  getMeetings: async (params) => {
    const filter = { type: 'Meeting' };
    if (params.startDate || params.endDate) {
      filter.startDate = {};
      if (params.startDate) filter.startDate.$gte = new Date(params.startDate);
      if (params.endDate) filter.startDate.$lte = new Date(params.endDate);
    }
    const limit = params.limit ? Number(params.limit) : 50;
    const meetings = await Event.find(filter).sort({ startDate: 1 }).limit(limit);
    return meetings;
  },

  // ── FOLLOW-UPS ────────────────────────────────────────────
  createFollowUp: async (params) => {
    const followup = await FollowUp.create({
      personName: params.contactPerson || params.title,
      subject: params.title,
      description: params.description || '',
      nextFollowupDate: params.followUpDate ? new Date(params.followUpDate) : new Date(),
      priority: params.priority || 'Medium',
      status: params.status || 'Pending',
      relatedProject: params.relatedProject || null,
    });
    return followup;
  },

  updateFollowUp: async (params) => {
    const { id, followUpDate, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid follow-up ID format: '${id}'.`);
    }
    if (followUpDate) updates.nextFollowupDate = new Date(followUpDate);
    const followup = await FollowUp.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!followup) throw new Error(`Follow-up with ID '${id}' not found.`);
    return followup;
  },

  deleteFollowUp: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid follow-up ID format: '${params.id}'.`);
    }
    const followup = await FollowUp.findByIdAndDelete(params.id);
    if (!followup) throw new Error(`Follow-up with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  getFollowUps: async (params) => {
    const filter = {};
    if (params.status) filter.status = params.status;
    if (params.priority) filter.priority = params.priority;
    const limit = params.limit ? Number(params.limit) : 50;
    const followups = await FollowUp.find(filter).sort({ nextFollowupDate: 1 }).limit(limit);
    return followups;
  },

  // ── KNOWLEDGE ─────────────────────────────────────────────
  createKnowledge: async (params) => {
    const entry = await Knowledge.create({
      title: params.title,
      content: params.content || '',
      type: 'Note',
      tags: Array.isArray(params.tags) ? params.tags : [],
      category: params.category || 'General',
      source: params.source || '',
    });
    return entry;
  },

  updateKnowledge: async (params) => {
    const { id, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid knowledge ID format: '${id}'.`);
    }
    const entry = await Knowledge.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!entry) throw new Error(`Knowledge entry with ID '${id}' not found.`);
    return entry;
  },

  deleteKnowledge: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid knowledge ID format: '${params.id}'.`);
    }
    const entry = await Knowledge.findByIdAndDelete(params.id);
    if (!entry) throw new Error(`Knowledge entry with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  searchKnowledge: async (params) => {
    const query = params.query ? params.query.trim() : '';
    const filter = {};
    if (query) {
      filter.$or = [
        { title: new RegExp(query, 'i') },
        { content: new RegExp(query, 'i') },
        { tags: query },
      ];
    }
    if (params.category) filter.category = params.category;
    const limit = params.limit ? Number(params.limit) : 20;
    const entries = await Knowledge.find(filter).sort({ updatedAt: -1 }).limit(limit);
    return entries;
  },

  getKnowledge: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid knowledge ID format: '${params.id}'.`);
    }
    const entry = await Knowledge.findById(params.id);
    if (!entry) throw new Error(`Knowledge entry with ID '${params.id}' not found.`);
    return entry;
  },

  // ── WORK LOGS ─────────────────────────────────────────────
  createWorkLog: async (params) => {
    const log = await WorkLog.create({
      title: params.title,
      description: params.description || '',
      durationMinutes: params.hoursSpent ? Number(params.hoursSpent) * 60 : 60,
      activityDate: params.date ? new Date(params.date) : new Date(),
      category: params.category || 'Other',
      department: params.department || 'General',
    });
    return log;
  },

  updateWorkLog: async (params) => {
    const { id, hoursSpent, date, ...updates } = params;
    if (!isValidObjectId(id)) {
      throw new Error(`Invalid work log ID format: '${id}'.`);
    }
    if (hoursSpent) updates.durationMinutes = Number(hoursSpent) * 60;
    if (date) updates.activityDate = new Date(date);
    const log = await WorkLog.findByIdAndUpdate(id, updates, { new: true, runValidators: true });
    if (!log) throw new Error(`Work log with ID '${id}' not found.`);
    return log;
  },

  deleteWorkLog: async (params) => {
    if (!isValidObjectId(params.id)) {
      throw new Error(`Invalid work log ID format: '${params.id}'.`);
    }
    const log = await WorkLog.findByIdAndDelete(params.id);
    if (!log) throw new Error(`Work log with ID '${params.id}' not found.`);
    return { id: params.id, deleted: true };
  },

  getWorkLogs: async (params) => {
    const filter = {};
    if (params.startDate || params.endDate) {
      filter.activityDate = {};
      if (params.startDate) filter.activityDate.$gte = new Date(params.startDate);
      if (params.endDate) filter.activityDate.$lte = new Date(params.endDate);
    }
    const limit = params.limit ? Number(params.limit) : 50;
    const logs = await WorkLog.find(filter).sort({ activityDate: -1 }).limit(limit);
    return logs;
  },

  // ── DASHBOARD ─────────────────────────────────────────────
  getDashboardStats: async () => {
    const [tasksCount, goalsCount, projectsCount, followupsCount, meetingsCount, worklogsCount] = await Promise.all([
      Task.countDocuments({ status: { $ne: 'Completed' } }),
      Goal.countDocuments({ status: { $ne: 'Completed' } }),
      Project.countDocuments({ status: 'In Progress' }),
      FollowUp.countDocuments({ status: 'Pending' }),
      Event.countDocuments({ type: 'Meeting', startDate: { $gte: new Date() } }),
      WorkLog.countDocuments(),
    ]);

    return {
      openTasks: tasksCount,
      activeGoals: goalsCount,
      inProgressProjects: projectsCount,
      pendingFollowups: followupsCount,
      upcomingMeetings: meetingsCount,
      totalWorkLogs: worklogsCount,
      timestamp: new Date().toISOString(),
    };
  },

  // ── CALENDAR ──────────────────────────────────────────────
  getCalendarEvents: async (params) => {
    const filter = {};
    if (params.startDate || params.endDate) {
      filter.startDate = {};
      if (params.startDate) filter.startDate.$gte = new Date(params.startDate);
      if (params.endDate) filter.startDate.$lte = new Date(params.endDate);
    }
    const limit = params.limit ? Number(params.limit) : 50;
    const events = await Event.find(filter).sort({ startDate: 1 }).limit(limit);
    return events;
  },
};

// ============================================================
//  MAIN EXECUTOR API
// ============================================================

/**
 * Execute a selected tool safely using parameters and return structured result.
 *
 * @param {object} payload - { tool: string, parameters?: object, conversationId?: string }
 * @returns {Promise<ToolExecutionResult>}
 *
 * @typedef {object} ToolExecutionResult
 * @property {boolean} success - Whether execution succeeded.
 * @property {string} tool - Tool name.
 * @property {object} [result] - Returned data from underlying model/service.
 * @property {string} [message] - Human-readable operational message.
 * @property {string} [error] - Error message if execution failed.
 * @property {string[]} [missingParameters] - Missing required parameter names.
 */
export async function executeTool({ tool, parameters = {}, conversationId = null }) {
  const startTime = Date.now();

  // 1. Tool existence validation
  if (!tool || !toolExists(tool)) {
    const errorMsg = `Unknown tool: '${tool}'. Tool is not registered in the AI Tool Registry.`;
    const executionTimeMs = Date.now() - startTime;

    recordAuditLog({
      conversationId,
      tool: tool || 'unknown',
      status: 'FAILED',
      executionTimeMs,
      parameters,
      error: errorMsg,
    });

    return {
      success: false,
      tool: tool || 'unknown',
      error: errorMsg,
    };
  }

  const toolDef = getTool(tool);

  // 2. Validate required parameters
  const missingParameters = [];
  if (toolDef && toolDef.parameters) {
    for (const [paramName, paramDef] of Object.entries(toolDef.parameters)) {
      if (
        paramDef.required &&
        (parameters[paramName] === undefined ||
          parameters[paramName] === null ||
          (typeof parameters[paramName] === 'string' && !parameters[paramName].trim()))
      ) {
        missingParameters.push(paramName);
      }
    }
  }

  if (missingParameters.length > 0) {
    const errorMsg = `Missing required parameter(s): ${missingParameters.join(', ')}.`;
    const executionTimeMs = Date.now() - startTime;

    recordAuditLog({
      conversationId,
      tool,
      status: 'FAILED',
      executionTimeMs,
      parameters,
      error: errorMsg,
    });

    return {
      success: false,
      tool,
      error: errorMsg,
      missingParameters,
    };
  }

  // 3. Dispatch execution to handler
  const handler = HANDLERS[tool];
  if (!handler) {
    const errorMsg = `Handler mapping for tool '${tool}' is not implemented.`;
    const executionTimeMs = Date.now() - startTime;

    recordAuditLog({
      conversationId,
      tool,
      status: 'FAILED',
      executionTimeMs,
      parameters,
      error: errorMsg,
    });

    return {
      success: false,
      tool,
      error: errorMsg,
    };
  }

  try {
    const result = await handler(parameters);
    const executionTimeMs = Date.now() - startTime;

    recordAuditLog({
      conversationId,
      tool,
      status: 'SUCCESS',
      executionTimeMs,
      parameters,
    });

    return {
      success: true,
      tool,
      result,
      message: `Tool '${tool}' executed successfully.`,
    };
  } catch (err) {
    const executionTimeMs = Date.now() - startTime;
    const errorMsg = err.message || `Execution failed for tool '${tool}'.`;

    recordAuditLog({
      conversationId,
      tool,
      status: 'FAILED',
      executionTimeMs,
      parameters,
      error: errorMsg,
    });

    return {
      success: false,
      tool,
      error: errorMsg,
    };
  }
}

/**
 * Retrieve execution audit log history.
 * @returns {Array<object>}
 */
export function getExecutionLogs() {
  return [...executionAuditLogs];
}

/**
 * Clear execution audit logs.
 */
export function clearExecutionLogs() {
  executionAuditLogs.length = 0;
}

export const toolExecutor = {
  executeTool,
  getExecutionLogs,
  clearExecutionLogs,
};

export default toolExecutor;
