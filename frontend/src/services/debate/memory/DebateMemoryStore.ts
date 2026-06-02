/**
 * DebateMemoryStore - IndexedDB persistence for debate history
 * Stores each phase of debate pipeline for replay and pattern learning
 */

import Dexie, { type Table } from 'dexie';

export interface DebateRecord {
  id?: number;
  pipelineId: string;
  traceId: string;
  stockCode: string;
  regime: string;
  phase: string;
  phaseInput: unknown;
  phaseOutput: unknown;
  finalDecision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: number;
}

class DebateDatabase extends Dexie {
  debates!: Table<DebateRecord, number>;

  constructor() {
    super('DebateMemoryDB');
    this.version(1).stores({
      debates: '++id, pipelineId, traceId, stockCode, regime, phase, timestamp, finalDecision, confidence',
    });
  }
}

let _db: DebateDatabase | null = null;

export function getDatabase(): DebateDatabase {
  if (!_db) {
    _db = new DebateDatabase();
  }
  return _db;
}

export class DebateMemoryStore {
  private db: DebateDatabase;

  constructor(db?: DebateDatabase) {
    this.db = db ?? getDatabase();
  }

  /**
   * Save a debate record to IndexedDB
   * @returns Promise resolving to the new record's id
   */
  async save(record: Omit<DebateRecord, 'id'>): Promise<number> {
    return this.db.debates.add(record as DebateRecord);
  }

  /**
   * Find all debate records for a given stock code
   */
  async findByStockCode(code: string): Promise<DebateRecord[]> {
    return this.db.debates.where('stockCode').equals(code).toArray();
  }

  /**
   * Find all debate records for a given market regime
   */
  async findByRegime(regime: string): Promise<DebateRecord[]> {
    return this.db.debates.where('regime').equals(regime).toArray();
  }

  /**
   * Find debate records within a date range (inclusive)
   */
  async findByDateRange(start: number, end: number): Promise<DebateRecord[]> {
    return this.db.debates.where('timestamp').between(start, end).toArray();
  }

  /**
   * Get all phases for a given pipelineId, ordered by timestamp
   */
  async getReplay(pipelineId: string): Promise<DebateRecord[]> {
    return this.db.debates
      .where('pipelineId')
      .equals(pipelineId)
      .sortBy('timestamp');
  }

  /**
   * Get all records (for testing)
   */
  async getAll(): Promise<DebateRecord[]> {
    return this.db.debates.toArray();
  }

  /**
   * Delete a record by id (for testing)
   */
  async deleteById(id: number): Promise<void> {
    await this.db.debates.delete(id);
  }

  /**
   * Clear all records (for testing)
   */
  async clear(): Promise<void> {
    await this.db.debates.clear();
  }
}

// Export a singleton instance
export const debateMemoryStore = new DebateMemoryStore();
