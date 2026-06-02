/**
 * PubSubBus Tests - ≥99% coverage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PubSubBus, createPubSubBus, AgentEvent } from '../coordination/PubSubBus';

describe('PubSubBus', () => {
  let bus: PubSubBus;

  beforeEach(() => {
    bus = new PubSubBus();
  });

  afterEach(() => {
    bus.unsubscribe();
    bus.clearHistory();
  });

  describe('constructor', () => {
    it('should create a PubSubBus instance', () => {
      expect(bus).toBeInstanceOf(PubSubBus);
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a single event', () => {
      const callback = vi.fn();
      const unsubscribe = bus.subscribe({ events: ['test_event'], callback });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should subscribe to multiple events', () => {
      const callback = vi.fn();
      const unsubscribe = bus.subscribe({ events: ['event1', 'event2', 'event3'], callback });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should subscribe with from filter', () => {
      const callback = vi.fn();
      const unsubscribe = bus.subscribe({
        from: 'agent_a',
        events: ['test_event'],
        callback,
      });

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback when matching event is published', () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['test_event'], callback });

      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: { data: 'test' },
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'agent_x',
          event: 'test_event',
          payload: { data: 'test' },
        })
      );
    });

    it('should filter by from when specified', () => {
      const callback = vi.fn();
      bus.subscribe({
        from: 'agent_a',
        events: ['test_event'],
        callback,
      });

      // Should not trigger - wrong from
      bus.publish({
        from: 'agent_b',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(callback).not.toHaveBeenCalled();
    });

    it('should trigger for correct from when specified', () => {
      const callback = vi.fn();
      bus.subscribe({
        from: 'agent_a',
        events: ['test_event'],
        callback,
      });

      bus.publish({
        from: 'agent_a',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple callbacks for same event', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.subscribe({ events: ['test_event'], callback: callback1 });
      bus.subscribe({ events: ['test_event'], callback: callback2 });

      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it('should unsubscribe correctly', () => {
      const callback = vi.fn();
      const unsubscribe = bus.subscribe({ events: ['test_event'], callback });

      unsubscribe();

      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should add timestamp if not provided', () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['test_event'], callback });

      const beforeTime = Date.now();
      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: 0, // Will be replaced
        traceId: 'trace-1',
      });
      const afterTime = Date.now();

      const calledEvent = callback.mock.calls[0][0];
      expect(calledEvent.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(calledEvent.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should preserve existing timestamp', () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['test_event'], callback });

      const fixedTime = 1234567890123;
      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: fixedTime,
        traceId: 'trace-1',
      });

      const calledEvent = callback.mock.calls[0][0];
      expect(calledEvent.timestamp).toBe(fixedTime);
    });

    it('should store event in history', () => {
      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: { data: 'test' },
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      const history = bus.getAllHistory();
      expect(history.length).toBe(1);
      expect(history[0].payload).toEqual({ data: 'test' });
    });

    it('should limit history to 1000 events', () => {
      for (let i = 0; i < 1050; i++) {
        bus.publish({
          from: 'agent_x',
          event: 'test_event',
          payload: { index: i },
          timestamp: Date.now(),
          traceId: `trace-${i}`,
        });
      }

      const history = bus.getAllHistory();
      expect(history.length).toBe(1000);
    });

    it('should index events by traceId', () => {
      const traceId = 'trace-special-123';
      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId,
      });

      const traceHistory = bus.getEventHistory(traceId);
      expect(traceHistory.length).toBe(1);
      expect(traceHistory[0].traceId).toBe(traceId);
    });

    it('should limit trace events to 500', () => {
      const traceId = 'trace-long';
      for (let i = 0; i < 550; i++) {
        bus.publish({
          from: 'agent_x',
          event: 'test_event',
          payload: { index: i },
          timestamp: Date.now(),
          traceId,
        });
      }

      const traceHistory = bus.getEventHistory(traceId);
      expect(traceHistory.length).toBe(500);
    });

    it('should return empty array for unknown traceId', () => {
      const history = bus.getEventHistory('non-existent-trace');
      expect(history).toEqual([]);
    });

    it('should handle wildcard subscriptions', () => {
      const callback = vi.fn();
      bus.subscribe({ events: ['*'], callback });

      bus.publish({
        from: 'agent_x',
        event: 'any_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should not break when callback throws', () => {
      const callbackThatThrows = vi.fn(() => {
        throw new Error('Callback error');
      });
      const normalCallback = vi.fn();

      bus.subscribe({ events: ['test_event'], callback: callbackThatThrows });
      bus.subscribe({ events: ['test_event'], callback: normalCallback });

      // Should not throw
      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      expect(normalCallback).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('should unsubscribe all when called without arguments', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      bus.subscribe({ events: ['event1'], callback: callback1 });
      bus.subscribe({ events: ['event2'], callback: callback2 });

      bus.unsubscribe();

      bus.publish({
        from: 'agent_x',
        event: 'event1',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      bus.publish({
        from: 'agent_x',
        event: 'event2',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-2',
      });

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });

    it('should unsubscribe specific agent when from is provided', () => {
      const callbackA = vi.fn();
      const callbackB = vi.fn();

      bus.subscribe({ from: 'agent_a', events: ['test_event'], callback: callbackA });
      bus.subscribe({ from: 'agent_b', events: ['test_event'], callback: callbackB });

      bus.unsubscribe('agent_a');

      bus.publish({
        from: 'agent_a',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      bus.publish({
        from: 'agent_b',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-2',
      });

      expect(callbackA).not.toHaveBeenCalled();
      expect(callbackB).toHaveBeenCalledTimes(1);
    });
  });

  describe('getEventHistory', () => {
    it('should return events for specific traceId', () => {
      const traceId = 'trace-abc';
      bus.publish({
        from: 'agent1',
        event: 'event1',
        payload: { value: 1 },
        timestamp: Date.now(),
        traceId,
      });
      bus.publish({
        from: 'agent2',
        event: 'event2',
        payload: { value: 2 },
        timestamp: Date.now(),
        traceId,
      });

      const history = bus.getEventHistory(traceId);
      expect(history.length).toBe(2);
    });
  });

  describe('getAllHistory', () => {
    it('should return all events in order', () => {
      bus.publish({
        from: 'a',
        event: 'e1',
        payload: {},
        timestamp: 1,
        traceId: 't1',
      });
      bus.publish({
        from: 'b',
        event: 'e2',
        payload: {},
        timestamp: 2,
        traceId: 't2',
      });

      const history = bus.getAllHistory();
      expect(history.length).toBe(2);
      expect(history[0].from).toBe('a');
      expect(history[1].from).toBe('b');
    });
  });

  describe('clearHistory', () => {
    it('should clear all history', () => {
      bus.publish({
        from: 'agent_x',
        event: 'test_event',
        payload: {},
        timestamp: Date.now(),
        traceId: 'trace-1',
      });

      bus.clearHistory();

      expect(bus.getAllHistory()).toEqual([]);
      expect(bus.getEventHistory('trace-1')).toEqual([]);
    });
  });

  describe('getStats', () => {
    it('should return correct stats', () => {
      bus.subscribe({ events: ['event1', 'event2'], callback: vi.fn() });
      bus.subscribe({ events: ['event1'], callback: vi.fn() });

      const stats = bus.getStats();
      expect(stats.eventTypes).toBe(2);
      expect(stats.totalHandlers).toBe(3);
    });

    it('should return zeros for empty bus', () => {
      const stats = bus.getStats();
      expect(stats.eventTypes).toBe(0);
      expect(stats.totalHandlers).toBe(0);
    });
  });
});

describe('createPubSubBus', () => {
  it('should create a PubSubBus instance', () => {
    const bus = createPubSubBus();
    expect(bus).toBeInstanceOf(PubSubBus);
  });
});