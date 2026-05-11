/**
 * Supervisor - Main Pipeline Orchestrator
 * Runs the complete pipeline: Selector → Backtester → Risk Controller → Executor
 */

import type {
  AgentName,
  PipelineState,
  PipelineLogEntry,
  SelectedSignal,
  BacktestResultPayload,
  RiskResultPayload,
  ExecutionResultPayload,
} from './messages';
import { createAgentMessage, createTraceId } from './messages';
import { updateAgentRun, addPipelineLog, savePipelineState } from './agentStorage';
import { clearAgentSession } from './AgentSession';
import { SelectorAgent } from './SelectorAgent';
import { BacktesterAgent } from './BacktesterAgent';
import { RiskControllerAgent } from './RiskControllerAgent';
import { ExecutorAgent } from './ExecutorAgent';
import type { Position } from '../types';

export interface SupervisorConfig {
  candidates: string[];
  factors: Array<{ factor_id: string; weight: number; direction: 'long' | 'short' }>;
  positions: Position[];
  portfolioCash: number;
  maxDrawdownThreshold?: number;
}

export interface RunCycleResult {
  state: PipelineState;
  logs: PipelineLogEntry[];
}

function logPipelineEntry(
  traceId: string,
  agent: AgentName | 'supervisor',
  action: string,
  duration: number,
  details?: string
): PipelineLogEntry {
  const entry: PipelineLogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    traceId,
    agent,
    action,
    duration,
    timestamp: Date.now(),
    details,
  };
  addPipelineLog(entry);
  return entry;
}

