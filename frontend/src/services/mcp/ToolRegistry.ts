import type { Tool, ToolCategory, ToolInputSchema, ToolOutputSchema } from './types';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool with name '${tool.name}' is already registered.`);
    }
    this.tools.set(tool.name, tool);
  }

  unregister(name: string): boolean {
    return this.tools.delete(name);
  }

  getTool(name: string): Tool | null {
    return this.tools.get(name) ?? null;
  }

  findTools(category: ToolCategory): Tool[] {
    return Array.from(this.tools.values()).filter(tool => tool.category === category);
  }

  listAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  getToolCount(): number {
    return this.tools.size;
  }

  private initBuiltinTools(): void {
    // market_data tools
    const getRealtimeQuote: Tool = {
      name: 'getRealtimeQuote',
      description: '获取股票的实时报价数据',
      category: 'market_data',
      inputSchema: { symbol: { type: 'string', description: '股票代码' } },
      outputSchema: { symbol: 'string', price: 'number', change: 'number', changePercent: 'number' },
      execute: async (input: ToolInputSchema) => {
        const symbol = input.symbol as string;
        return { symbol, price: 100 + Math.random() * 10, change: 1.5, changePercent: 1.5 };
      }
    };

    const fetchKlineData: Tool = {
      name: 'fetchKlineData',
      description: '获取K线历史数据',
      category: 'market_data',
      inputSchema: { symbol: 'string', period: 'string', count: 'number' },
      outputSchema: { symbol: 'string', klines: 'array' },
      execute: async (input: ToolInputSchema) => {
        const symbol = input.symbol as string;
        return { symbol, klines: [{ time: Date.now(), open: 100, high: 105, low: 99, close: 103 }] };
      }
    };

    // analysis tools
    const calculateRSI: Tool = {
      name: 'calculateRSI',
      description: '计算RSI技术指标',
      category: 'analysis',
      inputSchema: { prices: 'array', period: 'number' },
      outputSchema: { rsi: 'number' },
      execute: async (input: ToolInputSchema) => {
        return { rsi: 50 + Math.random() * 30 };
      }
    };

    const calculateMA: Tool = {
      name: 'calculateMA',
      description: '计算移动平均线',
      category: 'analysis',
      inputSchema: { prices: 'array', period: 'number' },
      outputSchema: { ma: 'number' },
      execute: async (input: ToolInputSchema) => {
        return { ma: 102.5 };
      }
    };

    // execution tools
    const placePaperTrade: Tool = {
      name: 'placePaperTrade',
      description: '执行模拟交易',
      category: 'execution',
      inputSchema: { symbol: 'string', action: 'string', quantity: 'number', price: 'number' },
      outputSchema: { orderId: 'string', status: 'string', filledAt: 'number' },
      execute: async (input: ToolInputSchema) => {
        return { orderId: `ORDER-${Date.now()}`, status: 'filled', filledAt: Date.now() };
      }
    };

    // risk_control tools
    const validateRisk: Tool = {
      name: 'validateRisk',
      description: '验证交易风险',
      category: 'risk_control',
      inputSchema: { symbol: 'string', quantity: 'number', price: 'number', portfolioValue: 'number' },
      outputSchema: { valid: 'boolean', riskLevel: 'string', maxPosition: 'number' },
      execute: async (input: ToolInputSchema) => {
        return { valid: true, riskLevel: 'low', maxPosition: input.portfolioValue as number * 0.1 };
      }
    };

    const getMarketRegime: Tool = {
      name: 'getMarketRegime',
      description: '获取当前市场状态',
      category: 'risk_control',
      inputSchema: { symbol: 'string' },
      outputSchema: { regime: 'string', volatility: 'number', trend: 'string' },
      execute: async (input: ToolInputSchema) => {
        return { regime: 'bull', volatility: 0.2, trend: 'up' };
      }
    };

    const getStrategyWeight: Tool = {
      name: 'getStrategyWeight',
      description: '获取策略权重',
      category: 'risk_control',
      inputSchema: { agentId: 'string' },
      outputSchema: { agentId: 'string', weight: 'number', winRate: 'number' },
      execute: async (input: ToolInputSchema) => {
        return { agentId: input.agentId as string, weight: 0.5, winRate: 0.55 };
      }
    };

    // Register all built-in tools
    const tools = [getRealtimeQuote, fetchKlineData, calculateRSI, calculateMA, placePaperTrade, validateRisk, getMarketRegime, getStrategyWeight];
    tools.forEach(tool => this.tools.set(tool.name, tool));
  }

  constructor() {
    this.initBuiltinTools();
  }
}

export const toolRegistry = new ToolRegistry();
export { ToolRegistry };
export type { Tool, ToolCategory, ToolInputSchema, ToolOutputSchema };