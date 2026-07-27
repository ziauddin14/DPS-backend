/**
 * DPS AI Response Generator Service
 *
 * Converts structured Tool Executor results into clean, professional, human-friendly
 * Markdown conversation replies with smart suggestions and language detection.
 *
 * Pure formatting layer — NO tool execution, NO database access, NO LLM re-calls.
 */

// ============================================================
//  LANGUAGE DETECTION HELPER
// ============================================================
const ROMAN_URDU_KEYWORDS = [
  'karo', 'karna', 'kardein', 'kardo', 'mera', 'meri', 'mere',
  'batao', 'dikhao', 'banao', 'banaen', 'kya', 'aaj', 'subah',
  'shaam', 'kal', 'parson', 'hai', 'hain', 'rakho', 'rakhein',
  'haan', 'nahi', 'kuch', 'kaam', 'shukriya', 'meherbani'
];

/**
 * Detect whether the user prompt is written in Roman Urdu.
 */
function isRomanUrdu(prompt = '') {
  if (!prompt || typeof prompt !== 'string') return false;
  const words = prompt.toLowerCase().split(/\s+/);
  let matchCount = 0;
  for (const word of words) {
    if (ROMAN_URDU_KEYWORDS.includes(word.replace(/[^\w]/g, ''))) {
      matchCount++;
    }
  }
  return matchCount >= 1;
}

// ============================================================
//  INTELLIGENT SUGGESTIONS GENERATOR
// ============================================================
function generateSuggestions(toolName, isSuccess = true) {
  if (!isSuccess) {
    return ['Try rephrasing your request', 'View pending tasks', 'Show dashboard summary'];
  }

  switch (toolName) {
    case 'createTask':
    case 'completeTask':
    case 'updateTask':
      return ['Schedule on Calendar', 'Add a follow-up reminder', 'View all pending tasks'];

    case 'getTasks':
    case 'getTask':
      return ['Create a new task', 'Show high priority tasks', 'View dashboard summary'];

    case 'createGoal':
    case 'updateGoal':
    case 'getGoals':
      return ['Add tasks for this goal', 'Set milestone deadline', 'View all goals'];

    case 'createProject':
    case 'updateProject':
    case 'getProjects':
      return ['Add project tasks', 'Log work hours on project', 'View active projects'];

    case 'createMeeting':
    case 'updateMeeting':
    case 'getMeetings':
      return ['Prepare meeting agenda', 'Create follow-up task', 'View calendar events'];

    case 'createFollowUp':
    case 'updateFollowUp':
    case 'getFollowUps':
      return ['Schedule call on calendar', 'Create related task', 'View pending follow-ups'];

    case 'createKnowledge':
    case 'searchKnowledge':
    case 'getKnowledge':
      return ['Search knowledge base', 'Link to active project', 'Add a new note'];

    case 'createWorkLog':
    case 'getWorkLogs':
      return ['View work summary', 'Log more hours', 'Show project progress'];

    case 'getDashboardStats':
      return ['Show pending tasks', 'Show upcoming meetings', 'View active goals'];

    case 'getCalendarEvents':
      return ['Schedule new meeting', 'Show today\'s tasks', 'View pending follow-ups'];

    default:
      return ['Show dashboard summary', 'View my tasks', 'How can you help me?'];
  }
}

// ============================================================
//  TOOL RESULT FORMATTERS
// ============================================================

/**
 * Format date nicely for human display.
 */
