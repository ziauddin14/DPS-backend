/**
 * AI Service Parameters & Configuration
 * Exports standardized parameter controls for OpenAI provider requests.
 */

export const AI_CONFIG = {
  model: process.env.OPENAI_MODEL?.trim() || 'gpt-4o-mini',
  temperature: 0.4,
  top_p: 1,
  presence_penalty: 0,
  frequency_penalty: 0,
  max_tokens: 1200,
  timeoutMs: 20000, // 20-second timeout threshold
};

export default AI_CONFIG;
