/**
 * DPS AI Action Orchestrator
 *
 * Integrates Function Calling → Tool Executor → Response Generator
 * to enable autonomous AI actions within DPS.
 *
 * Flow:
 *   User Message → Function Calling (select tool) → Tool Executor (execute) → Response Generator (format)
 *
 * Handles conversation context for references like "that task", "it", "the project", etc.
 */

import { selectTool } from './functionCalling.js';
import { executeTool, getExecutionLogs } from './toolExecutor.js';
import { generateResponse } from './responseGenerator.js';

// ============================================================
//  PENDING TOOL CALL STATE (BUG #6 fix)
// ============================================================

/**
 * In-memory store for pending tool calls awaiting missing parameters.
 * Key: conversationId, Value: { tool, parameters, timestamp }
 */
const pendingToolCalls = new Map();

/**
 * Store a pending tool call when parameters are missing.
 */
function storePendingToolCall(conversationId, tool, parameters) {
  pendingToolCalls.set(conversationId, {
    tool,
    parameters,
    timestamp: Date.now(),
  });
}

/**
 * Retrieve and clear a pending tool call.
 */
function getPendingToolCall(conversationId) {
  const pending = pendingToolCalls.get(conversationId);
  if (pending) {
    pendingToolCalls.delete(conversationId);
    return pending;
  }
  return null;
}

/**
 * Check if there's a pending tool call for a conversation.
 */
function hasPendingToolCall(conversationId) {
  return pendingToolCalls.has(conversationId);
}

// ============================================================
//  CONVERSATION CONTEXT MEMORY
// ============================================================

/**
 * Extracts entity references from recent conversation history.
 * Used to resolve pronouns like "it", "that task", "the project", etc.
 * BUG #7: Enhanced to extract from success messages with actual MongoDB data
 */
function extractContextFromHistory(conversationHistory = []) {
  const context = {
    lastTask: null,
    lastProject: null,
    lastGoal: null,
    lastMeeting: null,
    lastFollowUp: null,
    lastCreatedEntity: null,
  };

  // Iterate through conversation history in reverse (most recent first)
  const reversedHistory = [...conversationHistory].reverse();

  for (const msg of reversedHistory) {
    if (msg.sender !== 'assistant') continue;

    const text = msg.text || msg.content || '';

    // Extract task references from success messages (BUG #7 fix)
    if (text.includes('Task created successfully') || text.includes('Task') && !context.lastTask) {
      const taskMatch = text.match(/Title:\s*\*\*([^*]+)\*\*/i);
      if (taskMatch) {
        context.lastTask = taskMatch[1].trim();
        context.lastCreatedEntity = { type: 'task', name: taskMatch[1].trim() };
      } else {
        // Fallback to older pattern
        const fallbackMatch = text.match(/Task\s+["']?([^"'\n]+)["']?/i);
        if (fallbackMatch) {
          context.lastTask = fallbackMatch[1];
          context.lastCreatedEntity = { type: 'task', name: fallbackMatch[1] };
        }
      }
    }

    // Extract project references
    if (text.includes('Project') && !context.lastProject) {
      const projectMatch = text.match(/Title:\s*\*\*([^*]+)\*\*/i);
      if (projectMatch) {
        context.lastProject = projectMatch[1].trim();
        context.lastCreatedEntity = { type: 'project', name: projectMatch[1].trim() };
      } else {
        const fallbackMatch = text.match(/Project\s+["']?([^"'\n]+)["']?/i);
        if (fallbackMatch) {
          context.lastProject = fallbackMatch[1];
          context.lastCreatedEntity = { type: 'project', name: fallbackMatch[1] };
        }
      }
    }

    // Extract goal references
    if (text.includes('Goal') && !context.lastGoal) {
      const goalMatch = text.match(/Title:\s*\*\*([^*]+)\*\*/i);
      if (goalMatch) {
        context.lastGoal = goalMatch[1].trim();
        context.lastCreatedEntity = { type: 'goal', name: goalMatch[1].trim() };
      } else {
        const fallbackMatch = text.match(/Goal\s+["']?([^"'\n]+)["']?/i);
        if (fallbackMatch) {
          context.lastGoal = fallbackMatch[1];
          context.lastCreatedEntity = { type: 'goal', name: fallbackMatch[1] };
        }
      }
    }

    // Extract meeting references
    if (text.includes('Meeting') && !context.lastMeeting) {
      const meetingMatch = text.match(/Title:\s*\*\*([^*]+)\*\*/i);
      if (meetingMatch) {
        context.lastMeeting = meetingMatch[1].trim();
        context.lastCreatedEntity = { type: 'meeting', name: meetingMatch[1].trim() };
      } else {
        const fallbackMatch = text.match(/Meeting\s+["']?([^"'\n]+)["']?/i);
        if (fallbackMatch) {
          context.lastMeeting = fallbackMatch[1];
          context.lastCreatedEntity = { type: 'meeting', name: fallbackMatch[1] };
        }
      }
    }

    // Extract follow-up references
    if (text.includes('Follow-up') && !context.lastFollowUp) {
      const followUpMatch = text.match(/Follow-up with\s+\*\*([^*]+)\*\*/i);
      if (followUpMatch) {
        context.lastFollowUp = followUpMatch[1].trim();
        context.lastCreatedEntity = { type: 'followup', name: followUpMatch[1].trim() };
      } else {
        const fallbackMatch = text.match(/Follow-up\s+(?:with\s+)?["']?([^"'\n]+)["']?/i);
        if (fallbackMatch) {
          context.lastFollowUp = fallbackMatch[1];
          context.lastCreatedEntity = { type: 'followup', name: fallbackMatch[1] };
        }
      }
    }
  }

  return context;
}

