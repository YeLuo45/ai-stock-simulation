/**
 * DebateMonitor - 实时辩论监控组件
 * 显示当前Phase、Phase进度条、每个Agent的状态
 */

import { useEffect, useState, useCallback } from 'react';
import { DebatePhase, PHASE_NAMES, PHASE_DESCRIPTIONS, PhaseResult } from '../services/debate/pipeline/types';
import { PubSubBus, AgentEvent } from '../services/debate/coordination/PubSubBus';

interface AgentStatus {
  agentId: string;
  status: 'pending' | 'running' | 'complete' | 'error';
  message?: string;
  timestamp?: number;
}

interface PhaseProgress {
  phase: DebatePhase;
  status: 'pending' | 'running' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  duration?: number;
}

interface DebateMonitorProps {
  pipelineId: string;
  traceId: string;
  pubsub?: PubSubBus;
  initialPhase?: DebatePhase;
}

const PHASE_ORDER: DebatePhase[] = [
  DebatePhase.SCAN,
  DebatePhase.ANALYZE,
  DebatePhase.RESEARCH,
  DebatePhase.DEBATE,
  DebatePhase.EXECUTE,
  DebatePhase.REVIEW,
];

const ANALYST_AGENTS = [
  'fundamental_analyst',
  'technical_analyst',
  'market_analyst',
  'sentiment_analyst',
];

const RESEARCHER_AGENTS = ['data_researcher', 'news_researcher'];

const ALL_AGENTS = [...ANALYST_AGENTS, ...RESEARCHER_AGENTS, 'bull', 'bear', 'judge', 'strategy_manager', 'portfolio_manager', 'trading_trader'];

function PhaseStatusBadge({ status }: { status: PhaseProgress['status'] }) {
  const configs: Record<string, { bg: string; text: string; icon: string }> = {
    pending: { bg: 'bg-gray-100', text: 'text-gray-500', icon: '⏳' },
    running: { bg: 'bg-blue-100', text: 'text-blue-600', icon: '🔄' },
    complete: { bg: 'bg-green-100', text: 'text-green-600', icon: '✅' },
    error: { bg: 'bg-red-100', text: 'text-red-600', icon: '❌' },
  };
  const cfg = configs[status] || configs.pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.icon}
    </span>
  );
}

