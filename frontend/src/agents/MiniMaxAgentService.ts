/**
 * MiniMax Agent Service
 * LLM API integration for agent decision-making
 */

import { AgentConversationStore } from './AgentConversationStore';
import type { AgentName } from './messages';

export interface MiniMaxResponse {
  content: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  latency: number;
}

export interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Configuration
const CONFIG = {
  miniMaxModel: (typeof localStorage !== 'undefined' && localStorage.getItem('minimax_model')) || 'MiniMax-Text-01',
  endpoint: 'https://api.minimaxi.chat/v1/text/chatflow_v2',
  timeout: 30000,
  maxRetries: 3,
  baseDelayMs: 2000,
};

function getApiKey(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem('minimax_api_key');
}

function hasApiKey(): boolean {
  const key = getApiKey();
  return !!(key && key.length > 0);
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseJSONSafely(text: string): Record<string, unknown> | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1];
  }
  try {
    return JSON.parse(text);
  } catch {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

export interface MiniMaxServiceResult {
  success: boolean;
  data?: MiniMaxResponse;
  error?: string;
}

export async function callMiniMaxAgent(
  messages: MiniMaxMessage[],
  options?: { model?: string; sessionId?: string }
): Promise<MiniMaxServiceResult> {
  const apiKey = getApiKey();
  if (!apiKey) {
    return { success: false, error: 'No API key available' };
  }

  const model = options?.model || CONFIG.miniMaxModel;
  const url = `${CONFIG.endpoint}?GroupId=${encodeURIComponent(apiKey)}`;

  const requestBody = { model, messages, stream: false };
  let lastError: string = '';

  for (let attempt = 0; attempt <= CONFIG.maxRetries; attempt++) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONFIG.timeout);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      const latency = Date.now() - startTime;

      const choices = data.choices || data.output || [];
      let content = '';

      if (Array.isArray(choices) && choices.length > 0) {
        const firstChoice = choices[0];
        if (firstChoice.messages && firstChoice.messages.length > 0) {
          content = firstChoice.messages[firstChoice.messages.length - 1]?.content || '';
        } else if (firstChoice.message?.content) {
          content = firstChoice.message.content;
        } else if (typeof firstChoice === 'string') {
          content = firstChoice;
        }
      } else if (data.choices?.[0]?.text) {
        content = data.choices[0].text;
      } else if (data.content) {
        content = data.content;
      } else if (data.text) {
        content = data.text;
      }

      if (!content) {
        throw new Error('Empty response from API');
      }

      return {
        success: true,
        data: {
          content,
          usage: data.usage ? {
            input_tokens: data.usage.input_tokens || 0,
            output_tokens: data.usage.output_tokens || 0,
          } : undefined,
          latency,
        },
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      if (err instanceof Error && err.name === 'AbortError') {
        return { success: false, error: `Request timeout after ${CONFIG.timeout}ms` };
      }
      if (attempt >= CONFIG.maxRetries) {
        return { success: false, error: `Max retries exceeded: ${lastError}` };
      }
      const delay = CONFIG.baseDelayMs * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  return { success: false, error: lastError };
}

export async function callWithJSONPrompt<T>(
  systemPrompt: string,
  userMessage: string,
  options?: { model?: string; sessionId?: string; agentName?: AgentName }
): Promise<{ success: boolean; data?: T; error?: string }> {
  const messages: MiniMaxMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const result = await callMiniMaxAgent(messages, options);
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  // Track conversation turn if sessionId and agentName are provided
  if (options?.sessionId && options?.agentName) {
    const tokens = result.data.usage ? {
      input: result.data.usage.input_tokens,
      output: result.data.usage.output_tokens,
    } : undefined;
    // Add conversation turns: system, user, assistant
    AgentConversationStore.addTurn(options.sessionId, options.agentName, 'system', systemPrompt);
    AgentConversationStore.addTurn(options.sessionId, options.agentName, 'user', userMessage);
    AgentConversationStore.addTurn(options.sessionId, options.agentName, 'assistant', result.data.content, tokens);
  }

  const parsed = parseJSONSafely(result.data.content);
  if (!parsed) {
    return {
      success: false,
      error: `Failed to parse JSON response: ${result.data.content.slice(0, 200)}`,
    };
  }

  return { success: true, data: parsed as T };
}

export { hasApiKey, getApiKey, CONFIG };