/**
 * Resolves pronoun references in user message using conversation context.
 * For example: "it" → last created entity name, "that task" → last task name.
 */
function resolveReferences(message, context) {
  let resolvedMessage = message;

  // Resolve "it"
  if (context.lastCreatedEntity && /\bit\b/i.test(resolvedMessage)) {
    resolvedMessage = resolvedMessage.replace(/\bit\b/gi, context.lastCreatedEntity.name);
  }

  // Resolve "that task"
  if (context.lastTask && /\bthat task\b/i.test(resolvedMessage)) {
    resolvedMessage = resolvedMessage.replace(/\bthat task\b/gi, context.lastTask);
  }

  // Resolve "the project"
  if (context.lastProject && /\bthe project\b/i.test(resolvedMessage)) {
    resolvedMessage = resolvedMessage.replace(/\bthe project\b/gi, context.lastProject);
  }

  // Resolve "that goal"
  if (context.lastGoal && /\bthat goal\b/i.test(resolvedMessage)) {
    resolvedMessage = resolvedMessage.replace(/\bthat goal\b/gi, context.lastGoal);
  }

  // Resolve "the meeting"
  if (context.lastMeeting && /\bthe meeting\b/i.test(resolvedMessage)) {
    resolvedMessage = resolvedMessage.replace(/\bthe meeting\b/gi, context.lastMeeting);
  }

  return resolvedMessage;
}

// ============================================================
//  SPECIALIZED AGENDA GENERATORS
// ============================================================

/**
 * Generates Today's Agenda by combining tasks, meetings, and follow-ups.
 */
async function generateTodaysAgenda(conversationId) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Execute multiple tools in parallel
  const [tasksResult, meetingsResult, followupsResult] = await Promise.all([
    executeTool({
      tool: 'getTasks',
      parameters: { status: 'Pending', limit: 10 },
      conversationId,
    }),
    executeTool({
      tool: 'getMeetings',
      parameters: { startDate: todayStr, endDate: todayStr, limit: 10 },
      conversationId,
    }),
    executeTool({
      tool: 'getFollowUps',
      parameters: { status: 'Pending', limit: 10 },
      conversationId,
    }),
  ]);

  const tasks = tasksResult.success ? (tasksResult.result || []) : [];
  const meetings = meetingsResult.success ? (meetingsResult.result || []) : [];
  const followups = followupsResult.success ? (followupsResult.result || []) : [];

  // Format agenda
  let agenda = `📅 **Today's Agenda** - ${today.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}\n\n`;

  // Tasks section
  if (tasks.length > 0) {
    agenda += `📋 **Tasks** (${tasks.length})\n`;
    tasks.forEach((task) => {
      agenda += `- ${task.title} (Priority: ${task.priority})\n`;
    });
    agenda += '\n';
  } else {
    agenda += `📋 **Tasks**: No pending tasks\n\n`;
  }

  // Meetings section
  if (meetings.length > 0) {
    agenda += `📅 **Meetings** (${meetings.length})\n`;
    meetings.forEach((meeting) => {
      agenda += `- ${meeting.title} at ${meeting.time || 'TBD'}\n`;
    });
    agenda += '\n';
  } else {
    agenda += `📅 **Meetings**: No meetings scheduled today\n\n`;
  }

  // Follow-ups section
  if (followups.length > 0) {
    agenda += `📞 **Follow-ups** (${followups.length})\n`;
    followups.forEach((fu) => {
      agenda += `- Follow up with ${fu.personName || fu.subject} regarding ${fu.subject}\n`;
    });
  } else {
    agenda += `📞 **Follow-ups**: No pending follow-ups\n`;
  }

  return {
    success: true,
    tool: 'getTodaysAgenda',
    result: {
      tasks,
      meetings,
      followups,
      summary: agenda,
    },
    message: 'Today\'s agenda generated successfully.',
  };
}

