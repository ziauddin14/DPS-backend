/**
 * DPS AI Confirmation Manager Service
 *
 * Manages confirmation state before executing destructive or irreversible operations
 * (e.g. deleteTask, deleteProject, deleteGoal, deleteMeeting, deleteFollowUp, deleteKnowledge, deleteWorkLog).
 *
 * Expiration: 5 minutes (300,000 ms).
 */

const CONFIRMATION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// In-memory store: conversationId -> PendingConfirmation
const pendingConfirmations = new Map();

// Destructive tools requiring explicit confirmation
const DESTRUCTIVE_TOOLS = new Set([
  'deleteTask',
  'deleteProject',
  'deleteGoal',
  'deleteMeeting',
  'deleteFollowUp',
  'deleteKnowledge',
  'deleteWorkLog',
  'bulkDelete',
  'bulkUpdate',
  'bulkComplete',
]);

// Affirmative and cancellation keyword sets
const AFFIRMATIVE_KEYWORDS = ['yes', 'y', 'confirm', 'proceed', 'ok', 'okay', 'haan', 'ha', 'kardo', 'kardo ji', 'sure'];
const CANCEL_KEYWORDS = ['no', 'n', 'cancel', 'stop', 'never mind', 'nevermind', 'na', 'nahi', 'rrehno', 'abort'];

/**
 * Check if a tool requires user confirmation prior to execution.
 * @param {string} toolName
 * @returns {boolean}
 */
export function requiresConfirmation(toolName) {
  if (!toolName) return false;
  return DESTRUCTIVE_TOOLS.has(toolName);
}

/**
 * Request a confirmation for a pending destructive tool action.
 *
 * @param {object} params
 * @param {string} params.conversationId - Conversation context ID.
 * @param {string} params.tool - Tool name (e.g. 'deleteTask').
 * @param {object} [params.parameters={}] - Target parameters.
 * @returns {object} Standardized confirmation request payload.
 */
export function requestConfirmation({ conversationId, tool, parameters = {} }) {
  const convKey = conversationId || 'global-default';

  const entry = {
    conversationId: convKey,
    tool,
    parameters,
    timestamp: Date.now(),
    expiresAt: Date.now() + CONFIRMATION_TIMEOUT_MS,
  };

  pendingConfirmations.set(convKey, entry);

  const targetIdentifier = parameters.id ? `\`${parameters.id}\`` : JSON.stringify(parameters);

  const prompt = `⚠️ **Confirmation Required**\n\nYou are about to permanently execute **${tool}** on item ${targetIdentifier}.\n\nThis action cannot be undone. Reply **YES** or **CONFIRM** to proceed, or **CANCEL** to abort.`;

  return {
    requiresConfirmation: true,
    tool,
    parameters,
    prompt,
    expiresAt: entry.expiresAt,
  };
}

/**
 * Inspect user message for confirmation or cancellation of a pending action.
 *
 * @param {object} params
 * @param {string} params.conversationId - Conversation ID.
 * @param {string} params.userMessage - Latest message sent by user.
 * @returns {object} { isConfirmed: boolean, isCancelled: boolean, pendingAction?: object, message?: string }
 */
export function checkConfirmationResponse({ conversationId, userMessage = '' }) {
  const convKey = conversationId || 'global-default';
  const entry = pendingConfirmations.get(convKey);

  if (!entry) {
    return { isConfirmed: false, isCancelled: false };
  }

  // Expiration check (5 minutes)
  if (Date.now() > entry.expiresAt) {
    pendingConfirmations.delete(convKey);
    return {
      isConfirmed: false,
      isCancelled: false,
      isExpired: true,
      message: 'Pending confirmation expired. Please request the operation again.',
    };
  }

  const cleanMsg = userMessage.toLowerCase().trim().replace(/[^\w\s]/g, '');

  // Check Affirmative
  if (AFFIRMATIVE_KEYWORDS.includes(cleanMsg)) {
    pendingConfirmations.delete(convKey);
    return {
      isConfirmed: true,
      isCancelled: false,
      pendingAction: {
        tool: entry.tool,
        parameters: entry.parameters,
      },
    };
  }

  // Check Cancel
  if (CANCEL_KEYWORDS.includes(cleanMsg)) {
    pendingConfirmations.delete(convKey);
    return {
      isConfirmed: false,
      isCancelled: true,
      message: `🚫 Action **${entry.tool}** was cancelled. No changes were made.`,
    };
  }

  // Unrelated message while confirmation is pending -> Clear pending action cleanly
  pendingConfirmations.delete(convKey);
  return { isConfirmed: false, isCancelled: false };
}

/**
 * Clear any active pending confirmation for a conversation.
 * @param {string} conversationId
 */
export function clearPendingConfirmation(conversationId) {
  const convKey = conversationId || 'global-default';
  pendingConfirmations.delete(convKey);
}

/**
 * Get all active pending confirmations.
 * @returns {Array<object>}
 */
export function getPendingConfirmations() {
  const active = [];
  const now = Date.now();
  for (const [key, entry] of pendingConfirmations.entries()) {
    if (now <= entry.expiresAt) {
      active.push(entry);
    }
  }
  return active;
}

export const confirmationManager = {
  requiresConfirmation,
  requestConfirmation,
  checkConfirmationResponse,
  clearPendingConfirmation,
  getPendingConfirmations,
};

export default confirmationManager;
