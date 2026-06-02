/**
 * AgentGroup - 并行执行编排器
 * 用于协调多个Agent并行执行，确保总时间 ≈ max(individual times) 而非 sum
 */

import type { PubSubBus, AgentEvent } from './PubSubBus';

export interface AgentTask {
  agentId: string;
  payload: unknown;
}

export interface AgentResult {
  agentId: string;
  success: boolean;
  data?: unknown;
  error?: string;
  duration: number;
}

export type TaskExecutor = (task: AgentTask, events: PubSubBus) => Promise<AgentResult>;

/**
 * AgentGroup - 管理一组Agent的并行执行
 */
export class AgentGroup {
  private groupName: string;
  private agentIds: string[];
  private defaultExecutor: TaskExecutor;

  constructor(groupName: string, agentIds: string[], executor?: TaskExecutor) {
    this.groupName = groupName;
    this.agentIds = agentIds;
    this.defaultExecutor = executor || this.createDefaultExecutor();
  }

  /**
   * 创建默认执行器（可以被覆盖）
   */
  private createDefaultExecutor(): TaskExecutor {
    return async (task: AgentTask): Promise<AgentResult> => {
      const startTime = Date.now();
      try {
        // Simulate agent execution - in real implementation, this would call the actual agent
        await new Promise(resolve => setTimeout(resolve, Math.random() * 50 + 10));
        return {
          agentId: task.agentId,
          success: true,
          data: { result: `Processed by ${task.agentId}` },
          duration: Date.now() - startTime,
        };
      } catch (error) {
        return {
          agentId: task.agentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        };
      }
    };
  }

  /**
   * 并行执行所有任务
   * @param tasks 任务列表
   * @param pubsub PubSubBus实例，用于Agent间通信
   * @returns 任务结果Map，key为agentId
   */
  async execute(tasks: AgentTask[], pubsub: PubSubBus): Promise<Map<string, unknown>> {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const startTime = Date.now();

    // Publish execution start event
    pubsub.publish({
      from: this.groupName,
      event: 'group_execution_start',
      payload: {
        groupName: this.groupName,
        agentIds: this.agentIds,
        taskCount: tasks.length,
      },
      timestamp: startTime,
      traceId,
    });

    // Execute all tasks in parallel
    const executionPromises = tasks.map(async (task) => {
      const taskStartTime = Date.now();
      try {
        // Publish task start event
        pubsub.publish({
          from: task.agentId,
          event: 'task_start',
          payload: { task, traceId },
          timestamp: taskStartTime,
          traceId,
        });

        // Execute the task
        const result = await this.defaultExecutor(task, pubsub);

        // Publish task complete event
        pubsub.publish({
          from: task.agentId,
          event: 'task_complete',
          payload: { task, result, traceId },
          timestamp: Date.now(),
          traceId,
        });

        return result;
      } catch (error) {
        const errorResult: AgentResult = {
          agentId: task.agentId,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - taskStartTime,
        };

        // Publish task error event
        pubsub.publish({
          from: task.agentId,
          event: 'task_error',
          payload: { task, error: errorResult.error, traceId },
          timestamp: Date.now(),
          traceId,
        });

        return errorResult;
      }
    });

    // Wait for all tasks to complete
    const results = await Promise.all(executionPromises);

    // Build results map
    const resultsMap = new Map<string, unknown>();
    for (const result of results) {
      if (result.success && result.data !== undefined) {
        resultsMap.set(result.agentId, result.data);
      } else if (!result.success) {
        resultsMap.set(result.agentId, { error: result.error });
      }
    }

    // Publish execution complete event
    pubsub.publish({
      from: this.groupName,
      event: 'group_execution_complete',
      payload: {
        groupName: this.groupName,
        results: Object.fromEntries(resultsMap),
        totalDuration: Date.now() - startTime,
        traceId,
      },
      timestamp: Date.now(),
      traceId,
    });

    return resultsMap;
  }

  /**
   * 串行执行（保底）
   */
  async executeSequential(tasks: AgentTask[], pubsub: PubSubBus): Promise<Map<string, unknown>> {
    const resultsMap = new Map<string, unknown>();

    for (const task of tasks) {
      try {
        const result = await this.defaultExecutor(task, pubsub);
        if (result.success && result.data !== undefined) {
          resultsMap.set(result.agentId, result.data);
        } else if (!result.success) {
          resultsMap.set(result.agentId, { error: result.error });
        }
      } catch (error) {
        resultsMap.set(task.agentId, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return resultsMap;
  }

  /**
   * 获取Group名称
   */
  getGroupName(): string {
    return this.groupName;
  }

  /**
   * 获取Agent ID列表
   */
  getAgentIds(): string[] {
    return [...this.agentIds];
  }
}

/**
 * Create a new AgentGroup instance
 */
export function createAgentGroup(groupName: string, agentIds: string[]): AgentGroup {
  return new AgentGroup(groupName, agentIds);
}

/**
 * AnalystGroup - 专门的分析师组（4个分析师并行）
 */
export function createAnalystGroup(): AgentGroup {
  return new AgentGroup('analyst_group', [
    'fundamental_analyst',
    'technical_analyst',
    'market_analyst',
    'sentiment_analyst',
  ]);
}

/**
 * ResearcherGroup - 专门的研究员组（2个研究员并行）
 */
export function createResearcherGroup(): AgentGroup {
  return new AgentGroup('researcher_group', [
    'data_researcher',
    'news_researcher',
  ]);
}