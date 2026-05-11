/**
 * Agent Monitor Component
 * Real-time status panel showing 4 agent cards with status dots, last run time, duration
 * and a line chart of recent pipeline latencies (last 5 runs)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ChevronDown, ChevronUp, Bot, Activity } from 'lucide-react';
import type { AgentMetadata, PipelineLogEntry, AgentName } from './messages';
import { AGENT_DISPLAY_NAMES, AGENT_COLORS, AGENT_BG_COLORS } from './messages';
import { getAgentMetadata, getPipelineLogs } from './agentStorage';

interface AgentCardData {
  name: AgentName;
  metadata: AgentMetadata | null;
}

function AgentStatusDot({ status }: { status: AgentMetadata['status'] }) {
  const colorMap: Record<AgentMetadata['status'], string> = {
    idle: 'bg-gray-400',
    running: 'bg-yellow-400 animate-pulse',
    success: 'bg-green-400',
    error: 'bg-red-400',
  };
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full ${colorMap[status]}`}
      aria-label={status}
    />
  );
}

function AgentCard({ name, metadata }: AgentCardData) {
  const displayName = AGENT_DISPLAY_NAMES[name];
  const colorClass = AGENT_COLORS[name];
  const bgColorClass = AGENT_BG_COLORS[name];
  const status = metadata?.status ?? 'idle';
  const lastRun = metadata?.lastRun;
  const lastDuration = metadata?.lastDuration;
  const lastError = metadata?.lastError;

  const formatTime = (ts?: number) => {
    if (!ts) return '从未';
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms?: number) => {
    if (ms === undefined) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="bg-bg-secondary border border-border-color rounded-xl p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AgentStatusDot status={status} />
          <span className={`font-semibold ${colorClass}`}>{displayName}</span>
        </div>
        <span className="text-xs text-text-muted font-mono">{name}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex flex-col">
          <span className="text-text-muted text-xs">最后运行</span>
          <span className="font-mono text-text-primary">{formatTime(lastRun)}</span>
        </div>
        <div className="flex flex-col">
          <span className="text-text-muted text-xs">本次耗时</span>
          <span className="font-mono text-text-primary">{formatDuration(lastDuration)}</span>
        </div>
      </div>

      {/* Status text */}
      <div className="text-xs text-text-secondary">
        状态:{' '}
        <span className={`font-medium ${status === 'error' ? 'text-red-400' : status === 'success' ? 'text-green-400' : 'text-text-muted'}`}>
          {status === 'idle' ? '空闲' : status === 'running' ? '运行中' : status === 'success' ? '成功' : '错误'}
        </span>
      </div>

      {/* Error message */}
      {status === 'error' && lastError && (
        <div className="text-xs text-red-400 bg-red-950/30 rounded px-2 py-1 truncate" title={lastError}>
          {lastError}
        </div>
      )}
    </div>
  );
}

function PipelineLatencyChart({ latencies }: { latencies: { index: number; latency: number }[] }) {
  if (latencies.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-text-muted text-sm">
        暂无管道延迟数据
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={120}>
      <LineChart data={latencies} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
        <XAxis
          dataKey="index"
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={{ stroke: '#374151' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 10, fill: '#6b7280' }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${v}ms`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          labelFormatter={(label) => `第 ${label + 1} 次`}
          formatter={(value: number) => [`${value}ms`, '延迟']}
        />
        <Line
          type="monotone"
          dataKey="latency"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ fill: '#8b5cf6', r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function LogEntryRow({ entry }: { entry: PipelineLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const agentDisplayName = entry.agent === 'supervisor' ? '主管' : AGENT_DISPLAY_NAMES[entry.agent];

  return (
    <div className="border-b border-border-color last:border-0">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-bg-tertiary transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <span className={`font-medium ${entry.agent === 'supervisor' ? 'text-text-primary' : AGENT_COLORS[entry.agent]}`}>
            {agentDisplayName}
          </span>
          <span className="text-text-muted text-xs">{entry.action}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-text-muted font-mono text-xs">{entry.duration}ms</span>
          {expanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
        </div>
      </button>
      {expanded && entry.details && (
        <div className="px-3 pb-2 text-xs text-text-secondary">
          {entry.details}
        </div>
      )}
    </div>
  );
}

export default function AgentMonitor() {
  const [agents, setAgents] = useState<AgentCardData[]>([
    { name: 'selector', metadata: null },
    { name: 'backtester', metadata: null },
    { name: 'risk', metadata: null },
    { name: 'executor', metadata: null },
  ]);
  const [logs, setLogs] = useState<PipelineLogEntry[]>([]);
  const [latencies, setLatencies] = useState<{ index: number; latency: number }[]>([]);
  const [logsExpanded, setLogsExpanded] = useState(false);

  const refreshData = useCallback(() => {
    const agentNames: AgentName[] = ['selector', 'backtester', 'risk', 'executor'];
    const updated = agentNames.map(name => ({
      name,
      metadata: getAgentMetadata(name),
    }));
    setAgents(updated);

    const allLogs = getPipelineLogs();
    setLogs(allLogs.slice(-10).reverse());

    // Compute latencies from logs where agent === 'supervisor' and action === 'cycle_complete'
    const cycleLogs = allLogs.filter(l => l.agent === 'supervisor' && l.action === 'cycle_complete');
    const recentCycles = cycleLogs.slice(-5);
    setLatencies(recentCycles.map((l, i) => ({ index: i, latency: l.duration })));
  }, []);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 2000);
    return () => clearInterval(interval);
  }, [refreshData]);

  return (
    <div className="bg-bg-primary rounded-xl border border-border-color overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border-color bg-bg-secondary">
        <Bot size={18} className="text-accent-primary" />
        <span className="font-semibold text-text-primary">Agent 监控面板</span>
        <span className="text-xs text-text-muted ml-auto">
          {agents.filter(a => a.metadata?.status === 'running').length} 运行中
        </span>
      </div>

      {/* Agent Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4">
        {agents.map(agent => (
          <AgentCard key={agent.name} name={agent.name} metadata={agent.metadata} />
        ))}
      </div>

      {/* Latency Chart */}
      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 mb-2">
          <Activity size={14} className="text-text-muted" />
          <span className="text-xs text-text-muted font-medium">管道延迟 (最近5次)</span>
        </div>
        <PipelineLatencyChart latencies={latencies} />
      </div>

      {/* Pipeline Logs */}
      <div className="border-t border-border-color">
        <button
          className="w-full flex items-center justify-between px-4 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
          onClick={() => setLogsExpanded(!logsExpanded)}
        >
          <span className="font-medium">管道日志</span>
          <span className="text-xs text-text-muted">{logs.length} 条</span>
          {logsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
        {logsExpanded && (
          <div className="max-h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <div className="px-4 py-6 text-center text-text-muted text-sm">暂无日志</div>
            ) : (
              logs.map(entry => <LogEntryRow key={entry.id} entry={entry} />)
            )}
          </div>
        )}
      </div>
    </div>
  );
}
