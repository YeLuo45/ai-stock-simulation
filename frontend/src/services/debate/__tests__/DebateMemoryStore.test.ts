/**
 * Tests for DebateMemoryStore - IndexedDB persistence
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { DebateMemoryStore, DebateRecord, getDatabase } from '../memory/DebateMemoryStore';
import Dexie from 'dexie';

describe('DebateMemoryStore', () => {
  let store: DebateMemoryStore;
  let testDb: Dexie;

  beforeEach(async () => {
    // Create a fresh in-memory database for each test
    testDb = new Dexie();
    testDb.version(1).stores({
      debates: '++id, pipelineId, traceId, stockCode, regime, phase, timestamp, finalDecision, confidence',
    });
    store = new DebateMemoryStore(testDb);
    await testDb.open();
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.close();
    }
  });

  describe('save()', () => {
    it('should save a debate record and return auto-incremented id', async () => {
      const record: Omit<DebateRecord, 'id'> = {
        pipelineId: 'pipeline-1',
        traceId: 'trace-1',
        stockCode: 'AAPL',
        regime: 'bull_market',
        phase: 'sentiment_analysis',
        phaseInput: { text: 'bullish sentiment' },
        phaseOutput: { sentiment: 'positive', score: 0.8 },
        finalDecision: 'BUY',
        confidence: 0.75,
        timestamp: Date.now(),
      };

      const id = await store.save(record);
      expect(id).toBe(1);
    });

    it('should save multiple records with incrementing ids', async () => {
      const record1: Omit<DebateRecord, 'id'> = {
        pipelineId: 'pipeline-1', traceId: 'trace-1', stockCode: 'AAPL',
        regime: 'bull_market', phase: 'phase1', phaseInput: {}, phaseOutput: {},
        finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now(),
      };
      const record2: Omit<DebateRecord, 'id'> = {
        pipelineId: 'pipeline-1', traceId: 'trace-1', stockCode: 'AAPL',
        regime: 'bull_market', phase: 'phase2', phaseInput: {}, phaseOutput: {},
        finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() + 1,
      };

      const id1 = await store.save(record1);
      const id2 = await store.save(record2);

      expect(id2).toBe(id1 + 1);
    });

    it('should save records with different decisions', async () => {
      const buy: Omit<DebateRecord, 'id'> = {
        pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL',
        regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {},
        finalDecision: 'BUY', confidence: 0.8, timestamp: Date.now(),
      };
      const sell: Omit<DebateRecord, 'id'> = {
        pipelineId: 'p2', traceId: 't2', stockCode: 'GOOGL',
        regime: 'bear', phase: 'p', phaseInput: {}, phaseOutput: {},
        finalDecision: 'SELL', confidence: 0.6, timestamp: Date.now(),
      };
      const hold: Omit<DebateRecord, 'id'> = {
        pipelineId: 'p3', traceId: 't3', stockCode: 'MSFT',
        regime: 'sideways', phase: 'p', phaseInput: {}, phaseOutput: {},
        finalDecision: 'HOLD', confidence: 0.5, timestamp: Date.now(),
      };

      expect(await store.save(buy)).toBe(1);
      expect(await store.save(sell)).toBe(2);
      expect(await store.save(hold)).toBe(3);
    });
  });

  describe('findByStockCode()', () => {
    it('should find all records for a given stock code', async () => {
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() },
        { pipelineId: 'p2', traceId: 't2', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() },
        { pipelineId: 'p3', traceId: 't3', stockCode: 'GOOGL', regime: 'bear', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'SELL', confidence: 0.6, timestamp: Date.now() },
      ];

      await store.save(records[0]);
      await store.save(records[1]);
      await store.save(records[2]);

      const aaplRecords = await store.findByStockCode('AAPL');
      expect(aaplRecords).toHaveLength(2);
      expect(aaplRecords.every(r => r.stockCode === 'AAPL')).toBe(true);

      const googlRecords = await store.findByStockCode('GOOGL');
      expect(googlRecords).toHaveLength(1);
      expect(googlRecords[0].stockCode).toBe('GOOGL');
    });

    it('should return empty array for non-existent stock code', async () => {
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() },
      ];

      await store.save(records[0]);

      const nonExistent = await store.findByStockCode('NONEXISTENT');
      expect(nonExistent).toHaveLength(0);
    });
  });

  describe('findByRegime()', () => {
    it('should find all records for a given regime', async () => {
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull_market', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() },
        { pipelineId: 'p2', traceId: 't2', stockCode: 'GOOGL', regime: 'bear_market', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'SELL', confidence: 0.6, timestamp: Date.now() },
        { pipelineId: 'p3', traceId: 't3', stockCode: 'MSFT', regime: 'bull_market', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.8, timestamp: Date.now() },
      ];

      await store.save(records[0]);
      await store.save(records[1]);
      await store.save(records[2]);

      const bullMarketRecords = await store.findByRegime('bull_market');
      expect(bullMarketRecords).toHaveLength(2);
      expect(bullMarketRecords.every(r => r.regime === 'bull_market')).toBe(true);

      const bearMarketRecords = await store.findByRegime('bear_market');
      expect(bearMarketRecords).toHaveLength(1);
      expect(bearMarketRecords[0].regime).toBe('bear_market');
    });
  });

  describe('findByDateRange()', () => {
    it('should find records within a date range', async () => {
      const now = Date.now();
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: now - 10000 },
        { pipelineId: 'p2', traceId: 't2', stockCode: 'GOOGL', regime: 'bear', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'SELL', confidence: 0.6, timestamp: now - 5000 },
        { pipelineId: 'p3', traceId: 't3', stockCode: 'MSFT', regime: 'sideways', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'HOLD', confidence: 0.5, timestamp: now },
      ];

      await store.save(records[0]);
      await store.save(records[1]);
      await store.save(records[2]);

      const inRange = await store.findByDateRange(now - 6000, now - 4000);
      expect(inRange).toHaveLength(1);
      expect(inRange[0].stockCode).toBe('GOOGL');
    });

    it('should return empty array when no records in range', async () => {
      const now = Date.now();
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: now - 10000 },
      ];

      await store.save(records[0]);

      const inRange = await store.findByDateRange(now - 5000, now);
      expect(inRange).toHaveLength(0);
    });
  });

  describe('getReplay()', () => {
    it('should return all phases for a pipeline ordered by timestamp', async () => {
      const now = Date.now();
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'pipeline-1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'phase1', phaseInput: {}, phaseOutput: { step: 1 }, finalDecision: 'BUY', confidence: 0.7, timestamp: now },
        { pipelineId: 'pipeline-1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'phase2', phaseInput: {}, phaseOutput: { step: 2 }, finalDecision: 'BUY', confidence: 0.7, timestamp: now + 100 },
        { pipelineId: 'pipeline-1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'phase3', phaseInput: {}, phaseOutput: { step: 3 }, finalDecision: 'BUY', confidence: 0.7, timestamp: now + 200 },
        { pipelineId: 'pipeline-2', traceId: 't2', stockCode: 'GOOGL', regime: 'bear', phase: 'phase1', phaseInput: {}, phaseOutput: { step: 1 }, finalDecision: 'SELL', confidence: 0.6, timestamp: now },
      ];

      for (const r of records) {
        await store.save(r);
      }

      const replay = await store.getReplay('pipeline-1');
      expect(replay).toHaveLength(3);
      expect(replay[0].phase).toBe('phase1');
      expect(replay[1].phase).toBe('phase2');
      expect(replay[2].phase).toBe('phase3');
    });

    it('should return empty array for non-existent pipeline', async () => {
      const replay = await store.getReplay('non-existent-pipeline');
      expect(replay).toHaveLength(0);
    });
  });

  describe('getAll()', () => {
    it('should return all records', async () => {
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() },
        { pipelineId: 'p2', traceId: 't2', stockCode: 'GOOGL', regime: 'bear', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'SELL', confidence: 0.6, timestamp: Date.now() },
      ];

      await store.save(records[0]);
      await store.save(records[1]);

      const all = await store.getAll();
      expect(all).toHaveLength(2);
    });
  });

  describe('deleteById()', () => {
    it('should delete a record by id', async () => {
      const record: Omit<DebateRecord, 'id'> = {
        pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull',
        phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY',
        confidence: 0.7, timestamp: Date.now(),
      };

      const id = await store.save(record);
      expect((await store.getAll())).toHaveLength(1);

      await store.deleteById(id);
      expect((await store.getAll())).toHaveLength(0);
    });
  });

  describe('clear()', () => {
    it('should clear all records', async () => {
      const records: Omit<DebateRecord, 'id'>[] = [
        { pipelineId: 'p1', traceId: 't1', stockCode: 'AAPL', regime: 'bull', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'BUY', confidence: 0.7, timestamp: Date.now() },
        { pipelineId: 'p2', traceId: 't2', stockCode: 'GOOGL', regime: 'bear', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'SELL', confidence: 0.6, timestamp: Date.now() },
        { pipelineId: 'p3', traceId: 't3', stockCode: 'MSFT', regime: 'sideways', phase: 'p', phaseInput: {}, phaseOutput: {}, finalDecision: 'HOLD', confidence: 0.5, timestamp: Date.now() },
      ];

      for (const r of records) {
        await store.save(r);
      }
      expect(await store.getAll()).toHaveLength(3);

      await store.clear();
      expect(await store.getAll()).toHaveLength(0);
    });
  });
});
