import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toolRegistry, ToolRegistry } from '../ToolRegistry';
import type { Tool, ToolCategory, ToolInputSchema } from '../types';

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

describe('ToolRegistry', () => {
  beforeEach(() => {
    // Reset registry by creating a new instance for each test
    const registry = new ToolRegistry();
    (toolRegistry as any).tools = (registry as any).tools;
  });

  describe('initialization', () => {
    it('should initialize with 8 built-in tools', () => {
      expect(toolRegistry.getToolCount()).toBe(8);
    });

    it('should have getRealtimeQuote tool', () => {
      const tool = toolRegistry.getTool('getRealtimeQuote');
      expect(tool).not.toBeNull();
      expect(tool?.name).toBe('getRealtimeQuote');
    });

    it('should have fetchKlineData tool', () => {
      const tool = toolRegistry.getTool('fetchKlineData');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('market_data');
    });

    it('should have calculateRSI tool', () => {
      const tool = toolRegistry.getTool('calculateRSI');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('analysis');
    });

    it('should have calculateMA tool', () => {
      const tool = toolRegistry.getTool('calculateMA');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('analysis');
    });

    it('should have placePaperTrade tool', () => {
      const tool = toolRegistry.getTool('placePaperTrade');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('execution');
    });

    it('should have validateRisk tool', () => {
      const tool = toolRegistry.getTool('validateRisk');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('risk_control');
    });

    it('should have getMarketRegime tool', () => {
      const tool = toolRegistry.getTool('getMarketRegime');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('risk_control');
    });

    it('should have getStrategyWeight tool', () => {
      const tool = toolRegistry.getTool('getStrategyWeight');
      expect(tool).not.toBeNull();
      expect(tool?.category).toBe('risk_control');
    });
  });

  describe('register', () => {
    it('should register a new tool', () => {
      const newTool: Tool = {
        name: 'testTool',
        description: 'A test tool',
        category: 'market_data',
        inputSchema: { test: 'string' },
        outputSchema: { result: 'number' },
        execute: async () => ({ result: 42 })
      };
      
      toolRegistry.register(newTool);
      expect(toolRegistry.getToolCount()).toBe(9);
      expect(toolRegistry.getTool('testTool')).not.toBeNull();
    });

    it('should throw error when registering duplicate tool', () => {
      const newTool: Tool = {
        name: 'testDuplicate',
        description: 'A test tool',
        category: 'market_data',
        inputSchema: {},
        outputSchema: {},
        execute: async () => ({})
      };
      
      toolRegistry.register(newTool);
      expect(() => toolRegistry.register(newTool)).toThrow("Tool with name 'testDuplicate' is already registered.");
    });
  });

  describe('unregister', () => {
    it('should unregister an existing tool', () => {
      const newTool: Tool = {
        name: 'toBeRemoved',
        description: 'Will be removed',
        category: 'analysis',
        inputSchema: {},
        outputSchema: {},
        execute: async () => ({})
      };
      
      toolRegistry.register(newTool);
      expect(toolRegistry.getTool('toBeRemoved')).not.toBeNull();
      
      const result = toolRegistry.unregister('toBeRemoved');
      expect(result).toBe(true);
      expect(toolRegistry.getTool('toBeRemoved')).toBeNull();
    });

    it('should return false when unregistering non-existent tool', () => {
      const result = toolRegistry.unregister('nonExistent');
      expect(result).toBe(false);
    });
  });

  describe('getTool', () => {
    it('should return tool by name', () => {
      const tool = toolRegistry.getTool('getRealtimeQuote');
      expect(tool).not.toBeNull();
      expect(tool?.name).toBe('getRealtimeQuote');
    });

    it('should return null for non-existent tool', () => {
      const tool = toolRegistry.getTool('nonExistentTool');
      expect(tool).toBeNull();
    });
  });

  describe('findTools', () => {
    it('should find tools by category - market_data', () => {
      const tools = toolRegistry.findTools('market_data');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'market_data')).toBe(true);
    });

    it('should find tools by category - analysis', () => {
      const tools = toolRegistry.findTools('analysis');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'analysis')).toBe(true);
    });

    it('should find tools by category - execution', () => {
      const tools = toolRegistry.findTools('execution');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'execution')).toBe(true);
    });

    it('should find tools by category - risk_control', () => {
      const tools = toolRegistry.findTools('risk_control');
      expect(tools.length).toBeGreaterThan(0);
      expect(tools.every(t => t.category === 'risk_control')).toBe(true);
    });

    it('should return empty array for unknown category', () => {
      // 'execution' is a valid category, so it will return tools
      // Testing with a truly non-existent category
      const tools = toolRegistry.findTools('invalid_category' as ToolCategory);
      expect(tools.length).toBe(0);
    });
  });

  describe('listAllTools', () => {
    it('should list all tools', () => {
      const tools = toolRegistry.listAllTools();
      expect(tools.length).toBe(toolRegistry.getToolCount());
    });
  });

  describe('getToolCount', () => {
    it('should return correct count', () => {
      expect(toolRegistry.getToolCount()).toBe(8);
      
      toolRegistry.register({
        name: 'extraTool',
        description: 'Extra',
        category: 'market_data',
        inputSchema: {},
        outputSchema: {},
        execute: async () => ({})
      });
      
      expect(toolRegistry.getToolCount()).toBe(9);
    });
  });

  describe('tool execution', () => {
    it('should execute getRealtimeQuote', async () => {
      const tool = toolRegistry.getTool('getRealtimeQuote');
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute({ symbol: 'AAPL' });
      expect(result).toHaveProperty('symbol', 'AAPL');
      expect(result).toHaveProperty('price');
    });

    it('should execute placePaperTrade', async () => {
      const tool = toolRegistry.getTool('placePaperTrade');
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute({ symbol: 'AAPL', action: 'buy', quantity: 100, price: 150 });
      expect(result).toHaveProperty('orderId');
      expect(result).toHaveProperty('status', 'filled');
    });

    it('should execute validateRisk', async () => {
      const tool = toolRegistry.getTool('validateRisk');
      expect(tool).not.toBeNull();
      
      const result = await tool!.execute({ symbol: 'AAPL', quantity: 100, price: 150, portfolioValue: 100000 });
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('riskLevel');
    });
  });
});