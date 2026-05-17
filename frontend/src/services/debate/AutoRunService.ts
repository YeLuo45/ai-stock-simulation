/**
 * AutoRun Debate Service - 无人值守辩论触发器
 * Detects time window and triggers DebateSupervisor
 */

import { DebateSupervisor, type DebateSupervisorPayload } from './DebateSupervisor';
import { getDebateHistory, appendDebateHistory } from './DebateMemory';
import type { DebateResult, DebateConfig } from './types';
import { DEFAULT_DEBATE_CONFIG, AUTO_RUN_CONFIG_KEY } from './types';
import { load, save, DEFAULT_STOCKS } from '../storage';
import { NotificationService } from '../NotificationService';

let checkInterval: ReturnType<typeof setInterval> | null = null;
let lastTriggerDate: string | null = null;

/**
 * Load auto-run configuration
 */
export function getAutoRunConfig(): DebateConfig {
  return load<DebateConfig>(AUTO_RUN_CONFIG_KEY, DEFAULT_DEBATE_CONFIG);
}

/**
 * Save auto-run configuration
 */
export function saveAutoRunConfig(config: DebateConfig): void {
  save(AUTO_RUN_CONFIG_KEY, config);
}

/**
 * Check if current time is within the scheduled window
 * Default schedule: '0 15 * * 1-5' (weekdays 15:00-16:00)
 */
function isWithinSchedule(schedule: string): boolean {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const hour = now.getHours();
  const minute = now.getMinutes();

  // Check if weekday (Mon-Fri = 1-5)
  if (day === 0 || day === 6) return false;

  // Check if within 15:00-16:00
  if (hour === 15 && minute >= 0) return true;
  if (hour === 15 || (hour === 16 && minute === 0)) return true;

  return false;
}

/**
 * Check if already triggered today
 */
function hasTriggeredToday(): boolean {
  const today = new Date().toDateString();
  return lastTriggerDate === today;
}

/**
 * Mark as triggered today
 */
function markTriggered(): void {
  lastTriggerDate = new Date().toDateString();
}

/**
 * Get symbols to process (from watchlist or all stocks)
 */
function getSymbolsToProcess(marketScan: 'all' | 'watchlist'): string[] {
  // For now, use selected stocks from localStorage
  try {
    const selectedStocks = localStorage.getItem('selectedStocks');
    if (selectedStocks) {
      const stocks = JSON.parse(selectedStocks);
      if (Array.isArray(stocks) && stocks.length > 0) {
        return stocks.map((s: any) => s.symbol || s);
      }
    }
  } catch {
    // ignore
  }

  // Fallback to default stocks
  return DEFAULT_STOCKS.map((s: any) => s.symbol);
}

/**
 * Run auto debate for configured symbols
 */
export async function runAutoDebate(config: DebateConfig): Promise<DebateResult[]> {
  const { dryRun, confidenceThreshold, maxPositions, marketScan } = config;
  const symbols = getSymbolsToProcess(marketScan).slice(0, maxPositions);
  const results: DebateResult[] = [];

  for (const symbol of symbols) {
    const payload: DebateSupervisorPayload = {
      stockCode: symbol,
      analysisSummary: `自动分析 ${symbol}`,
      positions: [],
      portfolioCash: 1000000,
    };

    const { result, error } = await DebateSupervisor.run(payload);

    if (result && result.confidence >= confidenceThreshold) {
      results.push(result);

      // In dry-run mode, just record the decision
      if (!dryRun) {
        // TODO: Trigger ExecutorAgent for actual trades
        console.log(`[AutoRun] Would execute: ${result.tradeAction} ${symbol} (confidence: ${result.confidence})`);
      } else {
        console.log(`[DryRun] Decision: ${result.decision} ${symbol} (confidence: ${result.confidence})`);
      }

      // Send notification
      NotificationService.sendAlert({
        level: result.confidence >= 0.7 ? 'warning' : 'info',
        title: `辩论决策: ${symbol}`,
        message: `决策: ${result.decision}, 信心: ${(result.confidence * 100).toFixed(0)}%, 理由: ${result.reasoning.slice(0, 50)}...`,
      });
    } else if (error) {
      console.warn(`[AutoRun] Error for ${symbol}:`, error);
    }
  }

  return results;
}

/**
 * Start the auto-run checker
 * Checks every minute if within schedule and not yet triggered today
 */
export function startAutoRunChecker(): void {
  if (checkInterval) return;

  checkInterval = setInterval(async () => {
    const config = getAutoRunConfig();
    if (!config.enabled) return;
    if (hasTriggeredToday()) return;
    if (!isWithinSchedule(config.schedule)) return;

    // Mark as triggered first to avoid duplicate runs
    markTriggered();

    console.log('[AutoRun] Triggering scheduled debate...');
    try {
      const results = await runAutoDebate(config);
      NotificationService.sendAlert({
        level: 'info',
        title: '无人值守辩论完成',
        message: `已完成 ${results.length} 个标的的辩论评估`,
      });
    } catch (err) {
      console.error('[AutoRun] Failed:', err);
      NotificationService.sendAlert({
        level: 'critical',
        title: '无人值守辩论失败',
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  }, 60000); // Check every minute
}

/**
 * Stop the auto-run checker
 */
export function stopAutoRunChecker(): void {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
}

/**
 * Manually trigger a debate for a symbol
 */
export async function triggerDebate(
  symbol: string,
  analysisSummary: string = '',
  positions: any[] = [],
  portfolioCash: number = 1000000
): Promise<DebateResult | null> {
  const { result, error } = await DebateSupervisor.run({
    stockCode: symbol,
    analysisSummary,
    positions,
    portfolioCash,
  });

  if (error) {
    console.error(`[Debate] Error for ${symbol}:`, error);
    return null;
  }

  return result || null;
}

/**
 * Get current debate status for UI
 */
export function getDebateStatus(): {
  isRunning: boolean;
  lastDebate?: DebateResult;
  historyCount: number;
} {
  const history = getDebateHistory();
  return {
    isRunning: checkInterval !== null,
    lastDebate: history[0],
    historyCount: history.length,
  };
}