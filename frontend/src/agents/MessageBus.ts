/**
 * MessageBus - Event Bus for Agent Communication
 * Handles message routing, subscriptions, broadcasting, and state transitions
 */

import type { AgentMessage, MessageType } from '../types/AgentMessage';
import { Phase, type AgentState } from '../types/AgentState';
import { VALID_PHASE_TRANSITIONS } from '../types/AgentState';

export type MessageHandler = (msg: AgentMessage) => void;

const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  backoffMultiplier: 2,
  initialDelayMs: 1000,
};

const ERROR_RETRY_MAP: Record<string, { maxRetries: number; backoffMultiplier: number; initialDelayMs: number }> = {
  'NETWORK_TIMEOUT': { maxRetries: 3, backoffMultiplier: 2, initialDelayMs: 1000 },
  'LLM_ERROR': { maxRetries: 2, backoffMultiplier: 1.5, initialDelayMs: 2000 },
  'RATE_LIMIT': { maxRetries: 5, backoffMultiplier: 3, initialDelayMs: 5000 },
};

class MessageBus {
  private subscriptions: Map<string, Array<MessageHandler>>;
  private messageHistory: Map<string, AgentMessage[]>;
  private states: Map<string, AgentState>;
  private pendingRetries: Map<string, { message: AgentMessage; retriesLeft: number; timer: ReturnType<typeof setTimeout> }>;

  constructor() {
    this.subscriptions = new Map();
    this.messageHistory = new Map();
    this.states = new Map();
    this.pendingRetries = new Map();
  }

  /**
   * Subscribe to messages for a specific agent
   * @param agentId - Agent identifier
   * @param callback - Handler function
   * @returns Unsubscribe function
   */
  subscribe(agentId: string, callback: MessageHandler): () => void {
    if (!this.subscriptions.has(agentId)) {
      this.subscriptions.set(agentId, []);
    }
    this.subscriptions.get(agentId)!.push(callback);

    // Return unsubscribe function
    return () => {
      const handlers = this.subscriptions.get(agentId);
      if (handlers) {
        const index = handlers.indexOf(callback);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Unsubscribe an agent from all messages
   */
  unsubscribe(agentId: string): void {
    this.subscriptions.delete(agentId);
  }

  /**
   * Publish a message to its receiver
   */
  publish(message: AgentMessage): void {
    // Update message status
    message.status = 'sent';
    message.timestamp = Date.now();

    // Store in history
    const conversationId = message.conversationId;
    if (!this.messageHistory.has(conversationId)) {
      this.messageHistory.set(conversationId, []);
    }
    this.messageHistory.get(conversationId)!.push(message);

    // Update state
    this.updateStateWithMessage(message);

    // Deliver to receiver
    const handlers = this.subscriptions.get(message.receiver);
    if (handlers && handlers.length > 0) {
      message.status = 'delivered';
      handlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error(`[MessageBus] Handler error for ${message.receiver}:`, error);
          this.handleError(message, error instanceof Error ? error.message : 'Unknown error');
        }
      });
    } else {
      // No handler found - mark as delivered to self or dispatch
      message.status = 'delivered';
    }
  }

  /**
   * Broadcast a message to all agents
   */
  broadcast(sender: string, type: MessageType, content: Record<string, unknown>): void {
    const agentIds = Array.from(this.subscriptions.keys());
    const message: AgentMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      sender,
      receiver: 'broadcast',
      type,
      content,
      timestamp: Date.now(),
      conversationId: `conv-${Date.now()}`,
      status: 'pending',
      retryCount: 0,
    };

