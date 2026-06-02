/**
 * Tests for pipeline types
 */

import { describe, it, expect } from 'vitest';
import { DebatePhase, PHASE_SEQUENCE, PHASE_NAMES, PHASE_DESCRIPTIONS } from '../pipeline/types';

describe('DebatePhase', () => {
  it('should have all 6 phases', () => {
    expect(DebatePhase.SCAN).toBe('scan');
    expect(DebatePhase.ANALYZE).toBe('analyze');
    expect(DebatePhase.RESEARCH).toBe('research');
    expect(DebatePhase.DEBATE).toBe('debate');
    expect(DebatePhase.EXECUTE).toBe('execute');
    expect(DebatePhase.REVIEW).toBe('review');
  });

  it('should have correct phase count', () => {
    expect(Object.keys(DebatePhase)).toHaveLength(6);
  });
});

describe('PHASE_SEQUENCE', () => {
  it('should have correct order', () => {
    expect(PHASE_SEQUENCE).toEqual([
      DebatePhase.SCAN,
      DebatePhase.ANALYZE,
      DebatePhase.RESEARCH,
      DebatePhase.DEBATE,
      DebatePhase.EXECUTE,
      DebatePhase.REVIEW,
    ]);
  });

  it('should have 6 phases', () => {
    expect(PHASE_SEQUENCE).toHaveLength(6);
  });
});

describe('PHASE_NAMES', () => {
  it('should have names for all phases', () => {
    expect(PHASE_NAMES[DebatePhase.SCAN]).toBe('扫描阶段');
    expect(PHASE_NAMES[DebatePhase.ANALYZE]).toBe('分析阶段');
    expect(PHASE_NAMES[DebatePhase.RESEARCH]).toBe('研究阶段');
    expect(PHASE_NAMES[DebatePhase.DEBATE]).toBe('辩论阶段');
    expect(PHASE_NAMES[DebatePhase.EXECUTE]).toBe('执行阶段');
    expect(PHASE_NAMES[DebatePhase.REVIEW]).toBe('复盘阶段');
  });
});

describe('PHASE_DESCRIPTIONS', () => {
  it('should have descriptions for all phases', () => {
    expect(PHASE_DESCRIPTIONS[DebatePhase.SCAN]).toBeDefined();
    expect(PHASE_DESCRIPTIONS[DebatePhase.ANALYZE]).toBeDefined();
    expect(PHASE_DESCRIPTIONS[DebatePhase.RESEARCH]).toBeDefined();
    expect(PHASE_DESCRIPTIONS[DebatePhase.DEBATE]).toBeDefined();
    expect(PHASE_DESCRIPTIONS[DebatePhase.EXECUTE]).toBeDefined();
    expect(PHASE_DESCRIPTIONS[DebatePhase.REVIEW]).toBeDefined();
  });

  it('should describe scan phase', () => {
    expect(PHASE_DESCRIPTIONS[DebatePhase.SCAN]).toContain('扫描');
  });

  it('should describe analyze phase', () => {
    expect(PHASE_DESCRIPTIONS[DebatePhase.ANALYZE]).toContain('分析');
  });
});