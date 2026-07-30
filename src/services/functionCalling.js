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
//  PRODUCTION-GRADE INTENT ENGINE
//  Priority-based intent classification with confidence scoring
// ============================================================

// Intent Priority System (higher priority = checked first)
const INTENT_PRIORITIES = {
  // Priority 100 - Delete operations (highest)
  delete: {
    priority: 100,
    keywords: ['delete', 'remove', 'erase', 'discard', 'cancel'],
    tools: {
      task: 'deleteTask',
      meeting: 'deleteMeeting',
      project: 'deleteProject',
      followup: 'deleteFollowUp',
      goal: 'deleteGoal',
      knowledge: 'deleteKnowledge',
      worklog: 'deleteWorkLog'
    }
  },
  
  // Priority 95 - Complete operations
  complete: {
    priority: 95,
    keywords: ['complete', 'completed', 'done', 'finish', 'mark complete', 'mark completed'],
    tools: {
      task: 'completeTask'
    }
  },
  
  // Priority 90 - Update operations
  update: {
    priority: 90,
    keywords: ['update', 'change', 'edit', 'rename', 'modify', 'reschedule'],
    tools: {
      task: 'updateTask',
      meeting: 'updateMeeting',
      project: 'updateProject',
      followup: 'updateFollowUp',
      goal: 'updateGoal',
      knowledge: 'updateKnowledge',
      worklog: 'updateWorkLog'
    }
  },
  
  // Priority 85 - List/View operations
  list: {
    priority: 85,
    keywords: ['show', 'list', 'display', 'view', 'my', 'all', 'pending', 'completed'],
    tools: {
      task: 'getTasks',
      meeting: 'getMeetings',
      project: 'getProjects',
      followup: 'getFollowUps',
      goal: 'getGoals',
      knowledge: 'getKnowledge',
      worklog: 'getWorkLogs',
      dashboard: 'getDashboardStats',
      calendar: 'getCalendarEvents',
      agenda: 'getTodaysAgenda'
    }
  },
  
  // Priority 80 - Create operations (lowest)
  create: {
    priority: 80,
    keywords: ['create', 'add', 'new', 'make', 'schedule', 'set', 'save'],
    tools: {
      task: 'createTask',
      meeting: 'createMeeting',
      project: 'createProject',
      followup: 'createFollowUp',
      goal: 'createGoal',
      knowledge: 'createKnowledge',
      worklog: 'createWorkLog'
    }
  }
};

// Entity detection keywords
const ENTITY_KEYWORDS = {
  task: ['task', 'todo', 'work item', 'item'],
  meeting: ['meeting', 'appointment', 'call', 'session'],
  project: ['project', 'initiative', 'program'],
  followup: ['follow up', 'follow-up', 'call', 'reminder', 'followup'],
  goal: ['goal', 'objective', 'target', 'milestone'],
  knowledge: ['note', 'knowledge', 'information', 'document'],
  worklog: ['work log', 'log', 'hours', 'time'],
  dashboard: ['dashboard', 'summary', 'overview', 'stats', 'statistics'],
  calendar: ['calendar', 'schedule', 'agenda', 'events'],
  agenda: ['agenda', "today's schedule", 'what do i have', "what's on my agenda"]
};

// Minimum confidence threshold for tool execution
const MIN_CONFIDENCE_THRESHOLD = 0.65;

// ============================================================
//  CONFIDENCE SCORING ENGINE
// ============================================================

/**
 * Calculate confidence score for an intent match based on keyword strength and context.
 * @param {string} message - User message
 * @param {string} intentType - Intent type (delete, update, list, create, complete)
 * @param {string} entityType - Entity type (task, meeting, project, etc.)
 * @returns {number} Confidence score between 0 and 1
 */
