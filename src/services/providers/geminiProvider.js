import { GoogleGenAI } from '@google/genai';
import { DPS_SYSTEM_PROMPT } from '../../config/aiSystemPrompt.js';
import { AI_CONFIG } from '../../config/aiConfig.js';
import { cleanAIResponse } from '../../utils/aiResponseCleaner.js';

/**
 * Google Gemini Provider Adapter for DPS AI Infrastructure.
 * Uses official @google/genai SDK.
 */
export const geminiProvider = {
  name: 'gemini',

  /**
   * Generates response using Google Gemini API.
   *
   * @param {Object} params - { message: string, conversationHistory?: Array }
   * @returns {Promise<{ reply: string, model: string, usage: Object, responseTime: number, finishReason: string, provider: string }>}
   */
  generate: async ({ message, conversationHistory = [] }) => {
    const startTime = Date.now();
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    // Default model fallback if model is empty or OpenAI default
    let model = process.env.GEMINI_MODEL?.trim() || AI_CONFIG.model;
    if (!model || model.startsWith('gpt-')) {
      model = 'gemini-2.5-flash';
    }

    if (!apiKey || apiKey === 'your_gemini_api_key_here' || apiKey.length < 10) {
      const error = new Error('Gemini API key is missing or unconfigured.');
      error.statusCode = 503;
      throw error;
    }

    try {
      const ai = new GoogleGenAI({ apiKey });

      // Map conversation history into Gemini format (roles: 'user' | 'model')
      const contents = [];

      (conversationHistory || []).forEach((msg) => {
        if (!msg.text) return;
        const role = msg.sender === 'user' ? 'user' : 'model';
        contents.push({
          role,
          parts: [{ text: msg.text }],
        });
      });

      // Append current user message
      contents.push({
        role: 'user',
        parts: [{ text: message }],
      });

      // Call Gemini API
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: DPS_SYSTEM_PROMPT,
          temperature: AI_CONFIG.temperature,
          maxOutputTokens: AI_CONFIG.max_tokens,
        },
      });

      const rawContent = response?.text || 'No response generated.';
      const cleanedReply = cleanAIResponse(rawContent);
      const responseTime = Date.now() - startTime;

      // Normalize usage metadata
      const meta = response?.usageMetadata || {};
      const promptTokens = meta.promptTokenCount || message.length;
      const completionTokens = meta.candidatesTokenCount || cleanedReply.length / 4;
      const totalTokens = meta.totalTokenCount || promptTokens + completionTokens;

      return {
        reply: cleanedReply,
        model: model,
        usage: {
          promptTokens: Math.round(promptTokens),
          completionTokens: Math.round(completionTokens),
          totalTokens: Math.round(totalTokens),
        },
        responseTime,
        finishReason: 'stop',
        provider: 'gemini',
      };
    } catch (err) {
      console.error('[GeminiProvider Error]:', err.status || err.name, err.message);

      if (err.name === 'APIConnectionTimeoutError' || err.code === 'ETIMEDOUT' || err.status === 408) {
        const error = new Error('AI request timed out. Please try again.');
        error.statusCode = 503;
        throw error;
      }

      if (err.status === 429 || err.code === 'RESOURCE_EXHAUSTED' || err.message?.includes('429')) {
        const error = new Error('AI rate limit reached. Please wait a moment and try again.');
        error.statusCode = 429;
        throw error;
      }

      if (err.status === 401 || err.status === 403 || err.message?.includes('API key') || err.message?.includes('INVALID_ARGUMENT')) {
        const error = new Error('AI service is currently unavailable. Please verify API configuration.');
        error.statusCode = 503;
        throw error;
      }

      const error = new Error('Internal server error occurred while processing AI request with Gemini.');
      error.statusCode = err.status || 500;
      throw error;
    }
  },
};
export default geminiProvider;