// ============================================================
//  MAIN ORCHESTRATOR API
// ============================================================

/**
 * Main AI Action Orchestrator entry point.
 *
 * Determines if the user message requires a tool action, executes it,
 * and generates a natural language response.
 *
 * @param {object} params
 * @param {string} params.message - User's message
 * @param {Array} [params.conversationHistory=[]] - Conversation history for context
 * @param {string} [params.conversationId=null] - Conversation ID for audit logging
 * @returns {Promise<object>} Orchestrated response with reply, suggestions, status
 */
export async function orchestrateAction({ message, conversationHistory = [], conversationId = null }) {
  // BUG #6: Check if there's a pending tool call awaiting missing parameters
  if (conversationId && hasPendingToolCall(conversationId)) {
    const pending = getPendingToolCall(conversationId);
    
    // Extract the missing parameter value from the user's response
    // For simplicity, we'll treat the entire message as the missing value
    // In production, this would be more sophisticated
    const missingParam = pending.tool === 'createTask' ? 'title' : 
                        pending.tool === 'createMeeting' ? 'title' :
                        pending.tool === 'createGoal' ? 'title' :
                        pending.tool === 'createProject' ? 'title' :
                        pending.tool === 'createFollowUp' ? 'title' : 'title';
    
    // Merge the provided parameter with existing parameters
    const mergedParameters = { ...pending.parameters };
    mergedParameters[missingParam] = message.trim();
    
    // Execute the tool with the complete parameters
    const executionResult = await executeTool({
      tool: pending.tool,
      parameters: mergedParameters,
      conversationId,
    });
    
    // Generate natural language response
    const response = generateResponse({
      toolResult: executionResult,
      originalPrompt: message,
      conversationHistory,
    });
    
    return {
      ...response,
      toolUsed: pending.tool,
      isAction: true,
      executionResult,
    };
  }

  // 1. Extract conversation context
  const context = extractContextFromHistory(conversationHistory);

  // 2. Resolve pronoun references
  const resolvedMessage = resolveReferences(message, context);

  // 3. Check for special agenda requests
  const lowerMessage = resolvedMessage.toLowerCase();
  if (
    lowerMessage.includes('agenda') ||
    lowerMessage.includes('what do i have') ||
    lowerMessage.includes("what's on my agenda") ||
    lowerMessage.includes('today\'s schedule') ||
    lowerMessage.includes('today\'s tasks') ||
    lowerMessage.includes('today\'s meetings') ||
    lowerMessage.includes('today\'s follow-ups')
  ) {
    const agendaResult = await generateTodaysAgenda(conversationId);
    const response = generateResponse({
      toolResult: agendaResult,
      originalPrompt: message,
      conversationHistory,
    });
    return {
      ...response,
      toolUsed: 'getTodaysAgenda',
      isAction: true,
    };
  }

  // 4. Use Function Calling to select tool
  const functionCallResult = await selectTool({
    message: resolvedMessage,
    conversationHistory,
  });

  // 5. If no tool selected, return conversational response
  if (!functionCallResult.shouldCallTool) {
    return {
      reply: null, // Signal to use normal AI conversation
      suggestions: [],
      status: 'conversation',
      isAction: false,
    };
  }

  // 6. If missing parameters, ask user for them (BUG #6 fix)
  if (functionCallResult.missingParameters && functionCallResult.missingParameters.length > 0) {
    // Store the pending tool call for immediate execution when user responds
    if (conversationId) {
      storePendingToolCall(conversationId, functionCallResult.tool, functionCallResult.parameters);
    }
    
    const response = generateResponse({
      toolResult: functionCallResult,
      originalPrompt: message,
      conversationHistory,
    });
    return {
      ...response,
      toolUsed: functionCallResult.tool,
      isAction: true,
    };
  }

  // 7. Execute the tool through Tool Executor
  const executionResult = await executeTool({
    tool: functionCallResult.tool,
    parameters: functionCallResult.parameters,
    conversationId,
  });

  // 8. Generate natural language response
  const response = generateResponse({
    toolResult: executionResult,
    originalPrompt: message,
    conversationHistory,
  });

  return {
    ...response,
    toolUsed: functionCallResult.tool,
    isAction: true,
    executionResult,
  };
}

/**
 * Get audit logs for debugging and monitoring.
 */
export function getActionAuditLogs() {
  return getExecutionLogs();
}

export const aiActionOrchestrator = {
  orchestrateAction,
  getActionAuditLogs,
  extractContextFromHistory,
  resolveReferences,
};

export default aiActionOrchestrator;
