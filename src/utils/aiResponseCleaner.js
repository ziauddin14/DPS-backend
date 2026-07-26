/**
 * AI Response Cleaner Utility — Normalizes markdown formatting, cleans whitespace,
 * ensures structural validity, and redacts system prompt/secret leaks.
 */

/**
 * Sanitizes and cleans raw AI model output string.
 *
 * @param {string} rawText - Unprocessed output text from model completion.
 * @returns {string} Cleaned, valid markdown string.
 */
export function cleanAIResponse(rawText) {
  if (!rawText || typeof rawText !== 'string') return '';

  let cleaned = rawText.trim();

  // 1. Redact any accidental system prompt or secret leaks
  cleaned = cleaned.replace(/(?:sk-[a-zA-Z0-9]{20,})|(?:OPENAI_API_KEY=[^\s]+)/gi, '[REDACTED_SECRET]');
  cleaned = cleaned.replace(/You are DPS AI Secretary[^\n]*/gi, '');

  // 2. Normalize consecutive blank lines (max 2 newlines)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');

  // 3. Normalize unordered bullet list indentation and dashes
  cleaned = cleaned.replace(/^[ \t]*[•◦▪*][ \t]+/gm, '- ');

  // 4. Ensure headers have a space after '#' (e.g. '###Header' -> '### Header')
  cleaned = cleaned.replace(/^(#{1,6})([^\s#])/gm, '$1 $2');

  // 5. Final whitespace trimming
  return cleaned.trim();
}

export default cleanAIResponse;
