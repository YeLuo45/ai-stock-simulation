import type { AgentWeight, ToolCategory, Tool } from './types';
import type Dexie from 'dexie';

interface EvolutionRecord {
  agentId: string;
  timestamp: number;
  success: boolean;
  returnRate: number;
  weightSnapshot: number;
}

const STORAGE_KEY = 'mcp_evolution_records';

class SelfEvolutionEngine {
  private weights: Map<string, AgentWeight> = new Map();
  private db: Dexie | null = null;
  private weekStart: number = 0;

  constructor() {
    this.weekStart = this.getWeekStart();
    this.initDatabase();
    this.loadFromStorage();
  }

  private getWeekStart(): number {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    return new Date(now.setDate(diff)).setHours(0, 0, 0, 0);
  }

  private async initDatabase(): Promise<void> {
    try {
      const Dexie = (await import('dexie')).default;
      this.db = new Dexie();
      (this.db as any).version(1).stores({
        evolutionRecords: '++id, agentId, timestamp'
      });
    } catch {
      // Dexie not available, use localStorage only
    }
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const records: EvolutionRecord[] = JSON.parse(stored);
        const currentWeekStart = this.getWeekStart();
        if (this.weekStart !== currentWeekStart) {
          // New week - reset stats
          this.weekStart = currentWeekStart;
          this.weights.forEach((weight, agentId) => {
            this.weights.set(agentId, {
              ...weight,
              totalDecisions: 0,
              errorCount: 0,
              winRate: 0,
              avgReturn: 0
            });
          });
        }
      }
    } catch {
      // Ignore storage errors
    }
  }

  private saveToStorage(): void {
    try {
      const records: EvolutionRecord[] = [];
      this.weights.forEach((weight) => {
        records.push({
          agentId: weight.agentId,
          timestamp: Date.now(),
          success: weight.winRate > 0.5,
          returnRate: weight.avgReturn,
          weightSnapshot: weight.weight
        });
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Ignore storage errors
    }
  }

  private ensureAgent(agentId: string): AgentWeight {
    if (!this.weights.has(agentId)) {
      this.weights.set(agentId, {
        agentId,
        weight: 0.5,
        winRate: 0,
        avgReturn: 0,
        errorCount: 0,
        totalDecisions: 0
      });
    }
    return this.weights.get(agentId)!;
  }

  async recordDecision(agentId: string, success: boolean, returnRate: number): Promise<void> {
    const agent = this.ensureAgent(agentId);
    
    // Update statistics
    agent.totalDecisions++;
    if (success) {
      agent.winRate = (agent.winRate * (agent.totalDecisions - 1) + 1) / agent.totalDecisions;
    } else {
      agent.winRate = agent.winRate * (agent.totalDecisions - 1) / agent.totalDecisions;
    }
    agent.avgReturn = (agent.avgReturn * (agent.totalDecisions - 1) + returnRate) / agent.totalDecisions;

    // Update weight based on success/failure
    if (success) {
      agent.weight = Math.min(0.9, agent.weight + 0.05);
    } else {
      agent.weight = Math.max(0.1, agent.weight - 0.03);
      agent.errorCount++;
    }

    // Save to database if available
    if (this.db) {
      try {
        await (this.db as any).evolutionRecords.add({
          agentId,
          timestamp: Date.now(),
          success,
          returnRate,
          weightSnapshot: agent.weight
        });
      } catch {
        // Ignore DB errors
      }
    }

    this.saveToStorage();
  }

  getWeight(agentId: string): number {
    return this.weights.get(agentId)?.weight ?? 0.5;
  }

  evolve(): void {
    // Evolutionary logic - can be extended for more sophisticated evolution
    this.weights.forEach((weight, agentId) => {
      // Convergence towards middle ground if very extreme
      if (weight.weight > 0.8 && weight.winRate < 0.4) {
        weight.weight = Math.max(0.5, weight.weight - 0.1);
      }
      if (weight.weight < 0.2 && weight.winRate > 0.6) {
        weight.weight = Math.min(0.5, weight.weight + 0.1);
      }
      this.weights.set(agentId, weight);
    });
  }

  getAllWeights(): AgentWeight[] {
    return Array.from(this.weights.values());
  }

  reset(): void {
    this.weights.clear();
    localStorage.removeItem(STORAGE_KEY);
  }

  getAgentWeight(agentId: string): AgentWeight | null {
    return this.weights.get(agentId) ?? null;
  }
}

export const selfEvolutionEngine = new SelfEvolutionEngine();
export { SelfEvolutionEngine };
export type { AgentWeight, EvolutionRecord };