function formatDate(dateVal) {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? String(dateVal) : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Format time nicely for human display.
 */
function formatTime(timeVal) {
  if (!timeVal) return 'TBD';
  return timeVal;
}

/**
 * Cleanly format tool execution result into human-readable Markdown.
 */
function formatToolSuccessResult(toolName, result, isUrdu = false) {
  switch (toolName) {
    // ── TASKS ───────────────────────────────────────────────
    case 'createTask':
      if (isUrdu) {
        return `✅ Task **${result.title || 'N/A'}** kamyabi se bana di gayi hai!\n\n- **Title**: ${result.title || 'N/A'}\n- **Priority**: ${result.priority || 'Medium'}\n- **Status**: ${result.status || 'Pending'}\n- **Category**: ${result.category || 'General'}${result.deadline ? `\n- **Due Date**: ${formatDate(result.deadline)}` : ''}`;
      }
      // BUG #4: Use actual MongoDB document data for verification
      return `✅ Task created successfully.\n\n- **Title**: ${result.title || 'N/A'}\n- **Priority**: ${result.priority || 'Medium'}\n- **Status**: ${result.status || 'Pending'}\n- **Category**: ${result.category || 'General'}${result.deadline ? `\n- **Due Date**: ${formatDate(result.deadline)}` : ''}`;

    case 'updateTask':
      return `✏️ Task **${result.title || 'N/A'}** has been updated successfully.\n\n- **Status**: ${result.status || 'Pending'}\n- **Priority**: ${result.priority || 'Medium'}`;

    case 'completeTask':
      return `🎉 Task **${result.title || 'N/A'}** has been marked as **Completed**!`;

    case 'deleteTask':
      return `🗑️ Task has been deleted successfully.`;

    case 'getTask':
      return `📋 **Task Details**: **${result.title}**\n\n- **Status**: ${result.status}\n- **Priority**: ${result.priority}\n- **Category**: ${result.category}${result.description ? `\n- **Description**: ${result.description}` : ''}`;

    case 'getTasks':
      if (!Array.isArray(result) || result.length === 0) {
        return `📋 No tasks found matching your request.`;
      }
      const taskList = result.map((t) => `- **${t.title}** | Priority: \`${t.priority || 'Medium'}\` | Status: \`${t.status || 'Pending'}\``).join('\n');
      return `📋 Here are your tasks (${result.length}):\n\n${taskList}`;

    // ── GOALS ───────────────────────────────────────────────
    case 'createGoal':
      return `🎯 Goal **${result.title}** has been created!\n\n- **Type**: ${result.type || 'Weekly'}\n- **Priority**: ${result.priority || 'Medium'}\n- **Status**: ${result.status || 'Not Started'}`;

    case 'updateGoal':
      return `🎯 Goal **${result.title}** updated successfully.`;

    case 'deleteGoal':
      return `🗑️ Goal has been deleted successfully.`;

    case 'getGoals':
      if (!Array.isArray(result) || result.length === 0) {
        return `🎯 No goals found matching your request.`;
      }
      const goalList = result.map((g) => `- 🎯 **${g.title}** | Type: \`${g.type}\` | Status: \`${g.status}\``).join('\n');
      return `🎯 Here are your goals (${result.length}):\n\n${goalList}`;

    // ── PROJECTS ────────────────────────────────────────────
    case 'createProject':
      return `📁 Project **${result.title}** created successfully!\n\n- **Status**: ${result.status || 'Planning'}\n- **Priority**: ${result.priority || 'Medium'}\n- **Department**: ${result.department || 'General'}`;

    case 'updateProject':
      return `📁 Project **${result.title}** updated successfully.`;

    case 'deleteProject':
      return `🗑️ Project has been deleted successfully.`;

    case 'getProjects':
      if (!Array.isArray(result) || result.length === 0) {
        return `📁 No active projects found.`;
      }
      const projList = result.map((p) => `- 📁 **${p.title}** | Status: \`${p.status}\` | Priority: \`${p.priority}\``).join('\n');
      return `📁 Here are your projects (${result.length}):\n\n${projList}`;

    // ── MEETINGS ────────────────────────────────────────────
    case 'createMeeting':
      return `📅 Meeting **${result.title}** scheduled successfully!\n\n- **Date**: ${formatDate(result.startDate)}\n- **Time**: ${result.time || 'TBD'}\n- **Location**: ${result.location || 'N/A'}`;

    case 'updateMeeting':
      return `📅 Meeting **${result.title}** updated successfully.`;

    case 'deleteMeeting':
      return `🗑️ Meeting has been deleted successfully.`;

    case 'getMeetings':
      if (!Array.isArray(result) || result.length === 0) {
        return `📅 No upcoming meetings found.`;
      }
      const mtgList = result.map((m) => `- 📅 **${m.title}** | Date: ${formatDate(m.startDate)} | Time: \`${m.time || 'N/A'}\``).join('\n');
      return `📅 Upcoming Meetings (${result.length}):\n\n${mtgList}`;

    // ── FOLLOW-UPS ──────────────────────────────────────────
    case 'createFollowUp':
      return `📞 Follow-up with **${result.personName || result.subject}** regarding **${result.subject}** created!\n\n- **Date**: ${formatDate(result.nextFollowupDate)}\n- **Priority**: ${result.priority || 'Medium'}\n- **Status**: ${result.status || 'Pending'}`;

    case 'updateFollowUp':
      return `📞 Follow-up updated successfully.`;

    case 'deleteFollowUp':
      return `🗑️ Follow-up deleted successfully.`;

    case 'getFollowUps':
      if (!Array.isArray(result) || result.length === 0) {
        return `📞 No pending follow-ups found.`;
      }
      const fuList = result.map((f) => `- 📞 **${f.personName || f.subject}** (${f.subject}) | Due: ${formatDate(f.nextFollowupDate)}`).join('\n');
      return `📞 Pending Follow-ups (${result.length}):\n\n${fuList}`;

    // ── KNOWLEDGE ───────────────────────────────────────────
    case 'createKnowledge':
      return `📚 Knowledge item **${result.title}** saved to your Knowledge Base!`;

    case 'updateKnowledge':
      return `📚 Knowledge entry updated successfully.`;

    case 'deleteKnowledge':
      return `🗑️ Knowledge entry deleted successfully.`;

    case 'searchKnowledge':
    case 'getKnowledge':
      if (Array.isArray(result)) {
        if (result.length === 0) return `📚 No knowledge base entries found matching your query.`;
        const knList = result.map((k) => `- 📚 **${k.title}** | Category: \`${k.category || 'General'}\``).join('\n');
        return `📚 Knowledge Search Results (${result.length}):\n\n${knList}`;
      }
      return `📚 **${result.title}**\n\n${result.content || 'No detailed content.'}`;

    // ── WORK LOGS ───────────────────────────────────────────
    case 'createWorkLog':
      const hrs = result.durationMinutes ? (result.durationMinutes / 60).toFixed(1) : '1';
      return `⏱️ Logged **${hrs} hours** of work for **${result.title}**!`;

    case 'updateWorkLog':
      return `⏱️ Work log updated successfully.`;

    case 'deleteWorkLog':
      return `🗑️ Work log deleted successfully.`;

    case 'getWorkLogs':
      if (!Array.isArray(result) || result.length === 0) {
        return `⏱️ No work logs found for the selected period.`;
      }
      const wlList = result.map((w) => `- ⏱️ **${w.title}** (${(w.durationMinutes / 60).toFixed(1)} hrs) | Date: ${formatDate(w.activityDate)}`).join('\n');
      return `⏱️ Work Logs (${result.length}):\n\n${wlList}`;

    // ── DASHBOARD ───────────────────────────────────────────
    case 'getDashboardStats':
      return `📊 **DPS Executive Dashboard Summary**\n\n` +
        `- 📋 **Open Tasks**: ${result.openTasks || 0}\n` +
        `- 🎯 **Active Goals**: ${result.activeGoals || 0}\n` +
        `- 📁 **In-Progress Projects**: ${result.inProgressProjects || 0}\n` +
        `- 📞 **Pending Follow-ups**: ${result.pendingFollowups || 0}\n` +
        `- 📅 **Upcoming Meetings**: ${result.upcomingMeetings || 0}\n` +
        `- ⏱️ **Total Work Logs Recorded**: ${result.totalWorkLogs || 0}`;

    // ── CALENDAR ────────────────────────────────────────────
    case 'getCalendarEvents':
      if (!Array.isArray(result) || result.length === 0) {
        return `🗓️ No calendar events found for the requested timeframe.`;
      }
      const calList = result.map((e) => `- 🗓️ **${e.title}** (${e.type}) | Date: ${formatDate(e.startDate)}`).join('\n');
      return `🗓️ Calendar Events (${result.length}):\n\n${calList}`;

    default:
      return `✅ Operation **${toolName}** completed successfully.`;
  }
}

// ============================================================
//  MAIN RESPONSE GENERATOR API
// ============================================================

/**
 * Formats a Tool Execution result or error into a natural language response payload.
 *
 * @param {object} params
 * @param {object} params.toolResult - Standardized object returned by toolExecutor or functionCalling.
 * @param {string} [params.originalPrompt=''] - Original prompt sent by the user.
 * @param {Array} [params.conversationHistory=[]] - Conversation context array.
 * @returns {ResponseGeneratorResult}
 *
 * @typedef {object} ResponseGeneratorResult
 * @property {string} reply - Natural language Markdown string response.
 * @property {string[]} suggestions - Array of 2-3 intelligent follow-up suggestions.
 * @property {string} status - 'success' | 'error' | 'missing_params'
 */
export function generateResponse({ toolResult, originalPrompt = '', conversationHistory = [] }) {
  const isUrdu = isRomanUrdu(originalPrompt);

  // 1. Missing Required Parameters
  if (toolResult.missingParameters && toolResult.missingParameters.length > 0) {
    const missingStr = toolResult.missingParameters.join(', ');
    const reply = isUrdu
      ? `Aap ka shukriya! Lekin is action ke liye mujhe ye jankari chahiye: **${missingStr}**.\n\nAap isey kya naam ya value dena chahein gey?`
      : `I can help with that! However, I still need the following required detail(s): **${missingStr}**.\n\nWhat would you like to specify?`;

    return {
      reply,
      suggestions: ['Provide required details', 'Cancel operation'],
      status: 'missing_params',
    };
  }

  // 2. Unknown Tool
  if (toolResult.error && toolResult.error.includes('Unknown tool')) {
    const reply = isUrdu
      ? `Maaf kijiyega, main abhi ye operation support nahi karta.`
      : `I don't currently support that operation.`;

    return {
      reply,
      suggestions: ['Show available tools', 'Show dashboard summary'],
      status: 'error',
    };
  }

  // 3. Execution Failure (BUG #5: Natural failure verification without JSON/stack traces)
  if (toolResult.success === false) {
    const errorDetail = toolResult.error || 'An unexpected execution error occurred.';
    
    // Clean error message - remove any JSON-like content or stack traces
    const cleanError = errorDetail
      .replace(/\{[^}]*\}/g, '[details hidden]') // Remove JSON objects
      .replace(/\[.*?\]/g, '[details hidden]') // Remove arrays
      .replace(/at\s+.*?\.js:\d+:\d+/g, '') // Remove stack traces
      .replace(/Error:\s*/gi, '')
      .trim();
    
    const reply = isUrdu
      ? `⚠️ Maaf kijiyega, main ye action poora nahi kar saka: ${cleanError}`
      : `⚠️ Sorry, I couldn't complete that request.\n\n**Reason**: ${cleanError}`;

    return {
      reply,
      suggestions: ['Try again', 'Show dashboard summary'],
      status: 'error',
    };
  }

  // 4. Execution Success
  const toolName = toolResult.tool || 'operation';
  const reply = formatToolSuccessResult(toolName, toolResult.result || {}, isUrdu);
  const suggestions = generateSuggestions(toolName, true);

  return {
    reply,
    suggestions,
    status: 'success',
  };
}

export { isRomanUrdu };
export const responseGenerator = {
  generateResponse,
  isRomanUrdu,
};

export default responseGenerator;
