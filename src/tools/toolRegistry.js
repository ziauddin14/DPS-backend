/**
 * DPS AI Tool Registry — Single Source of Truth for all registered AI Tools.
 *
 * Architecture:
 *   LLM → Tool Registry → Tool Executor → Business Services → Database
 *
 * Rules:
 *  - No business logic here. Only tool definitions.
 *  - Every tool used by the AI MUST be registered here.
 *  - Adding a new tool requires a single new entry in the TOOLS array.
 */

// ============================================================
//  TOOL DEFINITIONS
// ============================================================

const TOOLS = [

  // ────────────────────────────────────────────────────────
  //  TASKS
  // ────────────────────────────────────────────────────────
  {
    id: 'createTask',
    name: 'createTask',
    description: 'Create a new task for the user. Use when the user wants to add, record, or schedule a task.',
    category: 'Tasks',
    parameters: {
      title:       { type: 'string',  required: true,  description: 'Task title (short and descriptive).' },
      description: { type: 'string',  required: false, description: 'Detailed description of the task.' },
      priority:    { type: 'string',  required: false, description: 'Priority level: High | Medium | Low.', enum: ['High', 'Medium', 'Low'] },
      status:      { type: 'string',  required: false, description: 'Task status: Pending | In Progress | Completed.', enum: ['Pending', 'In Progress', 'Completed'] },
      deadline:    { type: 'string',  required: false, description: 'Due date in ISO 8601 format (YYYY-MM-DD).' },
      category:    { type: 'string',  required: false, description: 'Category or label for the task.' },
      department:  { type: 'string',  required: false, description: 'Department responsible for the task.' },
      dependency:  { type: 'array',   required: false, description: 'List of dependency names or IDs.' },
    },
    handler: null, // To be wired in Stage 1.2.4.2 (Tool Executor)
  },
  {
    id: 'updateTask',
    name: 'updateTask',
    description: 'Update an existing task by ID. Use when the user wants to change task details.',
    category: 'Tasks',
    parameters: {
      id:          { type: 'string',  required: true,  description: 'MongoDB ObjectId of the task.' },
      title:       { type: 'string',  required: false, description: 'New task title.' },
      description: { type: 'string',  required: false, description: 'New task description.' },
      priority:    { type: 'string',  required: false, description: 'New priority: High | Medium | Low.', enum: ['High', 'Medium', 'Low'] },
      status:      { type: 'string',  required: false, description: 'New status: Pending | In Progress | Completed.', enum: ['Pending', 'In Progress', 'Completed'] },
      deadline:    { type: 'string',  required: false, description: 'New due date (YYYY-MM-DD).' },
    },
    handler: null,
  },
  {
    id: 'deleteTask',
    name: 'deleteTask',
    description: 'Permanently delete a task by its ID.',
    category: 'Tasks',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the task to delete.' },
    },
    handler: null,
  },
  {
    id: 'getTask',
    name: 'getTask',
    description: 'Get a single task by its ID.',
    category: 'Tasks',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the task.' },
    },
    handler: null,
  },
  {
    id: 'getTasks',
    name: 'getTasks',
    description: 'Retrieve a list of tasks, optionally filtered by status, priority, or category.',
    category: 'Tasks',
    parameters: {
      status:   { type: 'string', required: false, description: 'Filter by status.', enum: ['Pending', 'In Progress', 'Completed'] },
      priority: { type: 'string', required: false, description: 'Filter by priority.', enum: ['High', 'Medium', 'Low'] },
      category: { type: 'string', required: false, description: 'Filter by category.' },
      limit:    { type: 'number', required: false, description: 'Maximum number of tasks to return.' },
    },
    handler: null,
  },
  {
    id: 'completeTask',
    name: 'completeTask',
    description: 'Mark a task as completed by its ID.',
    category: 'Tasks',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the task to complete.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  GOALS
  // ────────────────────────────────────────────────────────
  {
    id: 'createGoal',
    name: 'createGoal',
    description: 'Create a new personal or professional goal for the user.',
    category: 'Goals',
    parameters: {
      title:       { type: 'string', required: true,  description: 'Goal title.' },
      description: { type: 'string', required: false, description: 'Detailed description of the goal.' },
      deadline:    { type: 'string', required: false, description: 'Target completion date (YYYY-MM-DD).' },
      priority:    { type: 'string', required: false, description: 'Priority: High | Medium | Low.', enum: ['High', 'Medium', 'Low'] },
      status:      { type: 'string', required: false, description: 'Goal status.', enum: ['Pending', 'In Progress', 'Completed', 'On Hold'] },
    },
    handler: null,
  },
  {
    id: 'updateGoal',
    name: 'updateGoal',
    description: 'Update an existing goal by ID.',
    category: 'Goals',
    parameters: {
      id:          { type: 'string', required: true,  description: 'MongoDB ObjectId of the goal.' },
      title:       { type: 'string', required: false, description: 'New goal title.' },
      description: { type: 'string', required: false, description: 'New description.' },
      deadline:    { type: 'string', required: false, description: 'New target date (YYYY-MM-DD).' },
      status:      { type: 'string', required: false, description: 'New status.' },
    },
    handler: null,
  },
  {
    id: 'deleteGoal',
    name: 'deleteGoal',
    description: 'Delete a goal permanently by its ID.',
    category: 'Goals',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the goal.' },
    },
    handler: null,
  },
  {
    id: 'getGoals',
    name: 'getGoals',
    description: 'Retrieve a list of user goals, optionally filtered by status or priority.',
    category: 'Goals',
    parameters: {
      status:   { type: 'string', required: false, description: 'Filter by status.' },
      priority: { type: 'string', required: false, description: 'Filter by priority.' },
      limit:    { type: 'number', required: false, description: 'Maximum number of goals to return.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  PROJECTS
  // ────────────────────────────────────────────────────────
  {
    id: 'createProject',
    name: 'createProject',
    description: 'Create a new project.',
    category: 'Projects',
    parameters: {
      title:       { type: 'string', required: true,  description: 'Project title.' },
      description: { type: 'string', required: false, description: 'Project description.' },
      status:      { type: 'string', required: false, description: 'Project status.', enum: ['Planning', 'In Progress', 'On Hold', 'Completed'] },
      priority:    { type: 'string', required: false, description: 'Priority: High | Medium | Low.', enum: ['High', 'Medium', 'Low'] },
      startDate:   { type: 'string', required: false, description: 'Project start date (YYYY-MM-DD).' },
      endDate:     { type: 'string', required: false, description: 'Project end date (YYYY-MM-DD).' },
      department:  { type: 'string', required: false, description: 'Responsible department.' },
    },
    handler: null,
  },
  {
    id: 'updateProject',
    name: 'updateProject',
    description: 'Update an existing project by ID.',
    category: 'Projects',
    parameters: {
      id:          { type: 'string', required: true,  description: 'MongoDB ObjectId of the project.' },
      title:       { type: 'string', required: false, description: 'New title.' },
      description: { type: 'string', required: false, description: 'New description.' },
      status:      { type: 'string', required: false, description: 'New status.' },
      priority:    { type: 'string', required: false, description: 'New priority.' },
    },
    handler: null,
  },
  {
    id: 'deleteProject',
    name: 'deleteProject',
    description: 'Delete a project by its ID.',
    category: 'Projects',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the project.' },
    },
    handler: null,
  },
  {
    id: 'getProjects',
    name: 'getProjects',
    description: 'Retrieve a list of projects, optionally filtered by status or priority.',
    category: 'Projects',
    parameters: {
      status:   { type: 'string', required: false, description: 'Filter by status.' },
      priority: { type: 'string', required: false, description: 'Filter by priority.' },
      limit:    { type: 'number', required: false, description: 'Max projects to return.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  MEETINGS (Events)
  // ────────────────────────────────────────────────────────
  {
    id: 'createMeeting',
    name: 'createMeeting',
    description: 'Create a new meeting or calendar event.',
    category: 'Meetings',
    parameters: {
      title:       { type: 'string', required: true,  description: 'Meeting title.' },
      description: { type: 'string', required: false, description: 'Meeting agenda or description.' },
      date:        { type: 'string', required: false, description: 'Meeting date (YYYY-MM-DD).' },
      startTime:   { type: 'string', required: false, description: 'Start time (HH:MM).' },
      endTime:     { type: 'string', required: false, description: 'End time (HH:MM).' },
      location:    { type: 'string', required: false, description: 'Meeting location or link.' },
      attendees:   { type: 'array',  required: false, description: 'List of attendee names.' },
    },
    handler: null,
  },
  {
    id: 'updateMeeting',
    name: 'updateMeeting',
    description: 'Update an existing meeting by ID.',
    category: 'Meetings',
    parameters: {
      id:        { type: 'string', required: true,  description: 'MongoDB ObjectId of the meeting.' },
      title:     { type: 'string', required: false, description: 'New meeting title.' },
      date:      { type: 'string', required: false, description: 'New date (YYYY-MM-DD).' },
      startTime: { type: 'string', required: false, description: 'New start time.' },
      location:  { type: 'string', required: false, description: 'New location.' },
    },
    handler: null,
  },
  {
    id: 'deleteMeeting',
    name: 'deleteMeeting',
    description: 'Delete a meeting or event by its ID.',
    category: 'Meetings',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the meeting.' },
    },
    handler: null,
  },
  {
    id: 'getMeetings',
    name: 'getMeetings',
    description: 'Retrieve upcoming meetings or events, optionally filtered by date range.',
    category: 'Meetings',
    parameters: {
      startDate: { type: 'string', required: false, description: 'Filter from date (YYYY-MM-DD).' },
      endDate:   { type: 'string', required: false, description: 'Filter to date (YYYY-MM-DD).' },
      limit:     { type: 'number', required: false, description: 'Max meetings to return.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  FOLLOW-UPS
  // ────────────────────────────────────────────────────────
  {
    id: 'createFollowUp',
    name: 'createFollowUp',
    description: 'Create a new follow-up reminder for the user.',
    category: 'Follow-ups',
    parameters: {
      title:          { type: 'string', required: true,  description: 'Follow-up title or subject.' },
      description:    { type: 'string', required: false, description: 'Follow-up details.' },
      followUpDate:   { type: 'string', required: false, description: 'Date to follow up (YYYY-MM-DD).' },
      contactPerson:  { type: 'string', required: false, description: 'Person to follow up with.' },
      contactMethod:  { type: 'string', required: false, description: 'Method: Call | Email | WhatsApp | Meeting.', enum: ['Call', 'Email', 'WhatsApp', 'Meeting', 'Other'] },
      priority:       { type: 'string', required: false, description: 'Priority: High | Medium | Low.', enum: ['High', 'Medium', 'Low'] },
      status:         { type: 'string', required: false, description: 'Status of the follow-up.', enum: ['Pending', 'Completed', 'Cancelled'] },
      relatedProject: { type: 'string', required: false, description: 'Related project name or ID.' },
    },
    handler: null,
  },
  {
    id: 'updateFollowUp',
    name: 'updateFollowUp',
    description: 'Update an existing follow-up by ID.',
    category: 'Follow-ups',
    parameters: {
      id:           { type: 'string', required: true,  description: 'MongoDB ObjectId of the follow-up.' },
      title:        { type: 'string', required: false, description: 'New title.' },
      followUpDate: { type: 'string', required: false, description: 'New follow-up date.' },
      status:       { type: 'string', required: false, description: 'New status.' },
      priority:     { type: 'string', required: false, description: 'New priority.' },
    },
    handler: null,
  },
  {
    id: 'deleteFollowUp',
    name: 'deleteFollowUp',
    description: 'Delete a follow-up by its ID.',
    category: 'Follow-ups',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the follow-up.' },
    },
    handler: null,
  },
  {
    id: 'getFollowUps',
    name: 'getFollowUps',
    description: 'Retrieve follow-ups, optionally filtered by status or priority.',
    category: 'Follow-ups',
    parameters: {
      status:   { type: 'string', required: false, description: 'Filter by status.' },
      priority: { type: 'string', required: false, description: 'Filter by priority.' },
      limit:    { type: 'number', required: false, description: 'Max follow-ups to return.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  KNOWLEDGE
  // ────────────────────────────────────────────────────────
  {
    id: 'createKnowledge',
    name: 'createKnowledge',
    description: 'Save a piece of knowledge, note, or reference to the DPS Knowledge Base.',
    category: 'Knowledge',
    parameters: {
      title:       { type: 'string', required: true,  description: 'Knowledge item title.' },
      content:     { type: 'string', required: true,  description: 'Full content or body of the knowledge entry.' },
      tags:        { type: 'array',  required: false, description: 'List of tags for searching and categorization.' },
      category:    { type: 'string', required: false, description: 'Knowledge category or type.' },
      source:      { type: 'string', required: false, description: 'Source or reference URL.' },
    },
    handler: null,
  },
  {
    id: 'updateKnowledge',
    name: 'updateKnowledge',
    description: 'Update an existing knowledge entry by ID.',
    category: 'Knowledge',
    parameters: {
      id:      { type: 'string', required: true,  description: 'MongoDB ObjectId of the knowledge entry.' },
      title:   { type: 'string', required: false, description: 'New title.' },
      content: { type: 'string', required: false, description: 'New content.' },
      tags:    { type: 'array',  required: false, description: 'Updated tags.' },
    },
    handler: null,
  },
  {
    id: 'deleteKnowledge',
    name: 'deleteKnowledge',
    description: 'Delete a knowledge entry by its ID.',
    category: 'Knowledge',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the knowledge entry.' },
    },
    handler: null,
  },
  {
    id: 'searchKnowledge',
    name: 'searchKnowledge',
    description: 'Search the DPS Knowledge Base by keyword, tags, or category.',
    category: 'Knowledge',
    parameters: {
      query:    { type: 'string', required: true,  description: 'Search keyword or phrase.' },
      tags:     { type: 'array',  required: false, description: 'Filter by tags.' },
      category: { type: 'string', required: false, description: 'Filter by category.' },
      limit:    { type: 'number', required: false, description: 'Max results to return.' },
    },
    handler: null,
  },
  {
    id: 'getKnowledge',
    name: 'getKnowledge',
    description: 'Retrieve a specific knowledge entry by ID.',
    category: 'Knowledge',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the knowledge entry.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  WORK LOGS
  // ────────────────────────────────────────────────────────
  {
    id: 'createWorkLog',
    name: 'createWorkLog',
    description: 'Log hours worked on a task, project, or activity.',
    category: 'Work Logs',
    parameters: {
      title:       { type: 'string', required: true,  description: 'Work log title or activity name.' },
      description: { type: 'string', required: false, description: 'What was done during this work session.' },
      hoursSpent:  { type: 'number', required: true,  description: 'Number of hours spent.' },
      date:        { type: 'string', required: false, description: 'Work log date (YYYY-MM-DD).' },
      project:     { type: 'string', required: false, description: 'Related project name or ID.' },
      category:    { type: 'string', required: false, description: 'Type of work (Development, Meeting, Review, etc.).' },
      department:  { type: 'string', required: false, description: 'Department responsible.' },
    },
    handler: null,
  },
  {
    id: 'updateWorkLog',
    name: 'updateWorkLog',
    description: 'Update an existing work log by ID.',
    category: 'Work Logs',
    parameters: {
      id:          { type: 'string', required: true,  description: 'MongoDB ObjectId of the work log.' },
      title:       { type: 'string', required: false, description: 'New title.' },
      hoursSpent:  { type: 'number', required: false, description: 'Corrected hours.' },
      description: { type: 'string', required: false, description: 'Updated description.' },
    },
    handler: null,
  },
  {
    id: 'deleteWorkLog',
    name: 'deleteWorkLog',
    description: 'Delete a work log entry by its ID.',
    category: 'Work Logs',
    parameters: {
      id: { type: 'string', required: true, description: 'MongoDB ObjectId of the work log.' },
    },
    handler: null,
  },
  {
    id: 'getWorkLogs',
    name: 'getWorkLogs',
    description: 'Retrieve work logs, optionally filtered by date range, project, or category.',
    category: 'Work Logs',
    parameters: {
      startDate: { type: 'string', required: false, description: 'Filter from date (YYYY-MM-DD).' },
      endDate:   { type: 'string', required: false, description: 'Filter to date (YYYY-MM-DD).' },
      project:   { type: 'string', required: false, description: 'Filter by project name.' },
      limit:     { type: 'number', required: false, description: 'Max work logs to return.' },
    },
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  DASHBOARD
  // ────────────────────────────────────────────────────────
  {
    id: 'getDashboardStats',
    name: 'getDashboardStats',
    description: 'Retrieve a summary of DPS dashboard statistics: tasks completed, goals progress, work hours, upcoming meetings, and open follow-ups.',
    category: 'Dashboard',
    parameters: {},
    handler: null,
  },

  // ────────────────────────────────────────────────────────
  //  CALENDAR
  // ────────────────────────────────────────────────────────
  {
    id: 'getCalendarEvents',
    name: 'getCalendarEvents',
    description: 'Retrieve calendar events for a given date range.',
    category: 'Calendar',
    parameters: {
      startDate: { type: 'string', required: false, description: 'Start of date range (YYYY-MM-DD).' },
      endDate:   { type: 'string', required: false, description: 'End of date range (YYYY-MM-DD).' },
      limit:     { type: 'number', required: false, description: 'Max events to return.' },
    },
    handler: null,
  },
];

// ============================================================
//  REGISTRY INDEX — Fast O(1) lookup by tool name
// ============================================================
const REGISTRY_MAP = new Map(TOOLS.map((tool) => [tool.name, tool]));

// ============================================================
//  CATEGORY INDEX — Fast O(1) lookup by category
// ============================================================
const CATEGORY_MAP = TOOLS.reduce((acc, tool) => {
  if (!acc[tool.category]) acc[tool.category] = [];
  acc[tool.category].push(tool);
  return acc;
}, {});

// ============================================================
//  REGISTRY HELPER API
// ============================================================

/**
 * Get a single tool definition by name.
 *
 * @param {string} name - Tool name (e.g. 'createTask').
 * @returns {object|null} Tool definition or null if not found.
 */
export function getTool(name) {
  return REGISTRY_MAP.get(name) || null;
}

/**
 * Get all registered tool definitions.
 *
 * @returns {Array<object>} Array of all tool definitions.
 */
export function getAllTools() {
  return [...TOOLS];
}

/**
 * Get all tools belonging to a specific category.
 *
 * @param {string} category - Category name (e.g. 'Tasks', 'Goals').
 * @returns {Array<object>} Array of tool definitions in the category.
 */
export function getToolsByCategory(category) {
  return CATEGORY_MAP[category] ? [...CATEGORY_MAP[category]] : [];
}

/**
 * Check whether a tool with the given name is registered.
 *
 * @param {string} name - Tool name to check.
 * @returns {boolean}
 */
export function toolExists(name) {
  return REGISTRY_MAP.has(name);
}

/**
 * Get all available category names.
 *
 * @returns {Array<string>} Sorted list of category names.
 */
export function getAllCategories() {
  return Object.keys(CATEGORY_MAP).sort();
}

/**
 * Get a summary of registered tools grouped by category with counts.
 *
 * @returns {object} Summary object: { [category]: count }
 */
export function getRegistrySummary() {
  return Object.entries(CATEGORY_MAP).reduce((acc, [cat, tools]) => {
    acc[cat] = tools.length;
    return acc;
  }, {});
}

// ============================================================
//  REGISTRY OBJECT (for named import convenience)
// ============================================================
export const toolRegistry = {
  getTool,
  getAllTools,
  getToolsByCategory,
  toolExists,
  getAllCategories,
  getRegistrySummary,
  totalTools: TOOLS.length,
};

export default toolRegistry;
