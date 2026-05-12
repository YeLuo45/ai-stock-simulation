/**
 * ScheduleEngine - Executes scheduled agent cycles
 */

import { Supervisor } from './Supervisor';
import { SchedulerStore, type ScheduleConfig } from './SchedulerStore';
import { NotificationService } from '../services/NotificationService';
import type { Position } from '../types';

export async function runScheduledCycle(config: ScheduleConfig): Promise<void> {
  // Update status to running
  SchedulerStore.updateScheduleStatus(config.id, { status: 'running' });

  try {
    // Get current portfolio state
    const positions: Position[] = [];
    let portfolioCash = 1000000;

    // Try to get portfolio from store if available
    try {
      const { useStore } = await import('../store');
      const store = useStore.getState();
      if (store.portfolio) {
        portfolioCash = store.portfolio.cash;
        positions.push(...store.portfolio.positions);
      }
    } catch {
      // Use defaults if store not available
    }

    // Run the supervisor cycle
    const result = await Supervisor.runCycle({
      candidates: config.stockPool,
      factors: config.factors,
      positions,
      portfolioCash,
    });

    // Extract result info
    const selectedSymbol = result.state.selectedSignal?.symbol;
    const totalReturn = result.state.backtestResult?.totalReturn;
    const sharpeRatio = result.state.backtestResult?.sharpeRatio;
    const error = result.state.errors.length > 0
      ? result.state.errors.map(e => e.message).join('; ')
      : undefined;

    // Calculate next run
    const nextRun = SchedulerStore.calculateNextRun(config);

    // Update store with results
    SchedulerStore.updateScheduleStatus(config.id, {
      status: error ? 'error' : 'success',
      lastRun: Date.now(),
      nextRun,
      lastResult: {
        selectedSymbol,
        totalReturn,
        sharpeRatio,
        error,
      },
    });

    // Send notification
    const message = error
      ? `执行失败: ${error}`
      : selectedSymbol
        ? `选股: ${selectedSymbol}, 收益率: ${totalReturn?.toFixed(2) ?? '--'}%, 夏普比率: ${sharpeRatio?.toFixed(2) ?? '--'}`
        : '执行完成，无选中股票';

    NotificationService.sendAlert({
      level: error ? 'critical' : 'warning',
      title: config.name,
      message,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';

    SchedulerStore.updateScheduleStatus(config.id, {
      status: 'error',
      lastRun: Date.now(),
      lastResult: { error: errorMsg },
    });

    NotificationService.sendAlert({
      level: 'critical',
      title: config.name,
      message: `执行异常: ${errorMsg}`,
    });
  }
}
