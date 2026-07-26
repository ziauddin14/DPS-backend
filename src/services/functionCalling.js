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

const MOCK_INTENT_PATTERNS = [
  // Tasks
  { keywords: ['create a task', 'create task', 'add a task', 'add task', 'new task', 'remind me', 'schedule a task', 'schedule task', 'set a task', 'high priority task', 'low priority task', 'medium priority task', 'priority task'], tool: 'createTask', missingParameters: ['title'] },
  { keywords: ['update task', 'change task', 'edit task', 'modify task'], tool: 'updateTask', missingParameters: ['id'] },
  { keywords: ['delete task', 'remove task'], tool: 'deleteTask', missingParameters: ['id'] },
  { keywords: ['complete task', 'finish task', 'mark task done', 'mark done', 'task done'], tool: 'completeTask', missingParameters: ['id'] },
  { keywords: ['show tasks', 'list tasks', 'my tasks', 'get tasks', 'pending tasks', 'today\'s tasks', "today's tasks", 'what tasks', 'show my tasks'], tool: 'getTasks', missingParameters: [] },
  // Goals
  { keywords: ['create a goal', 'create goal', 'add goal', 'new goal', 'set a goal', 'set goal'], tool: 'createGoal', missingParameters: ['title'] },
  { keywords: ['show goals', 'list goals', 'my goals', 'get goals', 'what are my goals'], tool: 'getGoals', missingParameters: [] },
  { keywords: ['update goal', 'edit goal', 'change goal'], tool: 'updateGoal', missingParameters: ['id'] },
  { keywords: ['delete goal', 'remove goal'], tool: 'deleteGoal', missingParameters: ['id'] },
  // Projects
  { keywords: ['create a project', 'create project', 'new project', 'start project', 'add project'], tool: 'createProject', missingParameters: ['title'] },
  { keywords: ['show projects', 'list projects', 'get projects', 'my projects', 'what projects'], tool: 'getProjects', missingParameters: [] },
  { keywords: ['update project', 'edit project', 'change project'], tool: 'updateProject', missingParameters: ['id'] },
  { keywords: ['delete project', 'remove project'], tool: 'deleteProject', missingParameters: ['id'] },
  // Meetings
  { keywords: ['create a meeting', 'create meeting', 'schedule a meeting', 'schedule meeting', 'add meeting', 'new meeting', 'book a meeting'], tool: 'createMeeting', missingParameters: ['title'] },
  { keywords: ['show meetings', 'list meetings', 'get meetings', 'my meetings', 'upcoming meetings', 'what meetings'], tool: 'getMeetings', missingParameters: [] },
  { keywords: ['update meeting', 'edit meeting', 'change meeting', 'reschedule meeting'], tool: 'updateMeeting', missingParameters: ['id'] },
  { keywords: ['delete meeting', 'cancel meeting', 'remove meeting'], tool: 'deleteMeeting', missingParameters: ['id'] },
  // Follow-ups
  { keywords: ['create a follow', 'create follow', 'add follow', 'new follow-up', 'new followup', 'follow up with', 'follow-up with'], tool: 'createFollowUp', missingParameters: ['title'] },
  { keywords: ['show follow', 'list follow', 'get follow', 'my follow', 'what follow'], tool: 'getFollowUps', missingParameters: [] },
  { keywords: ['update follow', 'edit follow-up', 'change follow-up'], tool: 'updateFollowUp', missingParameters: ['id'] },
  { keywords: ['delete follow', 'remove follow-up'], tool: 'deleteFollowUp', missingParameters: ['id'] },
  // Knowledge
  { keywords: ['create knowledge', 'add knowledge', 'save note', 'new knowledge', 'save to knowledge', 'save this note'], tool: 'createKnowledge', missingParameters: ['title', 'content'] },
  { keywords: ['search knowledge', 'search my knowledge', 'find knowledge', 'look up knowledge', 'look up in knowledge', 'search the knowledge'], tool: 'searchKnowledge', missingParameters: ['query'] },
  { keywords: ['get knowledge', 'show knowledge', 'retrieve knowledge'], tool: 'getKnowledge', missingParameters: ['id'] },
  // Work Logs
  { keywords: ['log work', 'log hours', 'log my work', 'track hours', 'add work log', 'record work', 'hours of work', 'hours on the', 'hours on project'], tool: 'createWorkLog', missingParameters: ['title', 'hoursSpent'] },
  { keywords: ['show work logs', 'list work logs', 'my work logs', 'get work logs', 'what work logs'], tool: 'getWorkLogs', missingParameters: [] },
  // Dashboard & Calendar
  { keywords: ['dashboard', 'show dashboard', 'summary', 'overview', 'stats', 'statistics', 'show summary'], tool: 'getDashboardStats', missingParameters: [] },
  { keywords: ['calendar', 'get calendar', 'show calendar', 'my events', 'get events', 'schedule for'], tool: 'getCalendarEvents', missingParameters: [] },
];

/**
 * Lightweight mock intent matcher for when no API is configured.
 * @param {string} message - User message.
 * @returns {object} Structured tool call result.
 */
function mockFunctionCalling(message) {
  const lowerMsg = message.toLowerCase().trim();

  for (const pattern of MOCK_INTENT_PATTERNS) {
    if (pattern.keywords.some((kw) => lowerMsg.includes(kw))) {
      const result = {
        shouldCallTool: true,
        tool: pattern.tool,
        parameters: {},
        reason: `Matched keyword pattern for ${pattern.tool}`,
        isMock: true,
      };

      if (pattern.missingParameters && pattern.missingParameters.length > 0) {
        result.missingParameters = pattern.missingParameters;
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