export const Supervisor = {
  name: 'supervisor' as const,

  async runCycle(config: SupervisorConfig): Promise<RunCycleResult> {
    const traceId = createTraceId();
    const cycleStartTime = Date.now();

    const state: PipelineState = {
      traceId,
      candidates: config.candidates,
      selectedSignal: undefined,
      backtestResult: undefined,
      riskResult: undefined,
      executionResult: undefined,
      errors: [],
      startTime: cycleStartTime,
    };

    // Step 1: Selector
    let selectorDuration = 0;
    try {
      const selectorStart = Date.now();
      const selectorRequest = createAgentMessage(
        'supervisor',
        'selector',
        'request',
        { candidates: config.candidates, factors: config.factors, limit: 5 },
        traceId
      );
      const selectorResponse = await SelectorAgent.process(selectorRequest);
      selectorDuration = Date.now() - selectorStart;

      updateAgentRun('selector', 'success', selectorDuration);

      if (selectorResponse.type === 'error') {
        state.errors.push({
          agent: 'selector',
          message: (selectorResponse.payload as { error: string }).error || 'Selector error',
          timestamp: Date.now(),
        });
        logPipelineEntry(traceId, 'selector', 'select', selectorDuration, 'Error in selector');
      } else {
        const responseData = selectorResponse.payload as {
          topSignal?: SelectedSignal;
          duration: number;
        };
        state.selectedSignal = responseData.topSignal;
        logPipelineEntry(
          traceId,
          'selector',
          'select',
          selectorDuration,
          state.selectedSignal
            ? `Selected ${state.selectedSignal.symbol} (score: ${state.selectedSignal.score.toFixed(3)})`
            : 'No signal selected'
        );
      }
    } catch (err) {
      selectorDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('selector', 'error', selectorDuration, errorMsg);
      state.errors.push({ agent: 'selector', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'selector', 'select', selectorDuration, `Error: ${errorMsg}`);
    }

    if (!state.selectedSignal) {
      state.endTime = Date.now();
      savePipelineState(state);
      clearAgentSession(traceId);
      return { state, logs: [] };
    }

    // Step 2: Backtester
    let backtesterDuration = 0;
    try {
      const backtesterStart = Date.now();
      const backtesterRequest = createAgentMessage(
        'supervisor',
        'backtester',
        'request',
        { symbol: state.selectedSignal.symbol, action: 'buy' },
        traceId
      );
      const backtesterResponse = await BacktesterAgent.process(backtesterRequest);
      backtesterDuration = Date.now() - backtesterStart;

      updateAgentRun('backtester', 'success', backtesterDuration);

      if (backtesterResponse.type === 'error') {
        state.errors.push({
          agent: 'backtester',
          message: (backtesterResponse.payload as { error: string }).error || 'Backtester error',
          timestamp: Date.now(),
        });
        logPipelineEntry(traceId, 'backtester', 'backtest', backtesterDuration, 'Error in backtester');
      } else {
        const responseData = backtesterResponse.payload as BacktestResultPayload & { duration: number };
        state.backtestResult = responseData;
        logPipelineEntry(
          traceId,
          'backtester',
          'backtest',
          backtesterDuration,
          `${state.backtestResult.passed ? 'PASSED' : 'FAILED'}: ${state.backtestResult.reason}`
        );
      }
    } catch (err) {
      backtesterDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('backtester', 'error', backtesterDuration, errorMsg);
      state.errors.push({ agent: 'backtester', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'backtester', 'backtest', backtesterDuration, `Error: ${errorMsg}`);
    }

    // Step 3: Risk Controller
    let riskDuration = 0;
    try {
      const riskStart = Date.now();
      const riskRequest = createAgentMessage(
        'supervisor',
        'risk',
        'request',
        {
          symbol: state.selectedSignal.symbol,
          action: 'buy',
          quantity: 100,
          price: 100,
          positions: config.positions,
          portfolioCash: config.portfolioCash,
          maxDrawdownThreshold: config.maxDrawdownThreshold ?? -0.1,
        },
        traceId
      );
      const riskResponse = await RiskControllerAgent.process(riskRequest);
      riskDuration = Date.now() - riskStart;

      updateAgentRun('risk', 'success', riskDuration);

      if (riskResponse.type === 'error') {
        state.errors.push({
          agent: 'risk',
          message: (riskResponse.payload as { error: string }).error || 'Risk error',
          timestamp: Date.now(),
        });
        logPipelineEntry(traceId, 'risk', 'risk_check', riskDuration, 'Error in risk controller');
      } else {
        const responseData = riskResponse.payload as RiskResultPayload & { duration: number };
        state.riskResult = responseData;
        logPipelineEntry(
          traceId,
          'risk',
          'risk_check',
          riskDuration,
          `${state.riskResult.approved ? 'APPROVED' : 'REJECTED'}: ${state.riskResult.reason}`
        );
      }
    } catch (err) {
      riskDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('risk', 'error', riskDuration, errorMsg);
      state.errors.push({ agent: 'risk', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'risk', 'risk_check', riskDuration, `Error: ${errorMsg}`);
    }

    if (!state.riskResult?.approved) {
      state.endTime = Date.now();
      savePipelineState(state);
      clearAgentSession(traceId);
      return { state, logs: [] };
    }

    // Step 4: Executor
    let executorDuration = 0;
    try {
      const executorStart = Date.now();
      const executorRequest = createAgentMessage(
        'supervisor',
        'executor',
        'request',
        {
          symbol: state.selectedSignal.symbol,
          action: 'buy',
          quantity: 100,
          price: 100,
          accountId: 1,
        },
        traceId
      );
      const executorResponse = await ExecutorAgent.process(executorRequest);
      executorDuration = Date.now() - executorStart;

      updateAgentRun('executor', 'success', executorDuration);

      if (executorResponse.type === 'error') {
        state.errors.push({
          agent: 'executor',
          message: (executorResponse.payload as { error: string }).error || 'Executor error',
          timestamp: Date.now(),
        });
        logPipelineEntry(traceId, 'executor', 'execute', executorDuration, 'Error in executor');
      } else {
        const responseData = executorResponse.payload as ExecutionResultPayload & { duration: number };
        state.executionResult = responseData;
        logPipelineEntry(
          traceId,
          'executor',
          'execute',
          executorDuration,
          `${state.executionResult.success ? 'SUCCESS' : 'FAILED'}: ${state.executionResult.error || 'Trade executed'}`
        );
      }
    } catch (err) {
      executorDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('executor', 'error', executorDuration, errorMsg);
      state.errors.push({ agent: 'executor', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'executor', 'execute', executorDuration, `Error: ${errorMsg}`);
    }

    state.endTime = Date.now();
    savePipelineState(state);

    const totalDuration = state.endTime - cycleStartTime;
    logPipelineEntry(
      traceId,
      'supervisor',
      'cycle_complete',
      totalDuration,
      `Pipeline completed. Errors: ${state.errors.length}`
    );

    clearAgentSession(traceId);

    return { state, logs: [] };
  },
};
