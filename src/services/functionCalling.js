import OpenAI from 'openai';
import { getAllTools } from '../tools/toolRegistry.js';
import { AI_CONFIG } from '../config/aiConfig.js';
import { DPS_SYSTEM_PROMPT } from '../config/aiSystemPrompt.js';

// ============================================================
//  TOOL SCHEMA BUILDER
//  Converts Tool Registry definitions → OpenAI function_call schema
// ============================================================

/**
 * Transform a single tool registry entry into an OpenAI-compatible function definition.
 * @param {object} tool - Tool definition from toolRegistry.
 * @returns {object} OpenAI function schema object.
 */
function buildOpenAIFunctionSchema(tool) {
  const required = [];
  const properties = {};

  for (const [paramName, paramDef] of Object.entries(tool.parameters || {})) {
    properties[paramName] = {
      type: paramDef.type === 'array' ? 'array' : paramDef.type,
      description: paramDef.description || '',
    };

    if (paramDef.type === 'array') {
      properties[paramName].items = { type: 'string' };
    }

    if (paramDef.enum) {
      properties[paramName].enum = paramDef.enum;
    }

    if (paramDef.required) {
      required.push(paramName);
    }
  }

  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        type: 'object',
        properties,
        required,
      },
    },
  };
}

/**
 * Build the full OpenAI tools array from the Tool Registry dynamically.
 * @returns {Array<object>} Array of OpenAI function schemas.
 */
function buildOpenAIToolSchemas() {
  return getAllTools().map(buildOpenAIFunctionSchema);
}

// ============================================================
//  MOCK FUNCTION CALLING
//  Used when OPENAI_API_KEY is absent or provider is unavailable.
//  Performs lightweight keyword intent matching as a deterministic fallback.
// ============================================================

// Explicit noun-based priority categories (higher priority = checked first)
const INTENT_CATEGORIES = {
  task: {
    priority: 1,
    nouns: ['task', 'todo', 'work item', 'finish task'],
    tool: 'createTask',
    missingParameters: ['title']
  },
  meeting: {
    priority: 2,
    nouns: ['meeting', 'schedule meeting', 'book meeting', 'meeting tomorrow'],
    tool: 'createMeeting',
    missingParameters: ['title']
  },
  followup: {
    priority: 3,
    nouns: ['follow up', 'follow-up', 'call client', 'remind me to call'],
    tool: 'createFollowUp',
    missingParameters: ['title']
  },
  goal: {
    priority: 4,
    nouns: ['goal', 'weekly goal', 'monthly goal', 'yearly goal'],
    tool: 'createGoal',
    missingParameters: ['title']
  },
  project: {
    priority: 5,
    nouns: ['project', 'software project'],
    tool: 'createProject',
    missingParameters: ['title']
  }
};

