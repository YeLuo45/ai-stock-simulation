/**
 * Supervisor - Main Pipeline Orchestrator
 * Runs the complete pipeline: Selector → Backtester (parallel) → Risk Controller (parallel) → Executor
 * Uses MessageBus for inter-agent communication
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
import { clearAgentSession, getAgentSession } from './AgentSession';
import { SelectorAgent } from './SelectorAgent';
import { BacktesterAgent } from './BacktesterAgent';
import { RiskControllerAgent } from './RiskControllerAgent';
import { ExecutorAgent } from './ExecutorAgent';
import { DataResearcherAgent } from './DataResearcherAgent';
import { saveAgentMemory, addToOutcomeQueue } from './AgentMemory';
import { AgentConversationStore } from './AgentConversationStore';
import { getPaperTradeEngine } from './PaperTradeEngine';
import { NotificationService } from '../services/NotificationService';
import { messageBus } from './MessageBus';
import { Phase } from '../types/AgentState';
import type { Position, FactorScreenerResult } from '../types';
import type { ResearchResult } from '../types/DataSource';

export interface SupervisorConfig {
  candidates: string[];
  factors: Array<{ factor_id: string; weight: number; direction: 'long' | 'short' }>;
  positions: Position[];
  portfolioCash: number;
  maxDrawdownThreshold?: number;
  maxCandidates?: number;  // Max parallel candidates, default 5
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
    const maxCandidates = config.maxCandidates || 5;

    // Initialize MessageBus conversation state
    messageBus.createConversation(traceId, ['supervisor', 'selector', 'backtester', 'risk', 'executor']);
    messageBus.transitionPhase(traceId, Phase.DATA_RESEARCH);

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
    let selectorCandidates: FactorScreenerResult[] = [];
    try {
      const selectorStart = Date.now();
      const selectorRequest = createAgentMessage(
        'supervisor',
        'selector',
        'request',
        { candidates: config.candidates, factors: config.factors, limit: maxCandidates },
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
          candidates?: FactorScreenerResult[];
          duration: number;
        };
        selectorCandidates = responseData.candidates || [];
        state.selectedSignal = responseData.topSignal;
        state.parallelCandidates = selectorCandidates.map(c => ({
          symbol: c.symbol,
          score: c.composite_score,
          reason: `综合评分 ${c.composite_score.toFixed(3)}，排名第 ${c.rank}`,
          timestamp: Date.now(),
        }));
        logPipelineEntry(
          traceId,
          'selector',
          'select',
          selectorDuration,
          state.selectedSignal
            ? `Selected ${state.selectedSignal.symbol} (score: ${state.selectedSignal.score.toFixed(3)}) from ${selectorCandidates.length} candidates`
            : `No signal selected, ${selectorCandidates.length} candidates available`
        );
      }
    } catch (err) {
      selectorDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('selector', 'error', selectorDuration, errorMsg);
      state.errors.push({ agent: 'selector', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'selector', 'select', selectorDuration, `Error: ${errorMsg}`);
      messageBus.setError(traceId, errorMsg);
      messageBus.transitionPhase(traceId, Phase.FAILED);
    }

    if (selectorCandidates.length === 0) {
      state.endTime = Date.now();
      savePipelineState(state);
      clearAgentSession(traceId);
      messageBus.transitionPhase(traceId, Phase.COMPLETED);
      return { state, logs: [] };
    }

    // Transition to ANALYSIS phase
    messageBus.transitionPhase(traceId, Phase.ANALYSIS);

    // Take top N candidates for parallel processing
    const topCandidates = selectorCandidates.slice(0, maxCandidates);

    // Step 2: Parallel Backtester
    let backtesterDuration = 0;
    const backtestMap = new Map<string, BacktestResultPayload>();
    try {
      const backtesterStart = Date.now();

      // Execute backtester in parallel for all top candidates
      const backtestPromises = topCandidates.map(candidate =>
        BacktesterAgent.process(createAgentMessage(
          'supervisor',
          'backtester',
          'request',
          { symbol: candidate.symbol, action: 'buy' },
          traceId
        ))
      );
      const backtestResponses = await Promise.all(backtestPromises);
      backtesterDuration = Date.now() - backtesterStart;

      // Parse results into symbol -> result map
      for (const [i, response] of backtestResponses.entries()) {
        if (response.type === 'response') {
          backtestMap.set(topCandidates[i].symbol, response.payload as BacktestResultPayload);
        } else if (response.type === 'error') {
          // Mark as failed if error response
          backtestMap.set(topCandidates[i].symbol, {
            symbol: topCandidates[i].symbol,
            passed: false,
            reason: (response.payload as { error: string }).error || 'Backtester error',
          });
        }
      }

      state.parallelBacktestResults = Array.from(backtestMap.values());
      updateAgentRun('backtester', 'success', backtesterDuration);

      const passedCount = Array.from(backtestMap.values()).filter(r => r.passed).length;
      logPipelineEntry(
        traceId,
        'backtester',
        'backtest_parallel',
        backtesterDuration,
        `Backtested ${topCandidates.length} candidates, ${passedCount} passed`
      );
    } catch (err) {
      backtesterDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('backtester', 'error', backtesterDuration, errorMsg);
      state.errors.push({ agent: 'backtester', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'backtester', 'backtest_parallel', backtesterDuration, `Error: ${errorMsg}`);
    }

    // Step 3: Parallel Risk Controller
    let riskDuration = 0;
    const riskMap = new Map<string, RiskResultPayload>();
    // Only run risk check on candidates that passed backtest
    const riskEligibleCandidates = topCandidates.filter(c => {
      const bt = backtestMap.get(c.symbol);
      return bt?.passed;
    });

    try {
      const riskStart = Date.now();

      if (riskEligibleCandidates.length > 0) {
        const riskPromises = riskEligibleCandidates.map(candidate =>
          RiskControllerAgent.process(createAgentMessage(
            'supervisor',
            'risk',
            'request',
            {
              symbol: candidate.symbol,
              action: 'buy',
              quantity: 100,
              price: 100,
              positions: config.positions,
              portfolioCash: config.portfolioCash,
              maxDrawdownThreshold: config.maxDrawdownThreshold ?? -0.1,
            },
            traceId
          ))
        );
        const riskResponses = await Promise.all(riskPromises);

        // Parse results into symbol -> result map
        for (const [i, response] of riskResponses.entries()) {
          if (response.type === 'response') {
            riskMap.set(riskEligibleCandidates[i].symbol, response.payload as RiskResultPayload);
          } else if (response.type === 'error') {
            // Mark as unknown if error response
            riskMap.set(riskEligibleCandidates[i].symbol, {
              approved: false,
              reason: (response.payload as { error: string }).error || 'Risk controller error',
            });
          }
        }
      }

      riskDuration = Date.now() - riskStart;
      state.parallelRiskResults = Array.from(riskMap.values());
      updateAgentRun('risk', 'success', riskDuration);

      const approvedCount = Array.from(riskMap.values()).filter(r => r.approved).length;
      logPipelineEntry(
        traceId,
        'risk',
        'risk_check_parallel',
        riskDuration,
        `Risk checked ${riskEligibleCandidates.length} candidates, ${approvedCount} approved`
      );
    } catch (err) {
      riskDuration = Date.now() - cycleStartTime;
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      updateAgentRun('risk', 'error', riskDuration, errorMsg);
      state.errors.push({ agent: 'risk', message: errorMsg, timestamp: Date.now() });
      logPipelineEntry(traceId, 'risk', 'risk_check_parallel', riskDuration, `Error: ${errorMsg}`);
    }

    // Step 3.5: 综合评分选最优
    // Filter candidates that passed both backtest and risk
    const validCandidates = topCandidates.filter(c => {
      const bt = backtestMap.get(c.symbol);
      const risk = riskMap.get(c.symbol);
      return bt?.passed && risk?.approved;
    });

    if (validCandidates.length === 0) {
      // No valid candidates, pipeline terminates
      state.endTime = Date.now();
      savePipelineState(state);
      clearAgentSession(traceId);
      messageBus.transitionPhase(traceId, Phase.COMPLETED);
      return { state, logs: [] };
    }

    // Select best candidate by selector score (composite_score)
    validCandidates.sort((a, b) => b.composite_score - a.composite_score);
    const selectedCandidate = validCandidates[0];

    // Transition to EXECUTION phase
    messageBus.transitionPhase(traceId, Phase.EXECUTION);

    state.selectedSignal = {
      symbol: selectedCandidate.symbol,
      score: selectedCandidate.composite_score,
      reason: `并行筛选：综合评分最高 (${selectedCandidate.composite_score.toFixed(3)})`,
      timestamp: Date.now(),
    };
    state.selectedForExecution = state.selectedSignal;

    // Set single backtestResult and riskResult for backward compatibility
    state.backtestResult = backtestMap.get(selectedCandidate.symbol);
    state.riskResult = riskMap.get(selectedCandidate.symbol);

    // Send risk alert if trade was rejected by risk controller
    if (state.riskResult?.approved === false) {
      NotificationService.sendAlert({
        level: 'critical',
        title: '风控拒绝交易',
        message: state.riskResult.reason || '风险检查未通过，交易被拒绝',
        metadata: {
          symbol: selectedCandidate.symbol,
          reasonCode: state.riskResult.reasonCode?.code,
        },
      });
    }

    // Send warning if drawdown exceeds 1.5x threshold
    if (state.riskResult?.drawdown !== undefined) {
      const drawdownThreshold = config.maxDrawdownThreshold ?? -0.1;
      if (state.riskResult.drawdown < drawdownThreshold * 1.5) {
        NotificationService.sendAlert({
          level: 'warning',
          title: '回撤超限警告',
          message: `当前回撤 ${(state.riskResult.drawdown * 100).toFixed(1)}% 超过阈值`,
          metadata: {
            drawdown: state.riskResult.drawdown,
            threshold: drawdownThreshold,
          },
        });
      }
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

        // Paper Trade: simulate the execution
        if (state.selectedSignal && state.executionResult?.success) {
          try {
            const engine = getPaperTradeEngine();
            const symbol = state.selectedSignal.symbol;
            const name = (state.selectedSignal as any).name || symbol;
            const qty = state.executionResult.quantity || 100;
            const price = state.executionResult.price || 100;
            engine.openOrder(symbol, name, 'buy', qty, price, traceId);
            // Save comparison with backtest result
            if (state.backtestResult) {
              const snap = engine.getSnapshot(traceId);
              const stored = {
                paperTrade: snap,
                backtest: {
                  totalReturn: state.backtestResult.totalReturn || 0,
                  sharpeRatio: state.backtestResult.sharpeRatio || 0,
                  maxDrawdown: state.backtestResult.maxDrawdown || 0,
                  winRate: state.backtestResult.winRate || 0,
                },
                traceId,
              };
              localStorage.setItem('paper_trade_snapshots', JSON.stringify(stored));
            }
            logPipelineEntry(traceId, 'executor', 'paper_trade', 0, `Paper trade: buy ${qty} ${symbol} @ ${price}`);
          } catch (ptErr) {
            console.warn('[PaperTrade] Failed to record paper trade:', ptErr);
          }
        }
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

    // Finalize with COMPLETED phase
    if (state.errors.length > 0) {
      messageBus.setError(traceId, `Pipeline completed with ${state.errors.length} error(s)`);
      messageBus.transitionPhase(traceId, Phase.FAILED);
    } else {
      messageBus.transitionPhase(traceId, Phase.COMPLETED);
    }

    const totalDuration = state.endTime - cycleStartTime;
    logPipelineEntry(
      traceId,
      'supervisor',
      'cycle_complete',
      totalDuration,
      `Pipeline completed. Selected: ${state.selectedSignal?.symbol}. Errors: ${state.errors.length}`
    );

    // Save to agent memory before clearing session
    const session = getAgentSession(traceId);
    if (session) {
      // Get conversation history for each agent
      const selectorConversation = AgentConversationStore.getConversation(traceId, 'selector');
      const backtesterConversation = AgentConversationStore.getConversation(traceId, 'backtester');
      const riskConversation = AgentConversationStore.getConversation(traceId, 'risk');
      const executorConversation = AgentConversationStore.getConversation(traceId, 'executor');

      const memory = {
        sessionId: traceId,
        timestamp: Date.now(),
        agents: {
          selector: session.selectorOutput?.parsedOutput ? {
            symbol: state.selectedSignal?.symbol || '',
            score: state.selectedSignal?.score || 0,
            reason: (session.selectorOutput.parsedOutput as { reason?: string })?.reason || '',
            llmResponse: session.selectorOutput.llmResponse || '',
            tokens: session.selectorOutput.usage,
            conversation: selectorConversation,
          } : undefined,
          backtester: session.backtesterOutput?.parsedOutput ? {
            passed: state.backtestResult?.passed || false,
            reason: state.backtestResult?.reason || '',
            llmResponse: session.backtesterOutput.llmResponse || '',
            metrics: state.backtestResult?.metrics,
            conversation: backtesterConversation,
          } : undefined,
          risk: session.riskOutput?.parsedOutput ? {
            approved: state.riskResult?.approved || false,
            reason: state.riskResult?.reason || '',
            llmResponse: session.riskOutput.llmResponse || '',
            conversation: riskConversation,
          } : undefined,
          executor: session.executorOutput?.parsedOutput ? {
            success: state.executionResult?.success || false,
            executedQuantity: state.executionResult?.executedQuantity || 0,
            executedPrice: state.executionResult?.executedPrice || 0,
            llmResponse: session.executorOutput.llmResponse || '',
            conversation: executorConversation,
          } : undefined,
        },
        tags: [],
      };

      // Only save if we have meaningful data
      if (memory.agents.selector || memory.agents.backtester || memory.agents.risk || memory.agents.executor) {
        const memoryId = saveAgentMemory(memory);

        // Add to outcome tracking queue if executor succeeded
        if (memory.agents.executor?.success) {
          addToOutcomeQueue({
            memoryId,
            symbol: state.selectedSignal?.symbol || memory.agents.selector?.symbol || '',
            entryPrice: state.executionResult?.executedPrice || memory.agents.executor.executedPrice,
            entryDate: Date.now(),
          });
        }
      }
    }

    clearAgentSession(traceId);

    return { state, logs: [] };
  },
};
