/**
 * 交易 Agent 自我进化记忆系统
 * 五层记忆：L0 实时行情 → L1 当前会话 → L2 历史决策 → L3 策略池 → L4 市场模式库
 */

import { Dexie } from 'dexie';

// ============ Types ============

export interface TradingContext {
  sessionId: string;
  ticker: string;
  regime: string;
  inputs: Record<string, unknown>;
  decision?: TradingDecision;
  createdAt: number;
}

export interface TradingDecision {
  id: string;
  ticker: string;
  regime: string;
  strategy: string;
  action: 'buy' | 'sell' | 'hold';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  reasoning: string;
  timestamp: number;
}

export interface TradeOutcome {
  tradeId: string;
  action: 'buy' | 'sell' | 'hold';
  entryPrice: number;
  exitPrice?: number;
  pnl?: number;
  realized: boolean;
  timestamp: number;
}

export interface TradingSkill {
  id?: number;
  name: string;
  regime: string;
  tickerPattern?: string;
  entryConditions: string[];
  exitConditions: string[];
  stopLoss: number;
  takeProfit: number;
  useCount: number;
  successRate: number;
  avgPnL: number;
  lastUsed: number;
  createdAt: number;
}

export interface MarketMemory {
  id?: number;
  ticker: string;
  regime: string;
  pattern: string;
  summary: string;
  skills?: TradingSkill[];
  createdAt: number;
  lastAccessed?: number;
}

// ============ TradingMemoryManager ============

export class TradingMemoryManager {
  private db: TradingDB | null = null;

  private async getDb(): Promise<TradingDB> {
    if (!this.db) {
      this.db = new TradingDB();
    }
    return this.db;
  }

  async rememberTrade(context: TradingContext): Promise<void> {
    const db = await this.getDb();
    await db.trading_session.add({
      ...context,
      createdAt: Date.now(),
    });
  }

  async crystallizeDecision(decision: TradingDecision, outcome: TradeOutcome): Promise<TradingSkill | null> {
    if (!outcome.realized || outcome.pnl === undefined) return null;

    const db = await this.getDb();
    const skill: TradingSkill = {
      name: `${decision.strategy}_${decision.ticker}`,
      regime: decision.regime,
      tickerPattern: decision.ticker,
      entryConditions: [decision.reasoning],
      exitConditions: [],
      stopLoss: decision.stopLoss,
      takeProfit: decision.takeProfit,
      useCount: 1,
      successRate: outcome.pnl > 0 ? 1.0 : 0.0,
      avgPnL: outcome.pnl,
      lastUsed: Date.now(),
      createdAt: Date.now(),
    };

    await db.trading_skills.add(skill);
    return skill;
  }

  async recallRegimeHistory(regime: string): Promise<MarketMemory[]> {
    const db = await this.getDb();
    return db.market_memory.where('regime').equals(regime).toArray();
  }

  async findBestStrategy(ticker: string, regime: string): Promise<TradingSkill | null> {
    const db = await this.getDb();
    const skills = await db.trading_skills
      .where('regime')
      .equals(regime)
      .toArray();

    if (skills.length === 0) return null;

    const matched = skills
      .filter(s => !s.tickerPattern || s.tickerPattern === ticker || ticker.includes(s.tickerPattern))
      .sort((a, b) => {
        const aScore = a.useCount * a.successRate * (a.avgPnL > 0 ? 1.5 : 1);
        const bScore = b.useCount * b.successRate * (b.avgPnL > 0 ? 1.5 : 1);
        return bScore - aScore;
      });

    if (matched.length > 0) {
      const best = matched[0];
      await db.trading_skills.update(best.id!, { useCount: best.useCount + 1, lastUsed: Date.now() });
      return best;
    }

    return null;
  }

  async compactSession(sessionId: string): Promise<string> {
    const db = await this.getDb();
    const sessions = await db.trading_session.where('sessionId').equals(sessionId).toArray();

    if (sessions.length === 0) return '';

    const summary = sessions.map(s =>
      `${s.ticker} ${s.decision?.action || 'pending'} @ ${s.decision?.entryPrice || 'N/A'}`
    ).join(' | ');

    await db.market_memory.add({
      ticker: sessions[0]?.ticker || 'UNKNOWN',
      regime: sessions[0]?.regime || 'unknown',
      pattern: 'session_summary',
      summary,
      createdAt: Date.now(),
    });

    await db.trading_session.where('sessionId').equals(sessionId).delete();

    return summary;
  }

  async evolveStrategyPool(): Promise<void> {
    const db = await this.getDb();
    const decisions = await db.decision_history.toArray();

    const strategyStats = new Map<string, { wins: number; losses: number; total: number }>();

    for (const d of decisions) {
      const key = `${d.strategy}_${d.regime}`;
      if (!strategyStats.has(key)) {
        strategyStats.set(key, { wins: 0, losses: 0, total: 0 });
      }
      const stats = strategyStats.get(key)!;
      stats.total++;
      if ((d as any).pnl > 0) stats.wins++;
      else if ((d as any).pnl < 0) stats.losses++;
    }

    for (const [key, stats] of strategyStats) {
      const [strategy, regime] = key.split('_');
      const skill = await db.trading_skills.where({ regime }).first();
      if (skill) {
        const successRate = stats.total > 0 ? stats.wins / stats.total : 0.5;
        await db.trading_skills.update(skill.id!, { successRate });
      }
    }
  }

  // Dream Market Learn
  async dreamMarketLearn(): Promise<void> {
    const db = await this.getDb();
    const sessions = await db.dream_sessions.where('compressed').equals(0).toArray();

    for (const session of sessions) {
      const summary = await this.compressSession(session);
      const patterns = await this.extractMarketPatterns(session);
      const skills = await this.generateTradingSkills(session);

      await db.market_memory.add({
        ticker: (session as any).ticker || 'UNKNOWN',
        regime: (session as any).regime || 'unknown',
        pattern: patterns.join(', '),
        summary,
        skills,
        createdAt: Date.now(),
      });

      await db.dream_sessions.update(session.id!, { compressed: 1 });
    }
  }

  private async compressSession(session: any): Promise<string> {
    const events = (session as any).events || [];
    const texts = events.filter((e: any) => typeof e.data === 'string').map((e: any) => e.data as string);
    return texts.slice(0, 5).join(' | ').slice(0, 300);
  }

  private async extractMarketPatterns(session: any): Promise<string[]> {
    return ['trend_following', 'mean_reversion'];
  }

  private async generateTradingSkills(session: any): Promise<TradingSkill[]> {
    return [];
  }
}

// ============ Dexie DB ============

class TradingDB extends Dexie {
  trading_session!: TradingContext[];
  decision_history!: TradingDecision[];
  strategy_stats!: any[];
  market_memory!: MarketMemory[];
  trading_skills!: TradingSkill[];
  dream_sessions!: any[];

  constructor() {
    super('TradingSimDB');
    this.version(41).stores({
      trading_session: '++id, sessionId, ticker, regime, createdAt',
      decision_history: '++id, ticker, regime, strategy, action, timestamp',
      strategy_stats: '++id, strategy, regime, wins, losses, total',
      market_memory: '++id, ticker, regime, pattern, summary, createdAt',
      trading_skills: '++id, name, regime, tickerPattern, useCount, successRate, avgPnL, lastUsed',
      dream_sessions: '++id, sessionId, summary, compressed, createdAt',
    });
  }
}

export const tradingMemoryManager = new TradingMemoryManager();