import Groq from 'groq-sdk';
import { DPS_SYSTEM_PROMPT } from '../../config/aiSystemPrompt.js';
import { AI_CONFIG } from '../../config/aiConfig.js';
import { cleanAIResponse } from '../../utils/aiResponseCleaner.js';
import { getAllTools } from '../../tools/toolRegistry.js';
import { executeTool } from '../toolExecutor.js';

// ============================================================
//  TOOL SCHEMA BUILDER
//  Converts Tool Registry definitions → Groq/OpenAI function_call schema
// ============================================================

/**
 * Transform a single tool registry entry into a Groq/OpenAI-compatible function definition.
 * @param {object} tool - Tool definition from toolRegistry.
 * @returns {object} Groq/OpenAI function schema object.
 */
function buildGroqFunctionSchema(tool) {
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
 * Build the full Groq tools array from the Tool Registry dynamically.
 * @returns {Array<object>} Array of Groq function schemas.
 */
function buildGroqToolSchemas() {
  return getAllTools().map(buildGroqFunctionSchema);
}

// ============================================================
//  GROQ AI PROVIDER WITH NATIVE FUNCTION CALLING
// ============================================================

/**
 * Groq AI Provider Adapter for DPS AI Infrastructure.
 * Uses official groq-sdk with native function calling support.
 * Provider-agnostic interface — mirrors openaiProvider & geminiProvider.
 */
export const groqProvider = {
  name: 'groq',

  /**
   * Generates response using Groq API with native function calling.
   *
   * @param {Object} params - { message: string, conversationHistory?: Array, conversationId?: string }
   * @returns {Promise<{ reply: string, model: string, usage: Object, responseTime: number, finishReason: string, provider: string, toolUsed?: string }>}
   */
  generate: async ({ message, conversationHistory = [], conversationId = null }) => {
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

      // Build tool schemas from Tool Registry
      const tools = buildGroqToolSchemas();

      // First completion: Let Groq decide if it needs to call tools
      const response = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: AI_CONFIG.temperature ?? 0.2,
        max_tokens: AI_CONFIG.max_tokens ?? 1024,
      });

      const choice = response.choices?.[0];
      const finishReason = choice?.finish_reason;

      // Case 1: No tool calls - return normal chat response
      if (finishReason !== 'tool_calls' || !choice?.message?.tool_calls || choice.message.tool_calls.length === 0) {
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
          finishReason: finishReason || 'stop',
          provider: 'groq',
        };
      }

      // Case 2: Tool calls exist - execute tools and get final response
      const toolCalls = choice.message.tool_calls;
      const toolResults = [];
      const toolNames = [];

      // Execute each tool call
      for (const toolCall of toolCalls) {
        const toolName = toolCall.function.name;
        toolNames.push(toolName);

        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
        } catch {
          parsedArgs = {};
        }

        // Execute the tool through Tool Executor
        const executionResult = await executeTool({
          tool: toolName,
          parameters: parsedArgs,
          conversationId,
        });

        // Format tool result for Groq
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(executionResult),
        });
      }

      // Build messages for second completion
      const secondMessages = [...messages];
      secondMessages.push({
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id,
          type: tc.type,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      });
      secondMessages.push(...toolResults);

      // Second completion: Get final natural language response
      const secondResponse = await client.chat.completions.create({
        model,
        messages: secondMessages,
        temperature: AI_CONFIG.temperature ?? 0.7,
        max_tokens: AI_CONFIG.max_tokens ?? 1024,
      });

      const secondChoice = secondResponse.choices?.[0];
      const rawContent = secondChoice?.message?.content || 'No response generated.';
      const cleanedReply = cleanAIResponse(rawContent);
      const responseTime = Date.now() - startTime;

      const firstUsage = response.usage || {};
      const secondUsage = secondResponse.usage || {};

      return {
        reply: cleanedReply,
        model: secondResponse.model || model,
        usage: {
          promptTokens: (firstUsage.prompt_tokens || 0) + (secondUsage.prompt_tokens || 0),
          completionTokens: (firstUsage.completion_tokens || 0) + (secondUsage.completion_tokens || 0),
          totalTokens: (firstUsage.total_tokens || 0) + (secondUsage.total_tokens || 0),
        },
        responseTime,
        finishReason: secondChoice?.finish_reason || 'stop',
        provider: 'groq',
        toolUsed: toolNames.length === 1 ? toolNames[0] : toolNames.join(', '),
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
