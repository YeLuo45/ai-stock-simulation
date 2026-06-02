import { describe, it, expect, beforeEach } from 'vitest';
import { agentToolDiscoveryService, AgentToolDiscoveryService } from '../AgentToolDiscoveryService';
import { toolRegistry } from '../ToolRegistry';
import type { Tool } from '../types';

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

describe('AgentToolDiscoveryService', () => {
  beforeEach(() => {
    // Clear cache before each test
    agentToolDiscoveryService.clearCache();
  });

  describe('discoverTools', () => {
    it('should discover all tools for an agent', () => {
      const tools = agentToolDiscoveryService.discoverTools('agent1');
      expect(tools.length).toBeGreaterThan(0);
    });

    it('should discover tools by category', () => {
      const tools = agentToolDiscoveryService.discoverTools('agent1', 'market_data');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'market_data')).toBe(true);
    });

    it('should discover analysis tools', () => {
      const tools = agentToolDiscoveryService.discoverTools('agent1', 'analysis');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'analysis')).toBe(true);
    });

    it('should discover execution tools', () => {
      const tools = agentToolDiscoveryService.discoverTools('agent1', 'execution');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'execution')).toBe(true);
    });

    it('should discover risk_control tools', () => {
      const tools = agentToolDiscoveryService.discoverTools('agent1', 'risk_control');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'risk_control')).toBe(true);
    });

    it('should cache discovered tools', () => {
      agentToolDiscoveryService.discoverTools('agent1');
      const cached = agentToolDiscoveryService.getCachedTools('agent1');
      expect(cached.length).toBeGreaterThan(0);
    });

    it('should return cached tools without re-discovering', () => {
      const tools1 = agentToolDiscoveryService.discoverTools('agent1');
      const tools2 = agentToolDiscoveryService.discoverTools('agent1');
      expect(tools1).toEqual(tools2);
    });
  });

  describe('getCachedTools', () => {
    it('should return empty array for unknown agent', () => {
      const cached = agentToolDiscoveryService.getCachedTools('unknownAgent');
      expect(cached).toEqual([]);
    });

    it('should return cached tools for known agent', () => {
      agentToolDiscoveryService.discoverTools('agent1');
      const cached = agentToolDiscoveryService.getCachedTools('agent1');
      expect(cached.length).toBeGreaterThan(0);
    });

    it('should return empty array for expired cache', async () => {
      // Manually set an old cache entry
      const service = new AgentToolDiscoveryService();
      (service as any).cache.set('agentOld', {
        tools: [{ name: 'oldTool' }] as Tool[],
        timestamp: Date.now() - 10 * 60 * 1000 // 10 minutes ago (expired)
      });
      
      const cached = service.getCachedTools('agentOld');
      expect(cached).toEqual([]);
    });
  });

  describe('clearCache', () => {
    it('should clear all cached tools', () => {
      agentToolDiscoveryService.discoverTools('agent1');
      agentToolDiscoveryService.discoverTools('agent2');
      
      expect(agentToolDiscoveryService.getCacheSize()).toBe(2);
      
      agentToolDiscoveryService.clearCache();
      
      expect(agentToolDiscoveryService.getCacheSize()).toBe(0);
    });
  });

  describe('clearAgentCache', () => {
    it('should clear cache for specific agent', () => {
      agentToolDiscoveryService.discoverTools('agent1');
      agentToolDiscoveryService.discoverTools('agent2');
      
      agentToolDiscoveryService.clearAgentCache('agent1');
      
      expect(agentToolDiscoveryService.getCachedTools('agent1')).toEqual([]);
      expect(agentToolDiscoveryService.getCachedTools('agent2').length).toBeGreaterThan(0);
    });
  });

  describe('getCacheSize', () => {
    it('should return 0 initially', () => {
      agentToolDiscoveryService.clearCache();
      expect(agentToolDiscoveryService.getCacheSize()).toBe(0);
    });

    it('should return correct cache size', () => {
      agentToolDiscoveryService.discoverTools('agent1');
      agentToolDiscoveryService.discoverTools('agent2');
      
      expect(agentToolDiscoveryService.getCacheSize()).toBe(2);
    });
  });

  describe('isCacheValid', () => {
    it('should return false for unknown agent', () => {
      expect(agentToolDiscoveryService.isCacheValid('unknownAgent')).toBe(false);
    });

    it('should return true for agent with valid cache', () => {
      agentToolDiscoveryService.discoverTools('agent1');
      expect(agentToolDiscoveryService.isCacheValid('agent1')).toBe(true);
    });

    it('should return false for expired cache', () => {
      // Manually set an old cache entry
      const service = new AgentToolDiscoveryService();
      (service as any).cache.set('agentOld', {
        tools: [{ name: 'oldTool' }] as Tool[],
        timestamp: Date.now() - 10 * 60 * 1000 // 10 minutes ago (expired)
      });
      
      expect(service.isCacheValid('agentOld')).toBe(false);
    });
  });
});