/**
 * Agent Conversation Store
 * Stores conversation history for each agent session in localStorage
 */

import type { AgentName } from './messages';

export interface ConversationTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp: number;
  tokens?: { input: number; output: number };
}

export interface AgentConversation {
  sessionId: string;
  agentName: AgentName;
  turns: ConversationTurn[];
  createdAt: number;
}

const STORAGE_KEY = 'agent_conversations';
const MAX_SESSIONS = 50;

function getAllConversations(): Record<string, AgentConversation[]> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, AgentConversation[]>;
  } catch {
    return {};
  }
}

function saveAllConversations(conversations: Record<string, AgentConversation[]>): void {
  // Enforce max sessions limit - keep most recent
  const keys = Object.keys(conversations);
  if (keys.length > MAX_SESSIONS) {
    // Sort by most recent activity (use first conversation's createdAt)
    const sorted = keys.sort((a, b) => {
      const aTime = conversations[a]?.[0]?.createdAt || 0;
      const bTime = conversations[b]?.[0]?.createdAt || 0;
      return bTime - aTime;
    });
    const toRemove = sorted.slice(MAX_SESSIONS);
    toRemove.forEach(k => delete conversations[k]);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

export const AgentConversationStore = {
  /**
   * Add a conversation turn for a specific session and agent
   */
  addTurn(
    sessionId: string,
    agentName: AgentName,
    role: 'system' | 'user' | 'assistant',
    content: string,
    tokens?: { input: number; output: number }
  ): void {
    const conversations = getAllConversations();
    const key = `${sessionId}:${agentName}`;

    if (!conversations[key]) {
      conversations[key] = [];
    }

    const turn: ConversationTurn = {
      role,
      content,
      timestamp: Date.now(),
      tokens,
    };

    conversations[key].push(turn);
    saveAllConversations(conversations);
  },

  /**
   * Get conversation history for a specific session and agent
   */
  getConversation(sessionId: string, agentName: AgentName): ConversationTurn[] {
    const conversations = getAllConversations();
    const key = `${sessionId}:${agentName}`;
    return conversations[key] || [];
  },

  /**
   * Get all unique session IDs
   */
  getAllSessions(): string[] {
    const conversations = getAllConversations();
    const sessions = new Set<string>();
    Object.keys(conversations).forEach(key => {
      const sessionId = key.split(':')[0];
      if (sessionId) sessions.add(sessionId);
    });
    return Array.from(sessions);
  },

  /**
   * Get all agents for a specific session
   */
  getSessionAgents(sessionId: string): AgentName[] {
    const conversations = getAllConversations();
    const agents: AgentName[] = [];
    Object.keys(conversations).forEach(key => {
      if (key.startsWith(`${sessionId}:`)) {
        const agentName = key.split(':')[1] as AgentName;
        if (agentName) agents.push(agentName);
      }
    });
    return agents;
  },

  /**
   * Clear all conversations
   */
  clearAll(): void {
    localStorage.removeItem(STORAGE_KEY);
  },

  /**
   * Clear conversations for a specific session
   */
  clearSession(sessionId: string): void {
    const conversations = getAllConversations();
    Object.keys(conversations).forEach(key => {
      if (key.startsWith(`${sessionId}:`)) {
        delete conversations[key];
      }
    });
    saveAllConversations(conversations);
  },
};
