import { describe, it, expect, beforeEach, vi } from 'vitest';
import { selfEvolutionEngine, SelfEvolutionEngine } from '../SelfEvolutionEngine';
import type { AgentWeight } from '../types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('SelfEvolutionEngine', () => {
  beforeEach(() => {
    // Reset engine state
    selfEvolutionEngine.reset();
  });

  describe('initialization', () => {
    it('should initialize with empty weights', () => {
      const weights = selfEvolutionEngine.getAllWeights();
      expect(weights).toEqual([]);
    });
  });

  describe('recordDecision', () => {
    it('should create new agent weight on first decision', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      
      const weight = selfEvolutionEngine.getWeight('agent1');
      expect(weight).toBe(0.55); // Initial 0.5 + 0.05
    });

    it('should increase weight on success', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      await selfEvolutionEngine.recordDecision('agent1', true, 0.03);
      
      const weight = selfEvolutionEngine.getWeight('agent1');
      expect(weight).toBeCloseTo(0.60, 2); // 0.5 + 0.05 + 0.05
    });

    it('should decrease weight on failure', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.02);
      
      const weight = selfEvolutionEngine.getWeight('agent1');
      expect(weight).toBe(0.52); // 0.55 - 0.03
    });

    it('should cap weight at 0.9 on success', async () => {
      // Set weight close to cap
      for (let i = 0; i < 10; i++) {
        await selfEvolutionEngine.recordDecision('agent1', true, 0.01);
      }
      
      const weight = selfEvolutionEngine.getWeight('agent1');
      expect(weight).toBeLessThanOrEqual(0.9);
    });

    it('should floor weight at 0.1 on failure', async () => {
      // Set weight close to floor
      for (let i = 0; i < 20; i++) {
        await selfEvolutionEngine.recordDecision('agent1', false, -0.01);
      }
      
      const weight = selfEvolutionEngine.getWeight('agent1');
      expect(weight).toBeGreaterThanOrEqual(0.1);
    });

    it('should track win rate correctly', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      await selfEvolutionEngine.recordDecision('agent1', true, 0.03);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.02);
      
      const agentWeight = selfEvolutionEngine.getAgentWeight('agent1');
      expect(agentWeight?.totalDecisions).toBe(3);
      expect(agentWeight?.winRate).toBeCloseTo(2/3, 2);
    });

    it('should track average return correctly', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.10);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.05);
      
      const agentWeight = selfEvolutionEngine.getAgentWeight('agent1');
      expect(agentWeight?.avgReturn).toBeCloseTo(0.025, 3); // (0.10 - 0.05) / 2
    });

    it('should increment error count on failure', async () => {
      await selfEvolutionEngine.recordDecision('agent1', false, -0.02);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.03);
      
      const agentWeight = selfEvolutionEngine.getAgentWeight('agent1');
      expect(agentWeight?.errorCount).toBe(2);
    });
  });

  describe('getWeight', () => {
    it('should return default weight for unknown agent', () => {
      const weight = selfEvolutionEngine.getWeight('unknownAgent');
      expect(weight).toBe(0.5);
    });

    it('should return stored weight for known agent', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      expect(selfEvolutionEngine.getWeight('agent1')).toBe(0.55);
    });
  });

  describe('evolve', () => {
    it('should reduce weight for high weight low win rate agents', async () => {
      // Create agent with high weight but low win rate
      await selfEvolutionEngine.recordDecision('agent1', true, 0.01);
      await selfEvolutionEngine.recordDecision('agent1', true, 0.01);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.05);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.05);
      
      // Weight should be 0.54 (0.5 + 0.05 + 0.05 - 0.03 - 0.03)
      selfEvolutionEngine.evolve();
      
      // After evolution with high weight (0.55) and low win rate (0.5), weight should move toward 0.5
      const agentWeight = selfEvolutionEngine.getAgentWeight('agent1');
      expect(agentWeight?.weight).toBeLessThanOrEqual(0.55);
    });
  });

  describe('getAllWeights', () => {
    it('should return empty array initially', () => {
      const weights = selfEvolutionEngine.getAllWeights();
      expect(weights).toEqual([]);
    });

    it('should return all agent weights', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      await selfEvolutionEngine.recordDecision('agent2', false, -0.03);
      
      const weights = selfEvolutionEngine.getAllWeights();
      expect(weights.length).toBe(2);
    });
  });

  describe('reset', () => {
    it('should clear all weights', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      await selfEvolutionEngine.recordDecision('agent2', false, -0.03);
      
      selfEvolutionEngine.reset();
      
      const weights = selfEvolutionEngine.getAllWeights();
      expect(weights).toEqual([]);
    });

    it('should reset weight for agent after reset', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      selfEvolutionEngine.reset();
      
      // After reset, agent should have default weight
      const weight = selfEvolutionEngine.getWeight('agent1');
      expect(weight).toBe(0.5);
    });
  });

  describe('getAgentWeight', () => {
    it('should return null for unknown agent', () => {
      const agentWeight = selfEvolutionEngine.getAgentWeight('unknownAgent');
      expect(agentWeight).toBeNull();
    });

    it('should return agent weight for known agent', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      
      const agentWeight = selfEvolutionEngine.getAgentWeight('agent1');
      expect(agentWeight).not.toBeNull();
      expect(agentWeight?.agentId).toBe('agent1');
      expect(agentWeight?.weight).toBe(0.55);
    });

    it('should track total decisions correctly', async () => {
      await selfEvolutionEngine.recordDecision('agent1', true, 0.05);
      await selfEvolutionEngine.recordDecision('agent1', false, -0.03);
      await selfEvolutionEngine.recordDecision('agent1', true, 0.02);
      
      const agentWeight = selfEvolutionEngine.getAgentWeight('agent1');
      expect(agentWeight?.totalDecisions).toBe(3);
    });
  });
});