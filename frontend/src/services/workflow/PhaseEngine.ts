/**
 * PhaseEngine - Phase Workflow Orchestrator
 * Coordinates the four-phase workflow: Scan → Analyze → Debate → Execute
 */
import { PhaseScan } from './PhaseScan';
import { PhaseAnalyze } from './PhaseAnalyze';
import { PhaseDebate } from './PhaseDebate';
import { PhaseExecute } from './PhaseExecute';
import { useWorkflowStore, type CurrentPhase } from './WorkflowStore';
import type { PhaseConfig, PhaseResult, WorkflowContext } from './types';
import { notificationService } from '../NotificationService';
import { messageBus, Channel } from '../messageBus';

const PHASE_ORDER: CurrentPhase[] = ['scan', 'analyze', 'debate', 'execute'];

export const PhaseEngine = {
  /**
   * Run the complete workflow
   * @param config - Phase configuration
   * @param context - Workflow context with candidates, positions, etc.
   */
  async run(config: PhaseConfig, context: WorkflowContext): Promise<PhaseResult[]> {
    const results: PhaseResult[] = [];
    const store = useWorkflowStore.getState();

    // Update store - starting workflow
    store.startWorkflow();
    notificationService.sendAlert({
      type: 'info',
      title: '工作流启动',
      message: 'Phase Workflow 已启动，开始执行 Scan → Analyze → Debate → Execute',
    });

    // Emit workflow:start event for event-driven workflow monitoring
    messageBus.emit(Channel.WORKFLOW_START, {
      phases: PHASE_ORDER,
      context,
      timestamp: Date.now(),
    });

    // Execute each phase in order
    for (const phase of PHASE_ORDER) {
      // Check if we should continue
      const currentState = useWorkflowStore.getState();
      if (!currentState.isRunning) {
        // Workflow was aborted
        break;
      }

      // Handle pause
      while (currentState.isPaused && !currentState.isSkipping) {
        await new Promise(resolve => setTimeout(resolve, 100));
        if (!useWorkflowStore.getState().isRunning) break;
      }

      // Handle skip
      if (useWorkflowStore.getState().isSkipping) {
        store.setCurrentPhase(phase);
        store.setProgress(((PHASE_ORDER.indexOf(phase) + 1) / PHASE_ORDER.length) * 100);
        useWorkflowStore.getState().resumeWorkflow();
        continue;
      }

      // Update current phase
      store.setCurrentPhase(phase);
      const phaseStartTime = Date.now();

      // Emit workflow:phase:start event
      messageBus.emit(Channel.WORKFLOW_PHASE_START, {
        phase,
        timestamp: phaseStartTime,
      });

      try {
        const result = await this.executePhase(phase, config, context, results);

        // Calculate duration
        result.duration = Date.now() - phaseStartTime;
        result.timestamp = Date.now();

        // Add result
        results.push(result);
        store.addPhaseResult(result);

        // Emit workflow:phase:complete event
        messageBus.emit(Channel.WORKFLOW_PHASE_COMPLETE, {
          phase,
          result,
          duration: result.duration,
          timestamp: result.timestamp,
        });

        // Send notification
        notificationService.sendAlert({
          type: result.success ? 'info' : 'error',
          title: `阶段完成: ${this.getPhaseName(phase)}`,
          message: result.message || `阶段 ${phase} 执行完成`,
        });

        // Update progress
        const phaseIndex = PHASE_ORDER.indexOf(phase);
        store.setProgress(((phaseIndex + 1) / PHASE_ORDER.length) * 100);

        // Check exit conditions
        if (!this.checkExitCondition(result, config, phase)) {
          notificationService.sendAlert({
            type: 'warning',
            title: '工作流提前终止',
            message: `阶段 ${this.getPhaseName(phase)} 退出条件不满足，终止流程`,
          });
          break;
        }
      } catch (err) {
        const errorResult: PhaseResult = {
          phase,
          status: 'failed',
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
          duration: Date.now() - phaseStartTime,
          timestamp: Date.now(),
        };
        results.push(errorResult);
        store.addPhaseResult(errorResult);
        
        // Emit workflow:error event
        messageBus.emit(Channel.WORKFLOW_ERROR, {
          phase,
          error: errorResult.error,
          timestamp: Date.now(),
        });
        
        break;
      }
    }

    // Workflow completed or terminated
    store.abortWorkflow();
    store.setLastRunTime(Date.now());

    // Emit workflow:complete event
    messageBus.emit(Channel.WORKFLOW_COMPLETE, {
      phases: PHASE_ORDER,
      results,
      totalDuration: results.reduce((sum, r) => sum + (r.duration || 0), 0),
      timestamp: Date.now(),
    });

    notificationService.sendAlert({
      type: 'success',
      title: '工作流完成',
      message: `Phase Workflow 执行完成，共 ${results.length} 个阶段`,
    });

    return results;
  },

  /**
   * Execute a single phase
   */
  async executePhase(
    phase: CurrentPhase,
    config: PhaseConfig,
    context: WorkflowContext,
    previousResults: PhaseResult[]
  ): Promise<PhaseResult> {
    // Build context for this phase from previous results
    const phaseContext = this.buildPhaseContext(phase, context, previousResults);

    switch (phase) {
      case 'scan':
        return PhaseScan.run(phaseContext, config.scan);
      case 'analyze':
        return PhaseAnalyze.run(phaseContext, config.analyze);
      case 'debate':
        return PhaseDebate.run(phaseContext, config.debate);
      case 'execute':
        return PhaseExecute.run(phaseContext, config.execute);
      default:
        return {
          phase: phase as any,
          status: 'failed',
          success: false,
          error: 'Unknown phase',
          timestamp: Date.now(),
        };
    }
  },

  /**
   * Build context for a phase from previous results
   */
  buildPhaseContext(
    phase: CurrentPhase,
    baseContext: WorkflowContext,
    previousResults: PhaseResult[]
  ): WorkflowContext {
    const ctx = { ...baseContext };

    for (const result of previousResults) {
      if (result.phase === 'scan' && result.data) {
        const scanData = result.data as any;
        ctx.candidates = scanData.candidates;
      }
      if (result.phase === 'analyze' && result.data) {
        const analyzeData = result.data as any;
        ctx.scoredCandidates = analyzeData.topCandidates;
      }
      if (result.phase === 'debate' && result.data) {
        const debateData = result.data as any;
        ctx.debateDecisions = debateData.decisions;
      }
    }

    return ctx;
  },

  /**
   * Check if the workflow should exit after this phase
   */
  checkExitCondition(result: PhaseResult, config: PhaseConfig, phase: CurrentPhase): boolean {
    if (!result.success) {
      return false;
    }

    switch (phase) {
      case 'scan': {
        const scanData = result.data as any;
        if (scanData && scanData.candidates?.length < config.scan.minCandidates) {
          return false;
        }
        break;
      }
      case 'analyze': {
        const analyzeData = result.data as any;
        // If no candidates passed IC threshold, exit
        if (analyzeData && (!analyzeData.topCandidates || analyzeData.topCandidates.length === 0)) {
          return false;
        }
        break;
      }
      case 'debate': {
        const debateData = result.data as any;
        // If confidence is too low, could exit
        if (debateData && debateData.avgConfidence < config.debate.confidenceThreshold) {
          // Warning but don't exit - still execute with low confidence
        }
        break;
      }
      case 'execute':
        // Always complete execute phase
        break;
    }

    return true;
  },

  /**
   * Get Chinese name for phase
   */
  getPhaseName(phase: CurrentPhase): string {
    const names: Record<CurrentPhase, string> = {
      idle: '空闲',
      scan: '市场扫描',
      analyze: '多因子分析',
      debate: '辩论决策',
      execute: '执行下单',
    };
    return names[phase];
  },

  /**
   * Run workflow with default config
   */
  async runDefault(context: WorkflowContext): Promise<PhaseResult[]> {
    const { config } = useWorkflowStore.getState();
    return this.run(config, context);
  },
};