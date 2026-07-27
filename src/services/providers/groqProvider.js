import Groq from 'groq-sdk';
import { DPS_SYSTEM_PROMPT } from '../../config/aiSystemPrompt.js';
import { AI_CONFIG } from '../../config/aiConfig.js';
import { cleanAIResponse } from '../../utils/aiResponseCleaner.js';

/**
 * Groq AI Provider Adapter for DPS AI Infrastructure.
 * Uses official groq-sdk. Provider-agnostic interface — mirrors openaiProvider & geminiProvider.
 */
export const groqProvider = {
  name: 'groq',

  /**
   * Generates response using Groq API (OpenAI-compatible).
   *
   * @param {Object} params - { message: string, conversationHistory?: Array }
   * @returns {Promise<{ reply: string, model: string, usage: Object, responseTime: number, finishReason: string, provider: string }>}
   */
  generate: async ({ message, conversationHistory = [] }) => {
    const startTime = Date.now();
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';

    if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey.length < 10) {
      const error = new Error('Groq API key is missing or unconfigured.');
      error.statusCode = 503;
      throw error;
    }

    try {
      const client = new Groq({ apiKey });

      // Build messages array (OpenAI-compatible format)
      const messages = [{ role: 'system', content: DPS_SYSTEM_PROMPT }];

      (conversationHistory || []).forEach((msg) => {
        if (!msg.text) return;
        const role = msg.sender === 'user' ? 'user' : 'assistant';
        messages.push({ role, content: msg.text });
      });

      // Append current user message
      messages.push({ role: 'user', content: message });

      // Call Groq API
      const response = await client.chat.completions.create({
        model,
        messages,
        temperature: AI_CONFIG.temperature ?? 0.7,
        max_tokens: AI_CONFIG.max_tokens ?? 1024,
      });

      const choice = response.choices?.[0];
      const rawContent = choice?.message?.content || 'No response generated.';
      const cleanedReply = cleanAIResponse(rawContent);
      const responseTime = Date.now() - startTime;

      const usage = response.usage || {};

      return {
        reply: cleanedReply,
        model: response.model || model,
        usage: {
          promptTokens: usage.prompt_tokens || message.length,
          completionTokens: usage.completion_tokens || Math.round(cleanedReply.length / 4),
          totalTokens: usage.total_tokens || message.length + Math.round(cleanedReply.length / 4),
        },
        responseTime,
        finishReason: choice?.finish_reason || 'stop',
        provider: 'groq',
      };
    } catch (err) {
      console.error('[GroqProvider Error]:', err.status || err.name, err.message);

      if (err.code === 'ETIMEDOUT' || err.status === 408) {
        const error = new Error('AI request timed out. Please try again.');
        error.statusCode = 503;
        throw error;
      }

      if (err.status === 429) {
        const error = new Error('AI rate limit reached. Please wait a moment and try again.');
        error.statusCode = 429;
        throw error;
      }

      if (err.status === 401 || err.status === 403) {
        const error = new Error('AI service is currently unavailable. Please verify API configuration.');
        error.statusCode = 503;
        throw error;
      }

      const error = new Error('Internal server error occurred while processing AI request with Groq.');
      error.statusCode = err.status || 500;
      throw error;
    }
  },
};

export default groqProvider;
