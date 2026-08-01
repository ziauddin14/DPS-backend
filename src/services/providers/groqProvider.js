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
    console.log('[groqProvider] === GROQ GENERATE START ===');
    console.log('[groqProvider] Input params:', JSON.stringify({
      message: message?.substring(0, 100),
      conversationHistoryLength: conversationHistory?.length || 0,
      conversationId,
    }));
    
    const startTime = Date.now();
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const model = process.env.GROQ_MODEL?.trim() || 'llama-3.3-70b-versatile';
    
    console.log('[groqProvider] Step 1: Check API key');
    console.log('[groqProvider] API key present:', !!apiKey);
    console.log('[groqProvider] API key length:', apiKey?.length || 0);
    console.log('[groqProvider] Model:', model);

    if (!apiKey || apiKey === 'your_groq_api_key_here' || apiKey.length < 10) {
      console.log('[groqProvider] API key validation failed');
      const error = new Error('Groq API key is missing or unconfigured.');
      error.statusCode = 503;
      throw error;
    }
    console.log('[groqProvider] API key validation passed');

    try {
      console.log('[groqProvider] Step 2: Create Groq client');
      const client = new Groq({ apiKey });
      console.log('[groqProvider] Groq client created');

      // Build messages array (OpenAI-compatible format)
      console.log('[groqProvider] Step 3: Build messages array');
      const messages = [{ role: 'system', content: DPS_SYSTEM_PROMPT }];
      console.log('[groqProvider] System prompt length:', DPS_SYSTEM_PROMPT.length);

      (conversationHistory || []).forEach((msg) => {
        if (!msg.text) return;
        const role = msg.sender === 'user' ? 'user' : 'assistant';
        messages.push({ role, content: msg.text });
      });
      console.log('[groqProvider] Conversation history messages added:', messages.length - 1);

      // Append current user message
      messages.push({ role: 'user', content: message });
      console.log('[groqProvider] Total messages:', messages.length);

      // Build tool schemas from Tool Registry
      console.log('[groqProvider] Step 4: Build tool schemas');
      const tools = buildGroqToolSchemas();
      console.log('[groqProvider] Number of tools:', tools.length);
      console.log('[groqProvider] Tool names:', tools.map(t => t.function.name).join(', '));

      // First completion: Let Groq decide if it needs to call tools
      console.log('[groqProvider] Step 5: First completion (tool selection)');
      console.log('[groqProvider] Calling Groq API with tools and tool_choice: auto');
      const response = await client.chat.completions.create({
        model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature: AI_CONFIG.temperature ?? 0.2,
        max_tokens: AI_CONFIG.max_tokens ?? 1024,
      });
      console.log('[groqProvider] First completion response received');
      console.log('[groqProvider] Response model:', response.model);
      console.log('[groqProvider] Response usage:', JSON.stringify(response.usage));

      const choice = response.choices?.[0];
      const finishReason = choice?.finish_reason;
      console.log('[groqProvider] Finish reason:', finishReason);
      console.log('[groqProvider] Tool calls present:', !!choice?.message?.tool_calls);
      console.log('[groqProvider] Number of tool calls:', choice?.message?.tool_calls?.length || 0);

      // Case 1: No tool calls - return normal chat response
      if (finishReason !== 'tool_calls' || !choice?.message?.tool_calls || choice.message.tool_calls.length === 0) {
        console.log('[groqProvider] Case 1: No tool calls, returning normal chat response');
        const rawContent = choice?.message?.content || 'No response generated.';
        console.log('[groqProvider] Raw content length:', rawContent.length);
        const cleanedReply = cleanAIResponse(rawContent);
        const responseTime = Date.now() - startTime;
        const usage = response.usage || {};

        const result = {
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
        console.log('[groqProvider] Returning normal chat response');
        console.log('[groqProvider] === GROQ GENERATE END ===');
        return result;
      }

      // Case 2: Tool calls exist - execute tools and get final response
      console.log('[groqProvider] Case 2: Tool calls exist, executing tools');
      const toolCalls = choice.message.tool_calls;
      const toolResults = [];
      const toolNames = [];
      console.log('[groqProvider] Processing', toolCalls.length, 'tool call(s)');

      // Execute each tool call
      for (const toolCall of toolCalls) {
        console.log('[groqProvider] Processing tool call:', toolCall.id);
        const toolName = toolCall.function.name;
        toolNames.push(toolName);
        console.log('[groqProvider] Tool name:', toolName);
        console.log('[groqProvider] Tool arguments:', toolCall.function.arguments);

        let parsedArgs = {};
        try {
          parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
          console.log('[groqProvider] Parsed arguments:', JSON.stringify(parsedArgs));
        } catch (e) {
          console.log('[groqProvider] Failed to parse arguments, using empty object');
          parsedArgs = {};
        }

        // Execute the tool through Tool Executor
        console.log('[groqProvider] Calling toolExecutor.executeTool');
        const executionResult = await executeTool({
          tool: toolName,
          parameters: parsedArgs,
          conversationId,
        });
        console.log('[groqProvider] Tool execution result:', JSON.stringify({
          success: executionResult.success,
          tool: executionResult.tool,
        }));

        // Format tool result for Groq
        toolResults.push({
          tool_call_id: toolCall.id,
          role: 'tool',
          content: JSON.stringify(executionResult),
        });
      }
      console.log('[groqProvider] All tool calls executed');

      // Build messages for second completion
      console.log('[groqProvider] Step 6: Build messages for second completion');
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
      console.log('[groqProvider] Second messages total:', secondMessages.length);

      // Second completion: Get final natural language response
      console.log('[groqProvider] Step 7: Second completion (final response)');
      console.log('[groqProvider] Calling Groq API for final response');
      const secondResponse = await client.chat.completions.create({
        model,
        messages: secondMessages,
        temperature: AI_CONFIG.temperature ?? 0.7,
        max_tokens: AI_CONFIG.max_tokens ?? 1024,
      });
      console.log('[groqProvider] Second completion response received');
      console.log('[groqProvider] Second response usage:', JSON.stringify(secondResponse.usage));

      const secondChoice = secondResponse.choices?.[0];
      const rawContent = secondChoice?.message?.content || 'No response generated.';
      console.log('[groqProvider] Raw content length:', rawContent.length);
      const cleanedReply = cleanAIResponse(rawContent);
      const responseTime = Date.now() - startTime;

      const firstUsage = response.usage || {};
      const secondUsage = secondResponse.usage || {};

      const result = {
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
      console.log('[groqProvider] Returning final response with tool calls');
      console.log('[groqProvider] === GROQ GENERATE END ===');
      return result;
    } catch (err) {
      console.error('[groqProvider] === GROQ GENERATE ERROR ===');
      console.error('[groqProvider] Error name:', err.name);
      console.error('[groqProvider] Error message:', err.message);
      console.error('[groqProvider] Error stack:', err.stack);
      console.error('[groqProvider] Error status:', err.status);
      console.error('[groqProvider] Error code:', err.code);
      console.error('[groqProvider] Full error object:', JSON.stringify(err, Object.getOwnPropertyNames(err)));

      if (err.code === 'ETIMEDOUT' || err.status === 408) {
        console.error('[groqProvider] Timeout error detected');
        const error = new Error('AI request timed out. Please try again.');
        error.statusCode = 503;
        throw error;
      }

      if (err.status === 429) {
        console.error('[groqProvider] Rate limit error detected');
        const error = new Error('AI rate limit reached. Please wait a moment and try again.');
        error.statusCode = 429;
        throw error;
      }

      if (err.status === 401 || err.status === 403) {
        console.error('[groqProvider] Authentication error detected');
        const error = new Error('AI service is currently unavailable. Please verify API configuration.');
        error.statusCode = 503;
        throw error;
      }

      console.error('[groqProvider] Generic error, converting to 500/503');
      const error = new Error('Internal server error occurred while processing AI request with Groq.');
      error.statusCode = err.status || 500;
      throw error;
    }
  },
};

export default groqProvider;
