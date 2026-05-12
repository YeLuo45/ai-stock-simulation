/**
 * ConversationPanel - Agent Conversation History Viewer
 * Displays conversation history for each agent session
 */
import { useState, useEffect } from 'react';
import {
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bot,
  User,
  Settings,
  X,
  RefreshCw,
  Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { AgentConversationStore, type ConversationTurn } from '../agents/AgentConversationStore';
import type { AgentName } from '../agents/messages';
import { AGENT_DISPLAY_NAMES, AGENT_COLORS } from '../agents/messages';

interface ConversationPanelProps {
  initialSessionId?: string;
  initialAgentName?: AgentName;
  onClose?: () => void;
}

const ROLE_CONFIG = {
  system: { label: 'System', icon: <Settings size={12} />, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  user: { label: 'User', icon: <User size={12} />, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  assistant: { label: 'Assistant', icon: <Bot size={12} />, color: 'text-green-400', bg: 'bg-green-400/10' },
} as const;

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
  return `${Math.floor(diff / 86400000)}天前`;
}

function TurnCard({ turn, expanded, onToggle }: { turn: ConversationTurn; expanded: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);
  const config = ROLE_CONFIG[turn.role];

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(turn.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
  };

  return (
    <div
      className={clsx(
        'border rounded-lg overflow-hidden transition-colors',
        'border-border-color hover:border-accent-primary/30'
      )}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 p-3 text-left"
      >
        <span className={clsx('shrink-0', config.color)}>{config.icon}</span>
        <span className={clsx('text-xs font-medium', config.color)}>{config.label}</span>
        <span className="text-xs text-text-muted flex-1 truncate">{turn.content.slice(0, 60)}...</span>
        <span className="text-xs text-text-muted">{formatRelativeTime(turn.timestamp)}</span>
        {expanded ? (
          <ChevronUp size={14} className="text-text-muted shrink-0" />
        ) : (
          <ChevronDown size={14} className="text-text-muted shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-0 border-t border-border-color/50">
          <div className="mt-2 flex items-start gap-2">
            <pre className="flex-1 text-xs text-text-secondary whitespace-pre-wrap break-all font-mono bg-bg-tertiary/50 rounded p-2 max-h-60 overflow-auto">
              {turn.content}
            </pre>
            <button
              onClick={handleCopy}
              className="shrink-0 p-1.5 rounded hover:bg-bg-tertiary text-text-muted hover:text-accent-primary transition-colors"
              title="复制内容"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Clock size={10} />
              {formatTime(turn.timestamp)}
            </span>
            {turn.tokens && (
              <span className="font-mono">
                Tokens: in={turn.tokens.input}, out={turn.tokens.output}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ConversationPanel({ initialSessionId, initialAgentName, onClose }: ConversationPanelProps) {
  const [selectedSession, setSelectedSession] = useState<string>(initialSessionId || '');
  const [selectedAgent, setSelectedAgent] = useState<AgentName>(initialAgentName || 'selector');
  const [conversations, setConversations] = useState<ConversationTurn[]>([]);
  const [expandedTurns, setExpandedTurns] = useState<Set<number>>(new Set());
  const [sessions, setSessions] = useState<string[]>([]);

  const loadSessions = () => {
    const allSessions = AgentConversationStore.getAllSessions();
    setSessions(allSessions.sort((a, b) => b.localeCompare(a))); // Most recent first
  };

  const loadConversations = () => {
    if (selectedSession) {
      const conv = AgentConversationStore.getConversation(selectedSession, selectedAgent);
      setConversations(conv);
    } else {
      setConversations([]);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  useEffect(() => {
    loadConversations();
  }, [selectedSession, selectedAgent]);

  const toggleExpand = (index: number) => {
    setExpandedTurns(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleSessionChange = (sessionId: string) => {
    setSelectedSession(sessionId);
    setExpandedTurns(new Set());
  };

  const handleAgentChange = (agent: AgentName) => {
    setSelectedAgent(agent);
    setExpandedTurns(new Set());
  };

  const handleRefresh = () => {
    loadSessions();
    loadConversations();
  };

  const agents: AgentName[] = ['selector', 'backtester', 'risk', 'executor'];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/10 border border-accent-primary/20 flex items-center justify-center">
            <MessageSquare size={16} className="text-accent-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-text-primary">Agent 对话历史</h3>
            <p className="text-xs text-text-muted">查看 LLM 调用完整对话</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-accent-primary transition-colors"
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-bg-tertiary text-text-muted hover:text-accent-primary transition-colors"
              title="关闭"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Session Selector */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs text-text-muted mb-1">Session</label>
          <select
            value={selectedSession}
            onChange={(e) => handleSessionChange(e.target.value)}
            className={clsx(
              'w-full px-3 py-2 rounded-lg text-sm bg-bg-secondary border border-border-color',
              'text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors'
            )}
          >
            <option value="">-- 选择 Session --</option>
            {sessions.map(session => (
              <option key={session} value={session}>
                {session.slice(0, 20)}... ({AgentConversationStore.getSessionAgents(session).length} agents)
              </option>
            ))}
          </select>
        </div>

        {/* Agent Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs text-text-muted">Agent:</span>
          {agents.map(agent => (
            <button
              key={agent}
              onClick={() => handleAgentChange(agent)}
              className={clsx(
                'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border',
                selectedAgent === agent
                  ? 'bg-accent-primary/10 text-accent-primary border-accent-primary/30'
                  : 'text-text-muted hover:text-text-secondary border-transparent hover:border-border-color'
              )}
            >
              <span className={selectedAgent === agent ? AGENT_COLORS[agent] : ''}>
                {AGENT_DISPLAY_NAMES[agent]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Stats Bar */}
      {selectedSession && (
        <div className="flex items-center gap-4 px-3 py-2 bg-bg-secondary border border-border-color rounded-lg">
          <div className="flex items-center gap-1.5">
            <MessageSquare size={12} className="text-text-muted" />
            <span className="text-xs text-text-muted">共</span>
            <span className="text-sm font-mono font-bold text-accent-primary">{conversations.length}</span>
            <span className="text-xs text-text-muted">条消息</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bot size={12} className="text-text-muted" />
            <span className="text-xs text-text-muted">{AGENT_DISPLAY_NAMES[selectedAgent]}</span>
          </div>
          <div className="flex-1" />
          <span className="text-xs text-text-muted font-mono truncate max-w-[200px]">
            {selectedSession}
          </span>
        </div>
      )}

      {/* Conversation List */}
      {conversations.length > 0 ? (
        <div className="space-y-2">
          {conversations.map((turn, index) => (
            <TurnCard
              key={`${turn.timestamp}-${index}`}
              turn={turn}
              expanded={expandedTurns.has(index)}
              onToggle={() => toggleExpand(index)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
            <MessageSquare size={20} className="text-text-muted" />
          </div>
          <p className="text-sm text-text-secondary font-medium mb-1">
            {selectedSession ? '暂无对话记录' : '请选择 Session'}
          </p>
          <p className="text-xs text-text-muted">
            {selectedSession
              ? `Agent ${AGENT_DISPLAY_NAMES[selectedAgent]} 在此 Session 中没有 LLM 调用记录`
              : '选择一个 Session 和 Agent 查看对话历史'}
          </p>
        </div>
      )}
    </div>
  );
}
