/**
 * StateTransitionPanel - Phase State Machine Visualization
 * Shows the current phase, transitions, messages, and errors for agent conversations
 */

import React, { useEffect, useState } from 'react';
import { X, MessageSquare, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import clsx from 'clsx';
import { Phase, PHASE_ORDER, PHASE_LABELS, PHASE_COLORS } from '../types/AgentState';
import type { AgentState, AgentMessage } from '../types/AgentState';

interface StateTransitionPanelProps {
  conversationId: string;
  state: AgentState | null;
  messages: AgentMessage[];
  onClose?: () => void;
  className?: string;
}

const PhaseIcon: React.FC<{ phase: Phase; current: boolean }> = ({ phase, current }) => {
  const iconClass = PHASE_COLORS[phase];
  
  if (phase === Phase.COMPLETED) {
    return <CheckCircle size={16} className={iconClass} />;
  }
  if (phase === Phase.FAILED) {
    return <AlertTriangle size={16} className="text-accent-danger" />;
  }
  if (phase === Phase.IDLE) {
    return <Clock size={16} className={iconClass} />;
  }
  
  return (
    <div className={clsx(
      'w-4 h-4 rounded-full border-2',
      current 
        ? 'bg-accent-primary border-accent-primary' 
        : 'border-border-color bg-bg-tertiary'
    )} />
  );
};

export const StateTransitionPanel: React.FC<StateTransitionPanelProps> = ({
  conversationId,
  state,
  messages,
  onClose,
  className = '',
}) => {
  const [filterType, setFilterType] = useState<string | null>(null);

  const currentPhase = state?.currentPhase || Phase.IDLE;
  const currentPhaseIndex = PHASE_ORDER.indexOf(currentPhase);

  // Filter messages by type if filter is set
  const filteredMessages = filterType
    ? messages.filter(m => m.type === filterType)
    : messages;

  // Sort messages by timestamp
  const sortedMessages = [...filteredMessages].sort((a, b) => a.timestamp - b.timestamp);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (start: number, end?: number) => {
    const duration = (end || Date.now()) - start;
    if (duration < 1000) return `${duration}ms`;
    if (duration < 60000) return `${(duration / 1000).toFixed(1)}s`;
    return `${(duration / 60000).toFixed(1)}m`;
  };

  const getMessageTypeColor = (type: string) => {
    switch (type) {
      case 'ANALYSIS_REQUEST':
      case 'ANALYSIS_RESPONSE':
        return 'text-blue-400';
      case 'DEBATE_REQUEST':
      case 'DEBATE_RESPONSE':
        return 'text-yellow-400';
      case 'TRADE_REQUEST':
      case 'TRADE_RESPONSE':
        return 'text-purple-400';
      case 'ERROR':
        return 'text-accent-danger';
      case 'HEARTBEAT':
        return 'text-gray-400';
      default:
        return 'text-text-secondary';
    }
  };

  return (
    <div className={clsx(
      'bg-bg-secondary border border-border-color rounded-xl overflow-hidden',
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center">
            <MessageSquare size={16} className="text-accent-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-primary">Agent 状态机</h3>
            <p className="text-xs text-text-muted font-mono">{conversationId}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Phase Timeline */}
      <div className="px-4 py-4 border-b border-border-color">
        <div className="flex items-center gap-1">
          {PHASE_ORDER.map((phase, index) => {
            const isActive = state?.currentPhase === phase;
            const isPast = index < currentPhaseIndex;
            const isCompleted = phase === Phase.COMPLETED && currentPhase === Phase.COMPLETED;
            
            return (
              <React.Fragment key={phase}>
                <div className="flex flex-col items-center">
                  <div className={clsx(
                    'flex items-center justify-center w-8 h-8 rounded-full transition-all',
                    isActive && 'bg-accent-primary/10 ring-2 ring-accent-primary/40',
                    isPast && 'bg-accent-primary/20',
                    isCompleted && 'bg-accent-success/20'
                  )}>
                  <PhaseIcon phase={phase} current={isActive} />
                  </div>
                  <span className={clsx(
                    'text-xs mt-1.5 whitespace-nowrap',
                    isActive ? 'text-accent-primary font-medium' : 'text-text-muted'
                  )}>
                    {PHASE_LABELS[phase]}
                  </span>
                </div>
                {index < PHASE_ORDER.length - 1 && (
                  <div className={clsx(
                    'flex-1 h-0.5 mx-1 min-w-[20px]',
                    isPast || isActive ? 'bg-accent-primary/40' : 'bg-border-color'
                  )} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Error Display */}
      {state?.error && (
        <div className="px-4 py-3 bg-accent-danger/10 border-b border-accent-danger/20">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-accent-danger" />
            <span className="text-sm text-accent-danger">{state.error}</span>
          </div>
        </div>
      )}

      {/* Message Filters */}
      <div className="px-4 py-2 border-b border-border-color flex items-center gap-2">
        <span className="text-xs text-text-muted">消息类型:</span>
        {['ANALYSIS_REQUEST', 'ANALYSIS_RESPONSE', 'DEBATE_REQUEST', 'DEBATE_RESPONSE', 'TRADE_REQUEST', 'TRADE_RESPONSE', 'ERROR', 'HEARTBEAT'].map(type => (
          <button
            key={type}
            onClick={() => setFilterType(filterType === type ? null : type)}
            className={clsx(
              'px-2 py-1 rounded text-xs transition-colors',
              filterType === type
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-bg-tertiary text-text-muted hover:text-text-secondary'
            )}
          >
            {type.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {/* Message List */}
      <div className="max-h-80 overflow-y-auto">
        {sortedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare size={32} className="text-text-muted mb-2" />
            <p className="text-sm text-text-muted">暂无消息</p>
          </div>
        ) : (
          <div className="divide-y divide-border-color/50">
            {sortedMessages.map((msg, index) => (
              <div key={msg.id} className="px-4 py-3 hover:bg-bg-tertiary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        msg.sender === 'Supervisor' ? 'bg-accent-primary/10 text-accent-primary' : 'bg-bg-tertiary text-text-secondary'
                      )}>
                        {msg.sender}
                      </span>
                      <span className="text-text-muted">→</span>
                      <span className={clsx(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        msg.receiver === 'broadcast' ? 'bg-purple-500/10 text-purple-400' : 'bg-bg-tertiary text-text-secondary'
                      )}>
                        {msg.receiver}
                      </span>
                      <span className={clsx('text-xs font-mono', getMessageTypeColor(msg.type))}>
                        {msg.type}
                      </span>
                    </div>
                    <div className="text-xs text-text-muted font-mono">
                      {formatTime(msg.timestamp)} · {formatDuration(msg.timestamp)} · {msg.status}
                      {msg.retryCount > 0 && <span className="text-yellow-400 ml-1">重试 {msg.retryCount} 次</span>}
                    </div>
                    {Object.keys(msg.content).length > 0 && (
                      <div className="mt-2 p-2 bg-bg-tertiary rounded text-xs font-mono text-text-secondary overflow-x-auto">
                        <pre className="whitespace-pre-wrap break-all">
                          {JSON.stringify(msg.content, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-3 border-t border-border-color bg-bg-tertiary/30">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <div className="flex items-center gap-4">
            <span>消息总数: {messages.length}</span>
            <span>当前阶段: <span className={PHASE_COLORS[currentPhase]}>{PHASE_LABELS[currentPhase]}</span></span>
            {state?.previousPhase && (
              <span>上一阶段: <span className="text-text-secondary">{PHASE_LABELS[state.previousPhase]}</span></span>
            )}
          </div>
          <div className="flex items-center gap-4">
            {state?.startedAt && (
              <span>持续时间: {formatDuration(state.startedAt, state.updatedAt)}</span>
            )}
            <span>参与 Agent: {state?.agentsInvolved.length || 0}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StateTransitionPanel;
