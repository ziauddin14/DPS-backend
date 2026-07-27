import openaiProvider from './providers/openaiProvider.js';
import groqProvider from './providers/groqProvider.js';
import geminiProvider from './providers/geminiProvider.js';
import { cleanAIResponse } from '../utils/aiResponseCleaner.js';
import { AI_CONFIG } from '../config/aiConfig.js';

/**
 * AI Service — Provider-Agnostic Production AI Engine.
 * Automatically selects AI Provider according to key availability:
 *   1. OpenAI  (if OPENAI_API_KEY is configured)
 *   2. Groq    (if GROQ_API_KEY is configured)   ← Primary LLM
 *   3. Gemini  (if GEMINI_API_KEY is configured)
 *   4. Mock    (fallback when no API keys are configured)
 */
export const aiService = {
  /**
   * Generates a sanitized AI response using active provider with usage metadata and performance logging.
   *
   * @param {Object} params - { message: string, conversationHistory?: Array }
   * @returns {Promise<{ reply: string, model: string, usage: Object, responseTime: number, finishReason: string, isMock: boolean, provider: string }>}
   */
  generateResponse: async ({ message, conversationHistory = [] }) => {
    const startTime = Date.now();

    const openAiKey = process.env.OPENAI_API_KEY?.trim();
    const groqKey   = process.env.GROQ_API_KEY?.trim();
    const geminiKey = process.env.GEMINI_API_KEY?.trim();

    const hasOpenAi = Boolean(openAiKey && openAiKey !== 'your_openai_api_key_here' && openAiKey.length > 10);
    const hasGroq   = Boolean(groqKey   && groqKey   !== 'your_groq_api_key_here'   && groqKey.length   > 10);
    const hasGemini = Boolean(geminiKey && geminiKey !== 'your_gemini_api_key_here' && geminiKey.length > 10);

    // 1. OpenAI Provider Selection
    if (hasOpenAi) {
      const res = await openaiProvider.generate({ message, conversationHistory });
      console.log(`[aiService] Provider: ${res.provider} | Model: ${res.model} | Duration: ${res.responseTime}ms | Tokens: ${res.usage.totalTokens}`);
      return { ...res, isMock: false };
    }

    // 2. Groq Provider Selection (primary LLM — fast, free tier available)
    if (hasGroq) {
      const res = await groqProvider.generate({ message, conversationHistory });
      console.log(`[aiService] Provider: ${res.provider} | Model: ${res.model} | Duration: ${res.responseTime}ms | Tokens: ${res.usage.totalTokens}`);
      return { ...res, isMock: false };
    }

    // 3. Gemini Provider Selection
    if (hasGemini) {
      const res = await geminiProvider.generate({ message, conversationHistory });
      console.log(`[aiService] Provider: ${res.provider} | Model: ${res.model} | Duration: ${res.responseTime}ms | Tokens: ${res.usage.totalTokens}`);
      return { ...res, isMock: false };
    }

    // 4. Fallback Mock Response when no keys are configured
    const defaultModel = AI_CONFIG.model || 'gpt-4o-mini';
    const mockContent = `Hello! I'm your **DPS AI Secretary**.\n\nI can assist you with:\n- **Task Management**: Creating, updating, and filtering your daily tasks.\n- **Follow-ups & Meetings**: Scheduling reminders and tracking communications.\n- **Projects & Work Logs**: Structuring progress and logging hours.\n\nFor now this is the AI infrastructure foundation. You asked: "${message}"`;
    const cleanedReply = cleanAIResponse(mockContent);
    const responseTime = Date.now() - startTime;

    const mockResult = {
      reply: cleanedReply,
      model: `${defaultModel} (mock)`,
      usage: {
        promptTokens: message.length,
        completionTokens: 60,
        totalTokens: message.length + 60,
      },
      responseTime,
      finishReason: 'stop',
      isMock: true,
      provider: 'mock',
    };

    console.log(`[aiService] Provider: mock | Model: ${mockResult.model} | Duration: ${mockResult.responseTime}ms`);
    return mockResult;
  },
};

export default aiService;
