/**
 * AgentGroup Tests - ≥99% coverage
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentGroup, createAgentGroup, createAnalystGroup, createResearcherGroup, AgentTask, AgentResult } from '../coordination/AgentGroup';
import { PubSubBus } from '../coordination/PubSubBus';

describe('AgentGroup', () => {
  let bus: PubSubBus;

  beforeEach(() => {
    bus = new PubSubBus();
  });

  describe('constructor', () => {
    it('should create an AgentGroup with name and agent IDs', () => {
      const group = new AgentGroup('test_group', ['agent1', 'agent2']);
      expect(group).toBeInstanceOf(AgentGroup);
      expect(group.getGroupName()).toBe('test_group');
      expect(group.getAgentIds()).toEqual(['agent1', 'agent2']);
    });

    it('should create AgentGroup without custom executor', () => {
      const group = new AgentGroup('test_group', ['agent1']);
      expect(group).toBeInstanceOf(AgentGroup);
    });

    it('should create AgentGroup with custom executor', () => {
      const customExecutor = async () => ({ agentId: 'test', success: true, duration: 10 });
      const group = new AgentGroup('test_group', ['agent1'], customExecutor);
      expect(group).toBeInstanceOf(AgentGroup);
    });
  });

  describe('getGroupName', () => {
    it('should return the group name', () => {
      const group = new AgentGroup('my_group', ['a', 'b']);
      expect(group.getGroupName()).toBe('my_group');
    });
  });

  describe('getAgentIds', () => {
    it('should return a copy of agent IDs', () => {
      const group = new AgentGroup('g', ['a', 'b', 'c']);
      const ids = group.getAgentIds();
      expect(ids).toEqual(['a', 'b', 'c']);
      // Ensure it's a copy, not a reference
      ids.push('d');
      expect(group.getAgentIds()).toEqual(['a', 'b', 'c']);
    });
  });

  describe('execute', () => {
    it('should execute tasks in parallel using Promise.all', async () => {
      // Create a mock executor that simulates varying execution times
      const executor = async (task: AgentTask): Promise<AgentResult> => {
        await new Promise(resolve => setTimeout(resolve, 20));
        return { agentId: task.agentId, success: true, data: { processed: true }, duration: 20 };
      };

      const group = new AgentGroup('test_group', ['a', 'b'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
      ];

      const startTime = Date.now();
      const results = await group.execute(tasks, bus);
      const elapsed = Date.now() - startTime;

      // Both should have results
      expect(results.has('a')).toBe(true);
      expect(results.has('b')).toBe(true);

      // Parallel execution means total time should be ~20ms, not 40ms
      // Allow some buffer for overhead
      expect(elapsed).toBeLessThan(100);
    });

    it('should return Map with agentId keys containing result data', async () => {
      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        data: { value: task.agentId },
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['agent1'], executor);
      const tasks: AgentTask[] = [{ agentId: 'agent1', payload: {} }];

      const results = await group.execute(tasks, bus);

      expect(results).toBeInstanceOf(Map);
      expect(results.get('agent1')).toEqual({ value: 'agent1' });
    });

    it('should handle executor errors and store error in results', async () => {
      const executor = async (task: AgentTask): Promise<AgentResult> => {
        throw new Error('Execution failed');
      };

      const group = new AgentGroup('test_group', ['agent1'], executor);
      const tasks: AgentTask[] = [{ agentId: 'agent1', payload: {} }];

      const results = await group.execute(tasks, bus);

      expect(results.has('agent1')).toBe(true);
      const result = results.get('agent1') as { error?: string };
      expect(result.error).toBe('Execution failed');
    });

    it('should publish group_execution_start event', async () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['group_execution_start'], callback });

      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['a', 'b'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
      ];

      await group.execute(tasks, bus);

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0];
      expect(event.payload.groupName).toBe('test_group');
      expect(event.payload.taskCount).toBe(2);
    });

    it('should publish task_start event for each task', async () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['task_start'], callback });

      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['a', 'b'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
      ];

      await group.execute(tasks, bus);

      expect(callback).toHaveBeenCalledTimes(2);
    });

    it('should publish task_complete event for successful tasks', async () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['task_complete'], callback });

      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        data: { result: 'ok' },
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['a'], executor);
      const tasks: AgentTask[] = [{ agentId: 'a', payload: {} }];

      await group.execute(tasks, bus);

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0];
      expect(event.from).toBe('a');
    });

    it('should publish task_error event when task throws', async () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['task_error'], callback });

      const executor = async (): Promise<AgentResult> => {
        throw new Error('Task failed');
      };

      const group = new AgentGroup('test_group', ['a'], executor);
      const tasks: AgentTask[] = [{ agentId: 'a', payload: {} }];

      await group.execute(tasks, bus);

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0];
      expect(event.payload.error).toBe('Task failed');
    });

    it('should publish group_execution_complete event', async () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['group_execution_complete'], callback });

      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['a'], executor);
      const tasks: AgentTask[] = [{ agentId: 'a', payload: {} }];

      await group.execute(tasks, bus);

      expect(callback).toHaveBeenCalledTimes(1);
      const event = callback.mock.calls[0][0];
      expect(event.payload.groupName).toBe('test_group');
      expect(event.payload.totalDuration).toBeGreaterThanOrEqual(0);
    });

    it('should include traceId in published events', async () => {
      let publishedTraceId: string | undefined;
      bus.subscribe({ events: ['group_execution_start'], callback: (e) => {
        publishedTraceId = e.traceId;
      }});

      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['a'], executor);
      const tasks: AgentTask[] = [{ agentId: 'a', payload: {} }];

      await group.execute(tasks, bus);

      expect(publishedTraceId).toBeDefined();
      expect(publishedTraceId).toMatch(/^trace-\d+-[a-z0-9]+$/);
    });

    it('should handle empty tasks array', async () => {
      const executor = vi.fn();
      const group = new AgentGroup('test_group', [], executor);

      const results = await group.execute([], bus);

      expect(results.size).toBe(0);
      expect(executor).not.toHaveBeenCalled();
    });

    it('should handle mixed success/failure results', async () => {
      const executor = async (task: AgentTask): Promise<AgentResult> => {
        if (task.agentId === 'a') {
          return { agentId: task.agentId, success: true, data: { ok: true }, duration: 10 };
        }
        throw new Error('Task failed');
      };

      const group = new AgentGroup('test_group', ['a', 'b'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
      ];

      const results = await group.execute(tasks, bus);

      expect(results.get('a')).toEqual({ ok: true });
      const bResult = results.get('b') as { error?: string };
      expect(bResult.error).toBe('Task failed');
    });

    it('should use default executor when no custom executor provided', async () => {
      // The default executor returns { result: 'Processed by ${task.agentId}' }
      const group = new AgentGroup('test_group', ['agent1']);
      const tasks: AgentTask[] = [{ agentId: 'agent1', payload: {} }];

      const results = await group.execute(tasks, bus);

      expect(results).toBeInstanceOf(Map);
      const result = results.get('agent1');
      expect(result).toHaveProperty('result');
      expect((result as { result: string }).result).toContain('Processed by agent1');
    });
  });

  describe('executeSequential', () => {
    it('should execute tasks one by one in order', async () => {
      const executionOrder: string[] = [];

      const executor = async (task: AgentTask): Promise<AgentResult> => {
        executionOrder.push(task.agentId);
        return { agentId: task.agentId, success: true, duration: 10 };
      };

      const group = new AgentGroup('test_group', ['a', 'b', 'c'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
        { agentId: 'c', payload: {} },
      ];

      await group.executeSequential(tasks, bus);

      expect(executionOrder).toEqual(['a', 'b', 'c']);
    });

    it('should return results map with correct data', async () => {
      const executor = async (task: AgentTask): Promise<AgentResult> => ({
        agentId: task.agentId,
        success: true,
        data: { id: task.agentId },
        duration: 10,
      });

      const group = new AgentGroup('test_group', ['a', 'b'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
      ];

      const results = await group.executeSequential(tasks, bus);

      expect(results.get('a')).toEqual({ id: 'a' });
      expect(results.get('b')).toEqual({ id: 'b' });
    });

    it('should handle errors gracefully and continue to next task', async () => {
      let count = 0;
      const executor = async (task: AgentTask): Promise<AgentResult> => {
        count++;
        if (task.agentId === 'b') {
          throw new Error('Failed');
        }
        return { agentId: task.agentId, success: true, data: { ok: true }, duration: 10 };
      };

      const group = new AgentGroup('test_group', ['a', 'b', 'c'], executor);
      const tasks: AgentTask[] = [
        { agentId: 'a', payload: {} },
        { agentId: 'b', payload: {} },
        { agentId: 'c', payload: {} },
      ];

      const results = await group.executeSequential(tasks, bus);

      expect(results.get('a')).toEqual({ ok: true });
      expect((results.get('b') as { error?: string }).error).toBe('Failed');
      expect(results.get('c')).toEqual({ ok: true });
      expect(count).toBe(3);
    });
  });
});

describe('createAgentGroup', () => {
  it('should create an AgentGroup instance', () => {
    const group = createAgentGroup('my_group', ['a', 'b']);
    expect(group).toBeInstanceOf(AgentGroup);
    expect(group.getGroupName()).toBe('my_group');
    expect(group.getAgentIds()).toEqual(['a', 'b']);
  });
});

describe('createAnalystGroup', () => {
  it('should create analyst group with 4 analysts', () => {
    const group = createAnalystGroup();
    expect(group).toBeInstanceOf(AgentGroup);
    expect(group.getGroupName()).toBe('analyst_group');
    expect(group.getAgentIds()).toEqual([
      'fundamental_analyst',
      'technical_analyst',
      'market_analyst',
      'sentiment_analyst',
    ]);
  });
});

describe('createResearcherGroup', () => {
  it('should create researcher group with 2 researchers', () => {
    const group = createResearcherGroup();
    expect(group).toBeInstanceOf(AgentGroup);
    expect(group.getGroupName()).toBe('researcher_group');
    expect(group.getAgentIds()).toEqual([
      'data_researcher',
      'news_researcher',
    ]);
  });
});