    agentIds.forEach(agentId => {
      if (agentId !== sender) {
        this.publish({ ...message, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, receiver: agentId });
      }
    });
  }

  /**
   * Get all messages for a conversation
   */
  getMessages(conversationId: string): AgentMessage[] {
    return this.messageHistory.get(conversationId) || [];
  }

  /**
   * Get state for a conversation
   */
  getState(conversationId: string): AgentState | null {
    return this.states.get(conversationId) || null;
  }

  /**
   * Transition to a new phase
   */
  transitionPhase(conversationId: string, newPhase: Phase): boolean {
    const state = this.states.get(conversationId);
    if (!state) {
      // Create new state if doesn't exist
      this.states.set(conversationId, {
        conversationId,
        currentPhase: newPhase,
        previousPhase: null,
        agentsInvolved: [],
        messages: [],
        results: {},
        startedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return true;
    }

    const validTransitions = VALID_PHASE_TRANSITIONS[state.currentPhase];
    if (!validTransitions.includes(newPhase)) {
      console.warn(`[MessageBus] Invalid phase transition: ${state.currentPhase} -> ${newPhase}`);
      return false;
    }

    state.previousPhase = state.currentPhase;
    state.currentPhase = newPhase;
    state.updatedAt = Date.now();

    return true;
  }

  /**
   * Create a new conversation state
   */
  createConversation(conversationId: string, agentsInvolved: string[]): AgentState {
    const state: AgentState = {
      conversationId,
      currentPhase: Phase.IDLE,
      previousPhase: null,
      agentsInvolved,
      messages: [],
      results: {},
      startedAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.states.set(conversationId, state);
    return state;
  }

  /**
   * Update state with message data
   */
  private updateStateWithMessage(message: AgentMessage): void {
    const state = this.states.get(message.conversationId);
    if (state) {
      state.messages.push(message);
      state.updatedAt = Date.now();
    }
  }

  /**
   * Set result for a conversation
   */
  setResult(conversationId: string, key: string, value: unknown): void {
    const state = this.states.get(conversationId);
    if (state) {
      state.results[key] = value;
      state.updatedAt = Date.now();
    }
  }

  /**
   * Set error for a conversation
   */
  setError(conversationId: string, error: string): void {
    const state = this.states.get(conversationId);
    if (state) {
      state.error = error;
      state.updatedAt = Date.now();
      state.currentPhase = Phase.FAILED;
    }
  }

  /**
   * Handle error and potentially retry
   */
  private handleError(msg: AgentMessage, error: string): void {
    const errorCode = this.extractErrorCode(error);
    const retryConfig = ERROR_RETRY_MAP[errorCode] || DEFAULT_RETRY_CONFIG;

    if (msg.retryCount < retryConfig.maxRetries) {
      this.retry(msg, retryConfig);
    } else {
      msg.status = 'failed';
      this.setError(msg.conversationId, error);
    }
  }

  /**
   * Retry a failed message with exponential backoff
   */
  private retry(message: AgentMessage, config: { maxRetries: number; backoffMultiplier: number; initialDelayMs: number }): void {
    const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, message.retryCount);
    message.retryCount++;

    const timer = setTimeout(() => {
      this.pendingRetries.delete(message.id);
      this.publish(message);
    }, delay);

    this.pendingRetries.set(message.id, {
      message,
      retriesLeft: config.maxRetries - message.retryCount,
      timer,
    });
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: string): string {
    if (error.includes('timeout') || error.includes('Timeout')) return 'NETWORK_TIMEOUT';
    if (error.includes('rate limit') || error.includes('Rate limit')) return 'RATE_LIMIT';
    if (error.includes('llm') || error.includes('LLM') || error.includes('model')) return 'LLM_ERROR';
    return 'UNKNOWN';
  }

  /**
   * Clear conversation history
   */
  clearHistory(conversationId: string): void {
    this.messageHistory.delete(conversationId);
  }

  /**
   * Clear all data
   */
  reset(): void {
    this.subscriptions.clear();
    this.messageHistory.clear();
    this.states.clear();
    this.pendingRetries.forEach(({ timer }) => clearTimeout(timer));
    this.pendingRetries.clear();
  }
}

// Singleton instance
export const messageBus = new MessageBus();