const MOCK_INTENT_PATTERNS = [
  // Tasks - Phase A: Task Creation (highest priority for task-related)
  { keywords: ['create a task', 'create task', 'add a task', 'add task', 'new task', 'finish task', 'todo', 'work item'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['high priority task', 'low priority task', 'medium priority task', 'priority task'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['create a high priority task', 'create high priority task'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['create a task tomorrow', 'create task tomorrow'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['create a task for', 'create task for', 'create a task with', 'create task with'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['create a recurring task', 'create recurring task', 'create a task with due date', 'create task with due date'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['create a task with description', 'create task with description', 'create a task with category', 'create task with category'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  { keywords: ['create a task with labels', 'create task with labels', 'schedule a task', 'schedule task', 'set a task', 'set task'], tool: 'createTask', missingParameters: ['title'], category: 'task' },
  
  // Tasks - Phase B: Task Update
  { keywords: ['update task', 'change task', 'edit task', 'modify task'], tool: 'updateTask', missingParameters: ['id'], category: 'task' },
  { keywords: ['mark task completed', 'mark this task complete', 'mark task complete', 'mark this task as completed', 'mark task as completed'], tool: 'updateTask', missingParameters: ['id'], category: 'task' },
  { keywords: ['update priority', 'change priority', 'change due date', 'update due date', 'rename task'], tool: 'updateTask', missingParameters: ['id'], category: 'task' },
  { keywords: ['move task to', 'move task to another project', 'assign category', 'update description', 'change description'], tool: 'updateTask', missingParameters: ['id'], category: 'task' },
  
  // Tasks - Phase C: Task Delete
  { keywords: ['delete task', 'remove task', 'cancel task'], tool: 'deleteTask', missingParameters: ['id'], category: 'task' },
  
  // Tasks - Phase D: List Tasks
  { keywords: ['complete task', 'finish task', 'mark task done', 'mark done', 'task done'], tool: 'completeTask', missingParameters: ['id'], category: 'task' },
  { keywords: ['show tasks', 'list tasks', 'my tasks', 'get tasks', 'pending tasks', 'today\'s tasks', "today's tasks", 'what tasks', 'show my tasks'], tool: 'getTasks', missingParameters: [], category: 'task' },
  { keywords: ['show pending tasks', 'list pending tasks', 'show today\'s tasks', 'show today\'s task', 'show completed tasks', 'list completed tasks'], tool: 'getTasks', missingParameters: [], category: 'task' },
  { keywords: ['show high priority tasks', 'list high priority tasks', 'show tasks due tomorrow', 'show tasks for', 'list tasks for'], tool: 'getTasks', missingParameters: [], category: 'task' },
  { keywords: ['show overdue tasks', 'list overdue tasks', 'what are my tasks', 'display tasks'], tool: 'getTasks', missingParameters: [], category: 'task' },
  
  // Meetings
  { keywords: ['schedule meeting', 'book meeting', 'new meeting', 'meeting tomorrow'], tool: 'createMeeting', missingParameters: ['title'], category: 'meeting' },
  { keywords: ['create a meeting', 'create meeting', 'add meeting'], tool: 'createMeeting', missingParameters: ['title'], category: 'meeting' },
  { keywords: ['show meetings', 'list meetings', 'get meetings', 'my meetings', 'upcoming meetings', 'what meetings'], tool: 'getMeetings', missingParameters: [], category: 'meeting' },
  { keywords: ['update meeting', 'edit meeting', 'change meeting', 'reschedule meeting'], tool: 'updateMeeting', missingParameters: ['id'], category: 'meeting' },
  { keywords: ['delete meeting', 'cancel meeting', 'remove meeting'], tool: 'deleteMeeting', missingParameters: ['id'], category: 'meeting' },
  
  // Follow-ups
  { keywords: ['create follow up', 'call client', 'remind me to call'], tool: 'createFollowUp', missingParameters: ['title'], category: 'followup' },
  { keywords: ['follow up with', 'follow-up with'], tool: 'createFollowUp', missingParameters: ['title'], category: 'followup' },
  { keywords: ['create a follow-up', 'create follow-up', 'add follow-up', 'new follow-up', 'new followup'], tool: 'createFollowUp', missingParameters: ['title'], category: 'followup' },
  { keywords: ['show follow-ups', 'list follow-ups', 'get follow-ups', 'my follow-ups', 'what follow-ups'], tool: 'getFollowUps', missingParameters: [], category: 'followup' },
  { keywords: ['update follow-up', 'edit follow-up', 'change follow-up'], tool: 'updateFollowUp', missingParameters: ['id'], category: 'followup' },
  { keywords: ['delete follow-up', 'remove follow-up'], tool: 'deleteFollowUp', missingParameters: ['id'], category: 'followup' },
  
  // Goals
  { keywords: ['create goal', 'weekly goal', 'monthly goal', 'yearly goal'], tool: 'createGoal', missingParameters: ['title'], category: 'goal' },
  { keywords: ['create a goal', 'add goal', 'new goal', 'set a goal', 'set goal'], tool: 'createGoal', missingParameters: ['title'], category: 'goal' },
  { keywords: ['show goals', 'list goals', 'my goals', 'get goals', 'what are my goals'], tool: 'getGoals', missingParameters: [], category: 'goal' },
  { keywords: ['update goal', 'edit goal', 'change goal'], tool: 'updateGoal', missingParameters: ['id'], category: 'goal' },
  { keywords: ['delete goal', 'remove goal'], tool: 'deleteGoal', missingParameters: ['id'], category: 'goal' },
  
  // Projects
  { keywords: ['new project', 'create project', 'software project'], tool: 'createProject', missingParameters: ['title'], category: 'project' },
  { keywords: ['create a project', 'start project', 'add project'], tool: 'createProject', missingParameters: ['title'], category: 'project' },
  { keywords: ['show projects', 'list projects', 'get projects', 'my projects', 'what projects'], tool: 'getProjects', missingParameters: [], category: 'project' },
  { keywords: ['update project', 'edit project', 'change project'], tool: 'updateProject', missingParameters: ['id'], category: 'project' },
  { keywords: ['delete project', 'remove project'], tool: 'deleteProject', missingParameters: ['id'], category: 'project' },
  
  // Knowledge
  { keywords: ['create knowledge', 'add knowledge', 'save note', 'new knowledge', 'save to knowledge', 'save this note'], tool: 'createKnowledge', missingParameters: ['title', 'content'] },
  { keywords: ['search knowledge', 'search my knowledge', 'find knowledge', 'look up knowledge', 'look up in knowledge', 'search the knowledge'], tool: 'searchKnowledge', missingParameters: ['query'] },
  { keywords: ['get knowledge', 'show knowledge', 'retrieve knowledge'], tool: 'getKnowledge', missingParameters: ['id'] },
  // Work Logs
  { keywords: ['log work', 'log hours', 'log my work', 'track hours', 'add work log', 'record work', 'hours of work', 'hours on the', 'hours on project'], tool: 'createWorkLog', missingParameters: ['title', 'hoursSpent'] },
  { keywords: ['show work logs', 'list work logs', 'my work logs', 'get work logs', 'what work logs'], tool: 'getWorkLogs', missingParameters: [] },
  // Dashboard & Calendar - Phase F: Dashboard Summary
  { keywords: ['dashboard', 'show dashboard', 'summary', 'overview', 'stats', 'statistics', 'show summary', 'dashboard summary', 'daily summary', 'work summary', 'today\'s overview', 'today overview', 'show my dashboard', 'get dashboard', 'view dashboard'], tool: 'getDashboardStats', missingParameters: [] },
  { keywords: ['calendar', 'get calendar', 'show calendar', 'my events', 'get events', 'schedule for'], tool: 'getCalendarEvents', missingParameters: [] },
  // Phase E: Today's Agenda (handled by orchestrator, but add patterns for completeness)
  { keywords: ['agenda', 'what\'s my agenda today', 'what is my agenda today', 'what do i have today', 'what do i have', 'today\'s schedule', 'today schedule', 'today\'s tasks', 'today tasks', 'today\'s meetings', 'today meetings', 'today\'s follow-ups', 'today follow-ups', 'what\'s on my agenda', 'what is on my agenda', 'show my agenda', 'my agenda today'], tool: 'getDashboardStats', missingParameters: [] },
];

// ============================================================
//  NATURAL LANGUAGE PARAMETER EXTRACTION
// ============================================================

/**
 * Extract date from natural language expressions.
 */
function extractDateFromText(message) {
  const lowerMsg = message.toLowerCase();
  const today = new Date();
  
  // Tomorrow
  if (lowerMsg.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  }
  
  // Today
  if (lowerMsg.includes('today')) {
    return today.toISOString().split('T')[0];
  }
  
  // Next Monday
  if (lowerMsg.includes('next monday')) {
    const nextMonday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilMonday = (1 - dayOfWeek + 7) % 7 || 7;
    nextMonday.setDate(nextMonday.getDate() + daysUntilMonday);
    return nextMonday.toISOString().split('T')[0];
  }
  
  // Next Tuesday
  if (lowerMsg.includes('next tuesday')) {
    const nextTuesday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilTuesday = (2 - dayOfWeek + 7) % 7 || 7;
    nextTuesday.setDate(nextTuesday.getDate() + daysUntilTuesday);
    return nextTuesday.toISOString().split('T')[0];
  }
  
  // Next Wednesday
  if (lowerMsg.includes('next wednesday')) {
    const nextWednesday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilWednesday = (3 - dayOfWeek + 7) % 7 || 7;
    nextWednesday.setDate(nextWednesday.getDate() + daysUntilWednesday);
    return nextWednesday.toISOString().split('T')[0];
  }
  
  // Next Thursday
  if (lowerMsg.includes('next thursday')) {
    const nextThursday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilThursday = (4 - dayOfWeek + 7) % 7 || 7;
    nextThursday.setDate(nextThursday.getDate() + daysUntilThursday);
    return nextThursday.toISOString().split('T')[0];
  }
  
  // Next Friday
  if (lowerMsg.includes('next friday')) {
    const nextFriday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
    nextFriday.setDate(nextFriday.getDate() + daysUntilFriday);
    return nextFriday.toISOString().split('T')[0];
  }
  
  // Next Saturday
  if (lowerMsg.includes('next saturday')) {
    const nextSaturday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    nextSaturday.setDate(nextSaturday.getDate() + daysUntilSaturday);
    return nextSaturday.toISOString().split('T')[0];
  }
  
  // Next Sunday
  if (lowerMsg.includes('next sunday')) {
    const nextSunday = new Date(today);
    const dayOfWeek = today.getDay();
    const daysUntilSunday = (0 - dayOfWeek + 7) % 7 || 7;
    nextSunday.setDate(nextSunday.getDate() + daysUntilSunday);
    return nextSunday.toISOString().split('T')[0];
  }
  
  // In X days
  const inDaysMatch = lowerMsg.match(/in (\d+) days?/);
  if (inDaysMatch) {
    const futureDate = new Date(today);
    futureDate.setDate(futureDate.getDate() + parseInt(inDaysMatch[1]));
    return futureDate.toISOString().split('T')[0];
  }
  
  return null;
}

/**
 * Extract priority from natural language.
 */
function extractPriorityFromText(message) {
  const lowerMsg = message.toLowerCase();
  
  if (lowerMsg.includes('high priority') || lowerMsg.includes('urgent') || lowerMsg.includes('important')) {
    return 'High';
  }
  if (lowerMsg.includes('low priority') || lowerMsg.includes('not urgent')) {
    return 'Low';
  }
  if (lowerMsg.includes('medium priority') || lowerMsg.includes('normal priority')) {
    return 'Medium';
  }
  
  return null;
}

/**
 * Extract task title from message (removes action keywords).
 */
function extractTitleFromMessage(message) {
  let title = message.trim();
  
  // Remove common action prefixes
  const prefixes = [
    'create a task', 'create task', 'add a task', 'add task', 'new task',
    'create a high priority task', 'create high priority task',
    'create a task for', 'create task for',
    'remind me to', 'schedule a task', 'schedule task',
    'set a task', 'set task',
  ];
  
  for (const prefix of prefixes) {
    if (title.toLowerCase().startsWith(prefix)) {
      title = title.substring(prefix.length).trim();
      break;
    }
  }
  
  // Remove time expressions
  title = title.replace(/\b(tomorrow|today|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|in \d+ days?)\b/gi, '').trim();
  
  // Remove priority expressions
  title = title.replace(/\b(high priority|low priority|medium priority|urgent|important)\b/gi, '').trim();
  
  // Clean up extra spaces
  title = title.replace(/\s+/g, ' ').trim();
  
  return title || null;
}

/**
 * Lightweight mock intent matcher for when no API is configured.
 * Uses deterministic noun-based priority routing to ensure correct tool selection.
 * @param {string} message - User message.
 * @returns {object} Structured tool call result.
 */
function mockFunctionCalling(message) {
  const lowerMsg = message.toLowerCase().trim();

  // Step 1: Check explicit noun-based categories with priority (BUG #1 fix)
  for (const [categoryKey, category] of Object.entries(INTENT_CATEGORIES)) {
    for (const noun of category.nouns) {
      if (lowerMsg.includes(noun)) {
        const result = {
          shouldCallTool: true,
          tool: category.tool,
          parameters: {},
          reason: `Matched explicit noun '${noun}' in category '${categoryKey}' with priority ${category.priority}`,
          isMock: true,
        };

        // Extract parameters for creation tools
        if (category.tool === 'createTask') {
          const title = extractTitleFromMessage(message);
          if (title) {
            result.parameters.title = title;
            result.missingParameters = category.missingParameters.filter(p => p !== 'title');
          } else {
            result.missingParameters = category.missingParameters;
          }
          
          const date = extractDateFromText(message);
          if (date) result.parameters.deadline = date;
          
          const priority = extractPriorityFromText(message);
          if (priority) result.parameters.priority = priority;
        } else {
          result.missingParameters = category.missingParameters;
        }

        return result;
      }
    }
  }

  // Step 2: Fallback to pattern matching for other intents
  for (const pattern of MOCK_INTENT_PATTERNS) {
    if (pattern.keywords.some((kw) => lowerMsg.includes(kw))) {
      const result = {
        shouldCallTool: true,
        tool: pattern.tool,
        parameters: {},
        reason: `Matched keyword pattern for ${pattern.tool}`,
        isMock: true,
      };

      // Extract parameters from message
      if (pattern.tool === 'createTask') {
        const title = extractTitleFromMessage(message);
        if (title) {
          result.parameters.title = title;
          result.missingParameters = pattern.missingParameters.filter(p => p !== 'title');
        } else {
          result.missingParameters = pattern.missingParameters;
        }
        
        const date = extractDateFromText(message);
        if (date) result.parameters.deadline = date;
        
        const priority = extractPriorityFromText(message);
        if (priority) result.parameters.priority = priority;
      } else if (pattern.tool === 'updateTask') {
        result.missingParameters = pattern.missingParameters;
      } else {
        if (pattern.missingParameters && pattern.missingParameters.length > 0) {
          result.missingParameters = pattern.missingParameters;
        }
      }

      return result;
    }
  }

  return { shouldCallTool: false, isMock: true };
}

// ============================================================
//  OPENAI FUNCTION CALLING ENGINE
// ============================================================

/**
 * Execute OpenAI native Function Calling to select a tool from the registry.
 * @param {object} params
 * @param {string} params.message - Current user message.
 * @param {Array} params.conversationHistory - Prior conversation messages.
 * @param {string} params.apiKey - OpenAI API key.
 * @returns {Promise<object>} Structured tool call result.
 */
async function openAIFunctionCalling({ message, conversationHistory = [], apiKey }) {
  const openai = new OpenAI({ apiKey, timeout: AI_CONFIG.timeoutMs });
  const model = AI_CONFIG.model;

  // Build history
  const historyMessages = (conversationHistory || [])
    .filter((msg) => msg.text && (msg.sender === 'user' || msg.sender === 'assistant'))
    .map((msg) => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text,
    }));

  const messages = [
    { role: 'system', content: DPS_SYSTEM_PROMPT },
    ...historyMessages,
    { role: 'user', content: message },
  ];

  // Build function schemas from registry
  const tools = buildOpenAIToolSchemas();

  const completion = await openai.chat.completions.create({
    model,
    messages,
    tools,
    tool_choice: 'auto',
    temperature: 0.2,       // Lower temp for more deterministic tool selection
    max_tokens: 800,
  });

  const choice = completion.choices[0];
  const finishReason = choice?.finish_reason;

  // ── Tool call selected by the model ──────────────────────
  if (finishReason === 'tool_calls' && choice.message.tool_calls?.length > 0) {
    const toolCall = choice.message.tool_calls[0];
    const toolName = toolCall.function.name;
    let parsedArgs = {};

    try {
      parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
    } catch {
      parsedArgs = {};
    }

    // Identify missing required parameters
    const { getAllTools } = await import('../tools/toolRegistry.js');
    const toolDef = getAllTools().find((t) => t.name === toolName);
    const missingParameters = [];

    if (toolDef) {
      for (const [paramName, paramDef] of Object.entries(toolDef.parameters || {})) {
        if (paramDef.required && (parsedArgs[paramName] === undefined || parsedArgs[paramName] === null || parsedArgs[paramName] === '')) {
          missingParameters.push(paramName);
        }
      }
    }

    const result = {
      shouldCallTool: true,
      tool: toolName,
      parameters: parsedArgs,
      reason: `LLM selected tool via native function calling.`,
      model: completion.model || model,
      usage: completion.usage
        ? {
            promptTokens: completion.usage.prompt_tokens,
            completionTokens: completion.usage.completion_tokens,
            totalTokens: completion.usage.total_tokens,
          }
        : null,
      isMock: false,
    };

    if (missingParameters.length > 0) {
      result.missingParameters = missingParameters;
    }

    return result;
  }

  // ── No tool selected → normal conversation ─────────────
  return {
    shouldCallTool: false,
    model: completion.model || model,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : null,
    isMock: false,
  };
}

// ============================================================
//  PUBLIC API — Provider-Agnostic Entry Point
// ============================================================

/**
 * DPS Function Calling Engine.
 *
 * Determines whether the LLM should call a registered tool and which tool to call.
 * Does NOT execute tools. Does NOT access the database.
 *
 * @param {object} params
 * @param {string} params.message - Current user message.
 * @param {Array}  [params.conversationHistory=[]] - Prior messages for context.
 * @returns {Promise<FunctionCallingResult>}
 *
 * @typedef {object} FunctionCallingResult
 * @property {boolean} shouldCallTool - Whether the engine selected a tool.
 * @property {string}  [tool]              - Name of the selected tool.
 * @property {object}  [parameters]        - Extracted parameter values.
 * @property {string[]} [missingParameters] - Required params that are missing.
 * @property {string}  [reason]            - Engine decision reasoning.
 * @property {boolean} isMock             - Whether mock fallback was used.
 */
export async function selectTool({ message, conversationHistory = [] }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || null;
  const hasValidKey = apiKey && apiKey !== 'your_openai_api_key_here' && apiKey.length > 10;

  // Use native OpenAI function calling when API key is configured
  if (hasValidKey) {
    try {
      return await openAIFunctionCalling({ message, conversationHistory, apiKey });
    } catch (err) {
      console.error('[FunctionCalling OpenAI Error]:', err.status || err.name, err.message);

      // Graceful degradation to mock on provider errors
      console.warn('[FunctionCalling] Falling back to mock matcher due to provider error.');
      return mockFunctionCalling(message);
    }
  }

  // Fallback: mock keyword-based matcher (no API key configured)
  return mockFunctionCalling(message);
}

/**
 * Convenience export exposing the function calling engine as an object.
 */
export const functionCallingEngine = {
  selectTool,
  buildOpenAIToolSchemas,
};

export { buildOpenAIToolSchemas };
export default functionCallingEngine;