function calculateConfidence(message, intentType, entityType) {
  const lowerMsg = message.toLowerCase();
  let score = 0;
  
  // Base score for entity match
  const entityKeywords = ENTITY_KEYWORDS[entityType] || [];
  const entityMatch = entityKeywords.some(kw => lowerMsg.includes(kw));
  if (entityMatch) score += 0.4;
  
  // Intent keyword score
  const intentConfig = INTENT_PRIORITIES[intentType];
  if (intentConfig) {
    const intentMatch = intentConfig.keywords.some(kw => lowerMsg.includes(kw));
    if (intentMatch) score += 0.5;
  }
  
  // Bonus for explicit entity-intent combination
  if (entityMatch && intentConfig && intentConfig.keywords.some(kw => lowerMsg.includes(kw))) {
    score += 0.1;
  }
  
  // Penalty for ambiguous messages
  if (lowerMsg.length < 5) score -= 0.2;
  if (lowerMsg.split(' ').length < 3) score -= 0.1;
  
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Detect entity type from message.
 * @param {string} message - User message
 * @returns {string|null} Entity type or null if not detected
 */
function detectEntityType(message) {
  const lowerMsg = message.toLowerCase();
  
  for (const [entityType, keywords] of Object.entries(ENTITY_KEYWORDS)) {
    for (const keyword of keywords) {
      if (lowerMsg.includes(keyword)) {
        return entityType;
      }
    }
  }
  
  return null;
}

/**
 * Detect intent type from message based on priority.
 * @param {string} message - User message
 * @returns {object} Intent type and confidence
 */
function detectIntentType(message) {
  const lowerMsg = message.toLowerCase();
  
  // Check intents in priority order (highest first)
  const sortedIntents = Object.entries(INTENT_PRIORITIES)
    .sort((a, b) => b[1].priority - a[1].priority);
  
  for (const [intentType, config] of sortedIntents) {
    for (const keyword of config.keywords) {
      if (lowerMsg.includes(keyword)) {
        return { intentType, keyword };
      }
    }
  }
  
  // Default to create if no explicit intent detected but entity is present
  const entityType = detectEntityType(message);
  if (entityType) {
    return { intentType: 'create', keyword: 'implicit' };
  }
  
  return null;
}

// ============================================================
//  CONVERSATION CONTEXT RESOLUTION
// ============================================================

/**
 * Resolve reference words (it, that, latest, previous) using conversation history.
 * @param {string} reference - Reference word (e.g., 'it', 'latest', 'that task')
 * @param {Array} conversationHistory - Conversation history
 * @returns {object|null} Resolved entity or null
 */
function resolveReference(reference, conversationHistory = []) {
  const lowerRef = reference.toLowerCase();
  
  // Find the most recent relevant entity from conversation history
  const reversedHistory = [...conversationHistory].reverse();
  
  for (const msg of reversedHistory) {
    if (msg.sender === 'assistant' && msg.text) {
      const text = msg.text.toLowerCase();
      
      // Look for task references
      if (text.includes('task') && (lowerRef.includes('it') || lowerRef.includes('that') || lowerRef.includes('latest'))) {
        // Extract task title from AI response (simple extraction)
        const taskMatch = text.match(/task\s*["']?([^"'\n]+)/i);
        if (taskMatch) {
          return { type: 'task', value: taskMatch[1].trim() };
        }
      }
      
      // Look for meeting references
      if (text.includes('meeting') && (lowerRef.includes('it') || lowerRef.includes('that') || lowerRef.includes('latest'))) {
        const meetingMatch = text.match(/meeting\s*["']?([^"'\n]+)/i);
        if (meetingMatch) {
          return { type: 'meeting', value: meetingMatch[1].trim() };
        }
      }
      
      // Look for project references
      if (text.includes('project') && (lowerRef.includes('it') || lowerRef.includes('that') || lowerRef.includes('latest'))) {
        const projectMatch = text.match(/project\s*["']?([^"'\n]+)/i);
        if (projectMatch) {
          return { type: 'project', value: projectMatch[1].trim() };
        }
      }
    }
  }
  
  return null;
}

/**
 * Extract target identifier from message (handles 'latest', 'previous', 'it', etc.)
 * @param {string} message - User message
 * @param {Array} conversationHistory - Conversation history
 * @returns {object} Target identifier object
 */
function extractTargetIdentifier(message, conversationHistory = []) {
  const lowerMsg = message.toLowerCase();
  
  // Check for reference words
  if (lowerMsg.includes('latest') || lowerMsg.includes('previous') || lowerMsg.includes('it') || lowerMsg.includes('that')) {
    const resolved = resolveReference(lowerMsg, conversationHistory);
    if (resolved) {
      return { type: 'reference', value: resolved.value, entityType: resolved.type };
    }
  }
  
  // Check for explicit title/name
  const entityKeywords = ['task', 'meeting', 'project', 'followup', 'goal'];
  for (const keyword of entityKeywords) {
    const pattern = new RegExp(`${keyword}\s+["']?([^"'\n]+)`, 'i');
    const match = message.match(pattern);
    if (match) {
      return { type: 'explicit', value: match[1].trim(), entityType: keyword };
    }
  }
  
  return { type: 'missing' };
}

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
 * Extract title from message (removes action keywords and metadata).
 */
function extractTitleFromMessage(message, intentType, entityType) {
  let title = message.trim();
  const lowerTitle = title.toLowerCase();
  
  // Remove intent keywords based on detected intent
  const intentConfig = INTENT_PRIORITIES[intentType];
  if (intentConfig) {
    for (const keyword of intentConfig.keywords) {
      if (lowerTitle.includes(keyword)) {
        title = title.replace(new RegExp(keyword, 'gi'), '').trim();
      }
    }
  }
  
  // Remove entity keywords
  const entityKeywords = ENTITY_KEYWORDS[entityType] || [];
  for (const keyword of entityKeywords) {
    if (lowerTitle.includes(keyword)) {
      title = title.replace(new RegExp(keyword, 'gi'), '').trim();
    }
  }
  
  // Remove time expressions
  title = title.replace(/\b(tomorrow|today|next monday|next tuesday|next wednesday|next thursday|next friday|next saturday|next sunday|in \d+ days?|at \d+ (am|pm))\b/gi, '').trim();
  
  // Remove priority expressions
  title = title.replace(/\b(high priority|low priority|medium priority|urgent|important)\b/gi, '').trim();
  
  // Clean up extra spaces and punctuation
  title = title.replace(/\s+/g, ' ').trim();
  title = title.replace(/^[,\s]+|[,\s]+$/g, '');
  
  return title || null;
}

/**
 * Extract time from message.
 */
function extractTimeFromText(message) {
  const lowerMsg = message.toLowerCase();
  
  // Match time patterns like "5 PM", "3:30 PM", "at 5"
  const timeMatch = lowerMsg.match(/(?:at\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;
    
    if (ampm === 'pm' && hours < 12) {
      return `${hours + 12}:${minutes.toString().padStart(2, '0')}`;
    } else if (ampm === 'am' && hours === 12) {
      return `0:${minutes.toString().padStart(2, '0')}`;
    } else {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }
  
  return null;
}

/**
 * Production-grade Intent Engine for when no API is configured.
 * Uses priority-based intent classification with confidence scoring.
 * @param {string} message - User message.
 * @param {Array} conversationHistory - Conversation history for context resolution.
 * @returns {object} Structured tool call result with confidence score.
 */
function mockFunctionCalling(message, conversationHistory = []) {
  const lowerMsg = message.toLowerCase().trim();
  
  // Step 1: Check for special requests first (dashboard, agenda, calendar)
  if (lowerMsg.includes('dashboard') || lowerMsg.includes('summary') || lowerMsg.includes('overview') || lowerMsg.includes('stats')) {
    return {
      shouldCallTool: true,
      tool: 'getDashboardStats',
      parameters: {},
      confidence: 0.9,
      reason: 'Matched dashboard request',
      isMock: true,
    };
  }
  if (lowerMsg.includes('agenda') || lowerMsg.includes("today's schedule") || lowerMsg.includes('what do i have') || lowerMsg.includes("what's on my agenda")) {
    return {
      shouldCallTool: true,
      tool: 'getTodaysAgenda',
      parameters: {},
      confidence: 0.9,
      reason: 'Matched agenda request',
      isMock: true,
    };
  }
  if (lowerMsg.includes('calendar') || lowerMsg.includes('events')) {
    return {
      shouldCallTool: true,
      tool: 'getCalendarEvents',
      parameters: {},
      confidence: 0.9,
      reason: 'Matched calendar request',
      isMock: true,
    };
  }
  
  // Step 2: Detect entity type
  const entityType = detectEntityType(message);
  if (!entityType) {
    return { shouldCallTool: false, isMock: true };
  }
  
  // Step 2: Detect intent type based on priority
  const intentDetection = detectIntentType(message);
  if (!intentDetection) {
    return { shouldCallTool: false, isMock: true };
  }
  
  const intentType = intentDetection.intentType;
  
  // Step 3: Calculate confidence score
  const confidence = calculateConfidence(message, intentType, entityType);
  
  // Step 4: If confidence is too low, return needsClarification
  if (confidence < MIN_CONFIDENCE_THRESHOLD) {
    return {
      shouldCallTool: false,
      needsClarification: true,
      confidence,
      reason: 'Confidence below threshold',
      isMock: true,
    };
  }
  
  // Step 5: Map intent + entity to tool
  const intentConfig = INTENT_PRIORITIES[intentType];
  const tool = intentConfig.tools[entityType];
  
  if (!tool) {
    return { shouldCallTool: false, isMock: true };
  }
  
  // Step 6: Build result with parameters
  const result = {
    shouldCallTool: true,
    tool,
    parameters: {},
    confidence,
    reason: `Matched intent '${intentType}' with entity '${entityType}' (confidence: ${confidence.toFixed(2)})`,
    isMock: true,
  };
  
  // Step 7: Extract parameters based on tool type
  if (tool === 'createTask' || tool === 'createMeeting' || tool === 'createProject' || tool === 'createFollowUp' || tool === 'createGoal' || tool === 'createKnowledge' || tool === 'createWorkLog') {
    // Creation tools - extract title
    const title = extractTitleFromMessage(message, intentType, entityType);
    if (title) {
      result.parameters.title = title;
    }
    
    // Extract date
    const date = extractDateFromText(message);
    if (date) {
      result.parameters.deadline = date;
      result.parameters.startDate = date;
    }
    
    // Extract time
    const time = extractTimeFromText(message);
    if (time) {
      result.parameters.time = time;
    }
    
    // Extract priority
    const priority = extractPriorityFromText(message);
    if (priority) {
      result.parameters.priority = priority;
    }
    
    // Determine missing parameters
    if (!title) {
      result.missingParameters = ['title'];
    }
  } else if (tool === 'updateTask' || tool === 'updateMeeting' || tool === 'updateProject' || tool === 'updateFollowUp' || tool === 'updateGoal' || tool === 'updateKnowledge' || tool === 'updateWorkLog') {
    // Update tools - extract target identifier
    const target = extractTargetIdentifier(message, conversationHistory);
    if (target.type === 'reference') {
      result.parameters.id = target.value;
    } else if (target.type === 'explicit') {
      result.parameters.id = target.value;
    } else {
      result.missingParameters = ['id'];
    }
    
    // Extract update values
    if (lowerMsg.includes('priority')) {
      const priority = extractPriorityFromText(message);
      if (priority) result.parameters.priority = priority;
    }
  } else if (tool === 'deleteTask' || tool === 'deleteMeeting' || tool === 'deleteProject' || tool === 'deleteFollowUp' || tool === 'deleteGoal' || tool === 'deleteKnowledge' || tool === 'deleteWorkLog') {
    // Delete tools - extract target identifier
    const target = extractTargetIdentifier(message, conversationHistory);
    if (target.type === 'reference') {
      result.parameters.id = target.value;
    } else if (target.type === 'explicit') {
      result.parameters.id = target.value;
    } else {
      result.missingParameters = ['id'];
    }
  } else if (tool === 'completeTask') {
    // Complete tool - extract target identifier
    const target = extractTargetIdentifier(message, conversationHistory);
    if (target.type === 'reference') {
      result.parameters.id = target.value;
    } else if (target.type === 'explicit') {
      result.parameters.id = target.value;
    } else {
      result.missingParameters = ['id'];
    }
  }
  
  return result;
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
 * @property {number}  [confidence]       - Confidence score (0-1).
 * @property {boolean} [needsClarification] - Whether clarification is needed.
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
      return mockFunctionCalling(message, conversationHistory);
    }
  }

  // Fallback: mock keyword-based matcher (no API key configured)
  return mockFunctionCalling(message, conversationHistory);
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
