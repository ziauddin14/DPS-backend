import OpenAI from 'openai';
import { DPS_SYSTEM_PROMPT } from '../../config/aiSystemPrompt.js';
import { AI_CONFIG } from '../../config/aiConfig.js';
import { cleanAIResponse } from '../../utils/aiResponseCleaner.js';

/**
 * OpenAI Provider Adapter for DPS AI Infrastructure.
 */
export const openaiProvider = {
  name: 'openai',

  /**
   * Generates response using OpenAI API.
   *
   * @param {Object} params - { message: string, conversationHistory?: Array }
   * @returns {Promise<{ reply: string, model: string, usage: Object, responseTime: number, finishReason: string, provider: string }>}
   */
  generate: async ({ message, conversationHistory = [] }) => {
    const startTime = Date.now();
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const model = AI_CONFIG.model || 'gpt-4o-mini';

    if (!apiKey || apiKey === 'your_openai_api_key_here' || apiKey.length < 10) {
      const error = new Error('OpenAI API key is missing or unconfigured.');
      error.statusCode = 503;
      throw error;
    }

    try {
      const openai = new OpenAI({
        apiKey,
        timeout: AI_CONFIG.timeoutMs,
      });

      const systemPromptMessage = {
        role: 'system',
        content: DPS_SYSTEM_PROMPT,
      };

      const historyMessages = (conversationHistory || [])
        .filter((msg) => msg.text && (msg.sender === 'user' || msg.sender === 'assistant' || msg.sender === 'ai'))
        .map((msg) => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.text,
        }));

      const userPromptMessage = { role: 'user', content: message };
      const messages = [systemPromptMessage, ...historyMessages, userPromptMessage];

      const completion = await openai.chat.completions.create({
        model,
        messages,
        temperature: AI_CONFIG.temperature,
        top_p: AI_CONFIG.top_p,
        presence_penalty: AI_CONFIG.presence_penalty,
        frequency_penalty: AI_CONFIG.frequency_penalty,
        max_tokens: AI_CONFIG.max_tokens,
      });

      const choice = completion.choices[0];
      const rawContent = choice?.message?.content || 'No response generated.';
      const cleanedReply = cleanAIResponse(rawContent);

      const responseTime = Date.now() - startTime;
      const usageData = completion.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

      return {
        reply: cleanedReply,
        model: completion.model || model,
        usage: {
          promptTokens: usageData.prompt_tokens || 0,
          completionTokens: usageData.completion_tokens || 0,
          totalTokens: usageData.total_tokens || 0,
        },
        responseTime,
        finishReason: choice?.finish_reason || 'stop',
        provider: 'openai',
      };
    } catch (err) {
      console.error('[OpenAIProvider Error]:', err.status || err.name, err.message);

      if (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT' || err.status === 408) {
        const error = new Error('AI request timed out. Please try again.');
        error.statusCode = 503;
        throw error;
      }

      if (err.status === 429 || err.code === 'rate_limit_exceeded') {
        const error = new Error('AI rate limit reached. Please wait a moment and try again.');
        error.statusCode = 429;
        throw error;
      }

      if (err.status === 401 || err.status === 403 || err.code === 'insufficient_quota') {
        const error = new Error('AI service is currently unavailable. Please verify API configuration.');
        error.statusCode = 503;
        throw error;
      }

      const error = new Error('Internal server error occurred while processing AI request with OpenAI.');
      error.statusCode = err.status || 500;
      throw error;
    }
  },
};

export default openaiProvider;