function AgentStatusCard({ agentId, status }: { agentId: string; status: AgentStatus }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-gray-50 border-gray-200',
    running: 'bg-blue-50 border-blue-300 animate-pulse',
    complete: 'bg-green-50 border-green-300',
    error: 'bg-red-50 border-red-300',
  };

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    running: '🔄',
    complete: '✅',
    error: '❌',
  };

  return (
    <div className={`flex items-center gap-2 p-2 rounded-lg border ${statusColors[status.status]}`}>
      <span className="text-sm">{statusIcons[status.status]}</span>
      <span className="text-xs font-medium text-gray-700 flex-1 truncate">
        {agentId.replace('_', ' ')}
      </span>
      {status.timestamp && (
        <span className="text-xs text-gray-400">
          {new Date(status.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </span>
      )}
    </div>
  );
}

function PhaseTimeline({ phases, currentPhase }: { phases: PhaseProgress[]; currentPhase: DebatePhase }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {PHASE_ORDER.map((phase, idx) => {
        const progress = phases.find(p => p.phase === phase);
        const isActive = phase === currentPhase;
        const isPast = progress?.status === 'complete' || progress?.status === 'error';

        return (
          <div key={phase} className="flex items-center">
            {idx > 0 && (
              <div className={`w-4 h-0.5 ${isPast ? 'bg-green-500' : 'bg-gray-200'}`} />
            )}
            <div
              className={`
                flex flex-col items-center gap-1 px-2 py-1 rounded-lg min-w-[60px]
                ${isActive ? 'bg-blue-100 ring-2 ring-blue-400' : 'bg-gray-50'}
                ${isPast && !isActive ? 'bg-green-50' : ''}
              `}
            >
              <span className="text-sm font-medium text-gray-700">{PHASE_NAMES[phase]}</span>
              {progress && <PhaseStatusBadge status={progress.status} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProgressBar({ progress, label }: { progress: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-500 transition-all duration-300"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-12 text-right">{Math.round(progress)}%</span>
      <span className="text-xs text-gray-400 w-16">{label}</span>
    </div>
  );
}

export function DebateMonitor({ pipelineId, traceId, pubsub, initialPhase = DebatePhase.SCAN }: DebateMonitorProps) {
  const [currentPhase, setCurrentPhase] = useState<DebatePhase>(initialPhase);
  const [phases, setPhases] = useState<PhaseProgress[]>(
    PHASE_ORDER.map(phase => ({ phase, status: 'pending' as const }))
  );
  const [agentStatuses, setAgentStatuses] = useState<Map<string, AgentStatus>>(
    new Map(ALL_AGENTS.map(id => [id, { agentId: id, status: 'pending' }]))
  );

  // Calculate overall progress
  const completedPhases = phases.filter(p => p.status === 'complete' || p.status === 'error').length;
  const overallProgress = (completedPhases / PHASE_ORDER.length) * 100;

  // Subscribe to PubSubBus events
  useEffect(() => {
    if (!pubsub) return;

    const unsubscribers = [
      pubsub.subscribe({
        events: ['task_start'],
        callback: (e: AgentEvent) => {
          setAgentStatuses(prev => {
            const next = new Map(prev);
            next.set(e.from, { agentId: e.from, status: 'running', timestamp: e.timestamp });
            return next;
          });
        },
      }),
      pubsub.subscribe({
        events: ['task_complete'],
        callback: (e: AgentEvent) => {
          const payload = e.payload as { result?: { success?: boolean } };
          setAgentStatuses(prev => {
            const next = new Map(prev);
            const success = payload?.result?.success !== false;
            next.set(e.from, {
              agentId: e.from,
              status: success ? 'complete' : 'error',
              timestamp: e.timestamp,
              message: success ? '完成' : '失败',
            });
            return next;
          });
        },
      }),
      pubsub.subscribe({
        events: ['task_error'],
        callback: (e: AgentEvent) => {
          setAgentStatuses(prev => {
            const next = new Map(prev);
            next.set(e.from, { agentId: e.from, status: 'error', timestamp: e.timestamp });
            return next;
          });
        },
      }),
      pubsub.subscribe({
        events: ['group_execution_start'],
        callback: (e: AgentEvent) => {
          const payload = e.payload as { groupName?: string };
          if (payload?.groupName === 'analyst_group') {
            setCurrentPhase(DebatePhase.ANALYZE);
            setPhases(prev => prev.map(p =>
              p.phase === DebatePhase.ANALYZE
                ? { ...p, status: 'running', startTime: e.timestamp }
                : p
            ));
          } else if (payload?.groupName === 'researcher_group') {
            setCurrentPhase(DebatePhase.RESEARCH);
            setPhases(prev => prev.map(p =>
              p.phase === DebatePhase.RESEARCH
                ? { ...p, status: 'running', startTime: e.timestamp }
                : p
            ));
          }
        },
      }),
      pubsub.subscribe({
        events: ['group_execution_complete'],
        callback: (e: AgentEvent) => {
          const payload = e.payload as { groupName?: string; totalDuration?: number };
          if (payload?.groupName === 'analyst_group') {
            setPhases(prev => prev.map(p =>
              p.phase === DebatePhase.ANALYZE
                ? { ...p, status: 'complete', endTime: e.timestamp, duration: payload.totalDuration }
                : p
            ));
          } else if (payload?.groupName === 'researcher_group') {
            setPhases(prev => prev.map(p =>
              p.phase === DebatePhase.RESEARCH
                ? { ...p, status: 'complete', endTime: e.timestamp, duration: payload.totalDuration }
                : p
            ));
          }
        },
      }),
      pubsub.subscribe({
        events: ['phase_change'],
        callback: (e: AgentEvent) => {
          const payload = e.payload as { phase?: DebatePhase };
          if (payload?.phase) {
            setCurrentPhase(payload.phase);
            setPhases(prev => prev.map(p =>
              p.phase === payload.phase
                ? { ...p, status: 'running', startTime: e.timestamp }
                : p.status === 'pending' && PHASE_ORDER.indexOf(p.phase) < PHASE_ORDER.indexOf(payload.phase!)
                  ? { ...p, status: 'complete' }
                  : p
            ));
          }
        },
      }),
    ];

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [pubsub]);

  // Simulate phase progression for demo (when no pubsub)
  useEffect(() => {
    if (pubsub) return; // Don't simulate if connected to real pubsub

    const timer = setTimeout(() => {
      setCurrentPhase(DebatePhase.ANALYZE);
      setPhases(prev => prev.map(p =>
        p.phase === DebatePhase.ANALYZE
          ? { ...p, status: 'running', startTime: Date.now() }
          : p
      ));

      // Mark agents as running
      setAgentStatuses(prev => {
        const next = new Map(prev);
        ANALYST_AGENTS.forEach(id => {
          next.set(id, { agentId: id, status: 'running', timestamp: Date.now() });
        });
        return next;
      });

      setTimeout(() => {
        setPhases(prev => prev.map(p =>
          p.phase === DebatePhase.ANALYZE
            ? { ...p, status: 'complete', endTime: Date.now(), duration: 1500 }
            : p
        ));
        setAgentStatuses(prev => {
          const next = new Map(prev);
          ANALYST_AGENTS.forEach(id => {
            next.set(id, { agentId: id, status: 'complete', timestamp: Date.now() });
          });
          return next;
        });

        setTimeout(() => {
          setCurrentPhase(DebatePhase.RESEARCH);
          setPhases(prev => prev.map(p =>
            p.phase === DebatePhase.RESEARCH
              ? { ...p, status: 'running', startTime: Date.now() }
              : p
          ));
          setAgentStatuses(prev => {
            const next = new Map(prev);
            RESEARCHER_AGENTS.forEach(id => {
              next.set(id, { agentId: id, status: 'running', timestamp: Date.now() });
            });
            return next;
          });

          setTimeout(() => {
            setPhases(prev => prev.map(p =>
              p.phase === DebatePhase.RESEARCH
                ? { ...p, status: 'complete', endTime: Date.now(), duration: 800 }
                : p
            ));
            setAgentStatuses(prev => {
              const next = new Map(prev);
              RESEARCHER_AGENTS.forEach(id => {
                next.set(id, { agentId: id, status: 'complete', timestamp: Date.now() });
              });
              return next;
            });
          }, 800);
        }, 1500);
      }, 800);
    }, 1000);

    return () => clearTimeout(timer);
  }, [pubsub]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <span>📊</span>
            辩论监控
          </h3>
          <p className="text-xs text-gray-400">
            Pipeline: {pipelineId} | Trace: {traceId.slice(0, 8)}...
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
            currentPhase === DebatePhase.REVIEW
              ? 'bg-green-100 text-green-700'
              : 'bg-blue-100 text-blue-700'
          }`}>
            {currentPhase === DebatePhase.REVIEW ? '🎉' : '🔄'}
            {PHASE_NAMES[currentPhase]}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="mb-4">
        <ProgressBar progress={overallProgress} label="总进度" />
      </div>

      {/* Phase Timeline */}
      <div className="mb-4">
        <h4 className="text-xs font-semibold text-gray-500 mb-2">阶段进度</h4>
        <PhaseTimeline phases={phases} currentPhase={currentPhase} />
      </div>

      {/* Phase Description */}
      <div className="mb-4 p-2 bg-gray-50 rounded-lg">
        <p className="text-xs text-gray-600">{PHASE_DESCRIPTIONS[currentPhase]}</p>
      </div>

      {/* Agent Status Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {/* Analysts */}
        <div className="col-span-full">
          <h4 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <span>📈</span> 分析师组
          </h4>
          <div className="grid grid-cols-2 gap-1">
            {ANALYST_AGENTS.map(id => (
              <AgentStatusCard
                key={id}
                agentId={id}
                status={agentStatuses.get(id) || { agentId: id, status: 'pending' }}
              />
            ))}
          </div>
        </div>

        {/* Researchers */}
        <div className="col-span-full">
          <h4 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <span>🔍</span> 研究员组
          </h4>
          <div className="grid grid-cols-2 gap-1">
            {RESEARCHER_AGENTS.map(id => (
              <AgentStatusCard
                key={id}
                agentId={id}
                status={agentStatuses.get(id) || { agentId: id, status: 'pending' }}
              />
            ))}
          </div>
        </div>

        {/* Debaters & Managers */}
        <div className="col-span-full">
          <h4 className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
            <span>⚖️</span> 辩论与管理
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1">
            {['bull', 'bear', 'judge', 'strategy_manager', 'portfolio_manager', 'trading_trader'].map(id => (
              <AgentStatusCard
                key={id}
                agentId={id}
                status={agentStatuses.get(id) || { agentId: id, status: 'pending' }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Event Log Preview */}
      <div className="mt-4 p-2 bg-gray-50 rounded-lg">
        <h4 className="text-xs font-semibold text-gray-500 mb-1">实时事件</h4>
        <div className="text-xs text-gray-400 space-y-0.5 max-h-20 overflow-y-auto">
          <p>📍 当前阶段: {PHASE_NAMES[currentPhase]}</p>
          <p>✅ 完成阶段: {phases.filter(p => p.status === 'complete').length}/{PHASE_ORDER.length}</p>
          <p>🔄 运行中: {Array.from(agentStatuses.values()).filter(s => s.status === 'running').length} 个Agent</p>
        </div>
      </div>
    </div>
  );
}

export default DebateMonitor;