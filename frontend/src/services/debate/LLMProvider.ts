/**
 * LLM Provider - Abstract interface for LLM API calls
 * Supports MiniMax (primary) and OpenAI (fallback)
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMOptions {
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export interface LLMResponse {
  content: string;
  usage?: {
    tokens: number;
    input_tokens?: number;
    output_tokens?: number;
  };
  latency?: number;
  error?: string;
}

export interface LLMProvider {
  name: string;
  chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse>;
  testConnection(apiKey: string): Promise<{ success: boolean; message: string }>;
}

// Timeout for LLM calls (10 seconds as per PRD)
const LLM_TIMEOUT = 10000;

// ============== MiniMax Provider ==============

export class MiniMaxProvider implements LLMProvider {
  name = 'minimax';
  private endpoint = 'https://api.minimax.chat/v1/text/chatcompletion_v2';
  private model = 'MiniMax-Text-01';

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { content: '', error: 'No API key configured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model || this.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens ?? 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { content: '', error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      
      // Extract content from MiniMax response format
      let content = '';
      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      } else if (data.output?.text) {
        content = data.output.text;
      } else if (data.content) {
        content = data.content;
      }

      return {
        content,
        usage: data.usage ? {
          tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0),
          input_tokens: data.usage.input_tokens,
          output_tokens: data.usage.output_tokens,
        } : undefined,
        latency: data.latency || 0,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        return { content: '', error: `Request timeout after ${LLM_TIMEOUT}ms` };
      }
      return { content: '', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async testConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: 'MiniMax API 连接成功' };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { success: false, message: `连接失败: ${response.status} ${errorText}` };
      }
    } catch (err) {
      return { 
        success: false, 
        message: err instanceof Error && err.name === 'AbortError' 
          ? '连接超时' 
          : (err instanceof Error ? err.message : '连接失败') 
      };
    }
  }

  private getApiKey(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('minimax_api_key') || '';
  }
}

// ============== OpenAI Provider ==============

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private endpoint = 'https://api.openai.com/v1/chat/completions';
  private model = 'gpt-4o';

  async chat(messages: ChatMessage[], options?: LLMOptions): Promise<LLMResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { content: '', error: 'No API key configured' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: options?.model || this.model,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
          })),
          temperature: options?.temperature ?? 0.7,
          max_tokens: options?.max_tokens ?? 2048,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { content: '', error: `HTTP ${response.status}: ${errorText}` };
      }

      const data = await response.json();
      
      let content = '';
      if (data.choices?.[0]?.message?.content) {
        content = data.choices[0].message.content;
      }

      return {
        content,
        usage: data.usage ? {
          tokens: data.usage.total_tokens || 0,
          input_tokens: data.usage.prompt_tokens,
          output_tokens: data.usage.completion_tokens,
        } : undefined,
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        return { content: '', error: `Request timeout after ${LLM_TIMEOUT}ms` };
      }
      return { content: '', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async testConnection(apiKey: string): Promise<{ success: boolean; message: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 5,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        return { success: true, message: 'OpenAI API 连接成功' };
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        return { success: false, message: `连接失败: ${response.status}` };
      }
    } catch (err) {
      return { 
        success: false, 
        message: err instanceof Error && err.name === 'AbortError' 
          ? '连接超时' 
          : (err instanceof Error ? err.message : '连接失败') 
      };
    }
  }

  private getApiKey(): string {
    if (typeof localStorage === 'undefined') return '';
    return localStorage.getItem('openai_api_key') || '';
  }
}

// ============== Provider Factory ==============

export function createLLMProvider(provider: 'minimax' | 'openai' | 'anthropic'): LLMProvider {
  switch (provider) {
    case 'openai':
      return new OpenAIProvider();
    case 'minimax':
    default:
      return new MiniMaxProvider();
  }
}

// ============== API Key Storage (encrypted) ==============

export function saveLLMApiKey(provider: 'minimax' | 'openai', key: string): void {
  if (typeof localStorage === 'undefined') return;
  // Simple obfuscation - not cryptographically secure but prevents casual reading
  const encoded = btoa(key.split('').map((c, i) => 
    String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
  ).join(''));
  localStorage.setItem(`${provider}_api_key`, encoded);
}

export function getLLMApiKey(provider: 'minimax' | 'openai'): string {
  if (typeof localStorage === 'undefined') return '';
  const encoded = localStorage.getItem(`${provider}_api_key`);
  if (!encoded) return '';
  try {
    return atob(encoded).split('').map((c, i) => 
      String.fromCharCode(c.charCodeAt(0) ^ (i % 256))
    ).join('');
  } catch {
    return '';
  }
}

export function clearLLMApiKey(provider: 'minimax' | 'openai'): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(`${provider}_api_key`);
}