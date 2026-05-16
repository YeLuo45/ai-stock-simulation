/**
 * Workflow Store - Zustand Store for Phase Workflow State
 * Persists workflow configuration and runtime state to localStorage
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PhaseConfig, PhaseResult, WorkflowContext, PhaseStatus } from './types';
import { DEFAULT_PHASE_CONFIG } from './types';

export type CurrentPhase = 'idle' | 'scan' | 'analyze' | 'debate' | 'execute';

interface WorkflowState {
  // Configuration
  config: PhaseConfig;
  setConfig: (config: PhaseConfig) => void;
  updateConfig: (updates: Partial<PhaseConfig>) => void;
  resetConfig: () => void;

  // Runtime state
  currentPhase: CurrentPhase;
  setCurrentPhase: (phase: CurrentPhase) => void;
  phaseResults: PhaseResult[];
  addPhaseResult: (result: PhaseResult) => void;
  clearPhaseResults: () => void;

  // Control state
  isRunning: boolean;
  isPaused: boolean;
  isSkipping: boolean;
  startWorkflow: () => void;
  pauseWorkflow: () => void;
  resumeWorkflow: () => void;
  skipPhase: () => void;
  abortWorkflow: () => void;

  // Progress
  progress: number;  // 0-100
  setProgress: (p: number) => void;

  // Last run
  lastRunTime: number | null;
  setLastRunTime: (time: number) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set, get) => ({
      // Configuration
      config: DEFAULT_PHASE_CONFIG,
      setConfig: (config) => set({ config }),
      updateConfig: (updates) => set((state) => ({
        config: {
          scan: { ...state.config.scan, ...updates.scan },
          analyze: { ...state.config.analyze, ...updates.analyze },
          debate: { ...state.config.debate, ...updates.debate },
          execute: { ...state.config.execute, ...updates.execute },
        },
      })),
      resetConfig: () => set({ config: DEFAULT_PHASE_CONFIG }),

      // Runtime state
      currentPhase: 'idle',
      setCurrentPhase: (phase) => set({ currentPhase: phase }),
      phaseResults: [],
      addPhaseResult: (result) => set((state) => ({
        phaseResults: [...state.phaseResults, result],
      })),
      clearPhaseResults: () => set({ phaseResults: [] }),

      // Control state
      isRunning: false,
      isPaused: false,
      isSkipping: false,
      startWorkflow: () => set({
        isRunning: true,
        isPaused: false,
        isSkipping: false,
        currentPhase: 'scan',
        phaseResults: [],
        progress: 0,
      }),
      pauseWorkflow: () => set({ isPaused: true }),
      resumeWorkflow: () => set({ isPaused: false, isSkipping: false }),
      skipPhase: () => set({ isSkipping: true }),
      abortWorkflow: () => set({
        isRunning: false,
        isPaused: false,
        isSkipping: false,
        currentPhase: 'idle',
        progress: 0,
      }),

      // Progress
      progress: 0,
      setProgress: (p) => set({ progress: p }),

      // Last run
      lastRunTime: null,
      setLastRunTime: (time) => set({ lastRunTime: time }),
    }),
    {
      name: 'ai-stock-workflow',
      partialize: (state) => ({
        config: state.config,
        lastRunTime: state.lastRunTime,
      }),
    }
  )
);

// Helper to check if workflow can be started
export const canStartWorkflow = (state: WorkflowState): boolean => {
  return !state.isRunning;
};

// Helper to check if workflow can be paused
export const canPauseWorkflow = (state: WorkflowState): boolean => {
  return state.isRunning && !state.isPaused;
};

// Helper to check if workflow can be resumed
export const canResumeWorkflow = (state: WorkflowState): boolean => {
  return state.isRunning && state.isPaused;
};

// Helper to get current phase index (0-3)
export const getPhaseIndex = (phase: CurrentPhase): number => {
  const map: Record<CurrentPhase, number> = {
    idle: -1,
    scan: 0,
    analyze: 1,
    debate: 2,
    execute: 3,
  };
  return map[phase];
};

// Helper to get phase name in Chinese
export const getPhaseName = (phase: CurrentPhase): string => {
  const map: Record<CurrentPhase, string> = {
    idle: '空闲',
    scan: '市场扫描',
    analyze: '多因子分析',
    debate: '辩论决策',
    execute: '执行下单',
  };
  return map[phase];
};