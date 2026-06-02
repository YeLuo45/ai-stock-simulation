/**
 * Tests for DebatePipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DebatePipeline, createDebatePipeline } from '../pipeline/DebatePipeline';
import { DebatePhase } from '../pipeline/types';

describe('DebatePipeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create pipeline with stock code', () => {
      const pipeline = new DebatePipeline('AAPL');
      expect(pipeline).toBeDefined();
    });

    it('should create pipeline with candidates', () => {
      const pipeline = new DebatePipeline('AAPL', ['GOOGL', 'MSFT']);
      expect(pipeline).toBeDefined();
    });
  });

  describe('execute', () => {
    it('should execute all 6 phases', async () => {
      const pipeline = new DebatePipeline('AAPL');
      const context = await pipeline.execute();
      
      expect(context).toHaveProperty('traceId');
      expect(context).toHaveProperty('stockCode');
      expect(context.stockCode).toBe('AAPL');
      expect(context).toHaveProperty('phaseResults');
    });

    it('should complete pipeline with end time', async () => {
      const pipeline = new DebatePipeline('TSLA');
      const context = await pipeline.execute();
      
      expect(context).toHaveProperty('endTime');
      expect(context.endTime).toBeGreaterThan(context.startTime);
    });

    it('should have results for all phases', async () => {
      const pipeline = new DebatePipeline('NVDA');
      const context = await pipeline.execute();
      
      const phases = Array.from(context.phaseResults.keys());
      expect(phases).toContain(DebatePhase.SCAN);
      expect(phases).toContain(DebatePhase.ANALYZE);
      expect(phases).toContain(DebatePhase.RESEARCH);
      expect(phases).toContain(DebatePhase.DEBATE);
      expect(phases).toContain(DebatePhase.EXECUTE);
      expect(phases).toContain(DebatePhase.REVIEW);
    });
  });

  describe('getContext', () => {
    it('should return pipeline context', async () => {
      const pipeline = new DebatePipeline('GOOGL');
      await pipeline.execute();
      const context = pipeline.getContext();
      
      expect(context.traceId).toBeDefined();
      expect(context.stockCode).toBe('GOOGL');
    });
  });

  describe('getPhaseResult', () => {
    it('should return result for specific phase', async () => {
      const pipeline = new DebatePipeline('MSFT');
      await pipeline.execute();
      
      const scanResult = pipeline.getPhaseResult(DebatePhase.SCAN);
      expect(scanResult).toBeDefined();
      expect(scanResult?.phase).toBe(DebatePhase.SCAN);
    });

    it('should return undefined for unknown phase', () => {
      const pipeline = new DebatePipeline('AMZN');
      const result = pipeline.getPhaseResult('unknown' as DebatePhase);
      expect(result).toBeUndefined();
    });
  });

  describe('getAllPhaseResults', () => {
    it('should return map of all phase results', async () => {
      const pipeline = new DebatePipeline('SPY');
      await pipeline.execute();
      
      const results = pipeline.getAllPhaseResults();
      expect(results).toBeInstanceOf(Map);
      expect(results.size).toBe(6);
    });
  });
});

describe('createDebatePipeline', () => {
  it('should create pipeline instance', () => {
    const pipeline = createDebatePipeline('AAPL');
    expect(pipeline).toBeInstanceOf(DebatePipeline);
  });

  it('should accept candidates parameter', () => {
    const pipeline = createDebatePipeline('AAPL', ['GOOGL', 'MSFT']);
    expect(pipeline).toBeInstanceOf(DebatePipeline);
  });
});