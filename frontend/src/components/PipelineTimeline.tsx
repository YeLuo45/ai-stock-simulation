/**
 * Pipeline Timeline Visualization Component
 * Displays agent durations, token usage, pass rates, and pipeline history using Recharts
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Clock, Tokens, CheckCircle, AlertCircle } from 'lucide-react';
import type { AgentName, PipelineState, PipelineLogEntry } from '../agents/messages';
import { AGENT_DISPLAY_NAMES, AGENT_COLORS } from '../agents/messages';
import { getAgentMetadata, getPipelineLogs, getLastPipelineState } from '../agents/agentStorage';

const COLORS: Record<string, string> = {
  selector: '#3b82f6',   // blue-500
  backtester: '#22c55e', // green-500
  risk: '#eab308',       // yellow-500
  executor: '#a855f7',   // purple-500
  research: '#06b6d4',    // cyan-500
  bull: '#22c55e',       // green-500
  bear: '#ef4444',       // red-500
  judge: '#8b5cf6',      // violet-500
  news: '#f97316',       // orange-500
};

interface AgentRunData {
  agent: string;
  duration: number;      // ms
  status: 'success' | 'error' | 'idle';
  tokens?: { input: number; output: number };
}

interface PipelineTimelineProps {
  currentRun?: {
    traceId: string;
    startTime: number;
    endTime: number;
    agentRuns: Array<{
      agent: AgentName;
      status: 'idle' | 'running' | 'success' | 'error';
      duration?: number;
      tokens?: { input: number; output: number };
    }>;
  };
}

// ============================================================================
// PipelineDurationChart - Horizontal bar chart for agent durations
// ============================================================================
function PipelineDurationChart({ agentRuns }: { agentRuns: AgentRunData[] }) {
  const displayData = agentRuns.map(run => ({
    name: AGENT_DISPLAY_NAMES[run.agent as AgentName] || run.agent,
    fullName: run.agent,
    duration: run.duration,
    status: run.status,
  }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof displayData[0] }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
          <p className="font-medium text-white">{data.name}</p>
          <p className="text-gray-400">耗时: <span className="text-white">{data.duration}ms</span></p>
          <p className="text-gray-400">状态: <span className={`${data.status === 'success' ? 'text-green-400' : data.status === 'error' ? 'text-red-400' : 'text-gray-400'}`}>{data.status}</span></p>
        </div>
      );
    }
    return null;
  };

  if (displayData.length === 0 || displayData.every(d => d.duration === 0)) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
        暂无耗时数据
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Agent 耗时分布</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={displayData}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            tickFormatter={(v: number) => `${v}ms`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11, fill: '#9ca3af' }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="duration" radius={[0, 4, 4, 0]}>
            {displayData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[entry.fullName] || '#6b7280'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// TokenUsageChart - Stacked bar chart for token usage
// ============================================================================
function TokenUsageChart({ agentRuns }: { agentRuns: AgentRunData[] }) {
  const displayData = agentRuns
    .filter(run => run.tokens)
    .map(run => ({
      name: AGENT_DISPLAY_NAMES[run.agent as AgentName] || run.agent,
      fullName: run.agent,
      input: run.tokens?.input || 0,
      output: run.tokens?.output || 0,
      total: (run.tokens?.input || 0) + (run.tokens?.output || 0),
    }));

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof displayData[0] }> }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm">
          <p className="font-medium text-white">{data.name}</p>
          <p className="text-blue-400">Input: <span className="text-white">{data.input.toLocaleString()}</span></p>
          <p className="text-green-400">Output: <span className="text-white">{data.output.toLocaleString()}</span></p>
          <p className="text-gray-400">Total: <span className="text-white">{data.total.toLocaleString()}</span></p>
        </div>
      );
    }
    return null;
  };

  if (displayData.length === 0) {
    return (
      <div className="h-40 flex items-center justify-center text-gray-500 text-sm">
        暂无 Token 使用数据
      </div>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tokens size={14} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-300">Token 使用量</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={displayData}
          margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
        >
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={{ stroke: '#374151' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6b7280' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 10, paddingTop: '10px' }}
            iconSize={8}
          />
          <Bar dataKey="input" stackId="a" fill="#3b82f6" name="Input" />
          <Bar dataKey="output" stackId="a" fill="#22c55e" name="Output" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================================
// PassRateCards - Pass rate metric cards for each agent
// ============================================================================
interface PassRateData {
  agent: AgentName;
  passRate: number;
  totalRuns: number;
  trend: 'up' | 'down' | 'stable';
  recentRate: number;
  olderRate: number;
}

function calculatePassRates(logs: PipelineLogEntry[]): PassRateData[] {
  const agentNames: AgentName[] = ['selector', 'backtester', 'risk', 'executor', 'research', 'bull', 'bear', 'judge', 'news'];

  return agentNames.map(agent => {
    // Filter logs for this agent with success/error status
    const agentLogs = logs.filter(
      log => log.agent === agent && (log.action === 'select' || log.action === 'backtest' || log.action === 'risk_check' || log.action === 'execute')
    );

    // Get the last 10 runs for pass rate calculation
    const recentLogs = agentLogs.slice(-10);
    const successCount = recentLogs.filter(log => !log.details?.toLowerCase().includes('error')).length;
    const passRate = recentLogs.length > 0 ? (successCount / recentLogs.length) * 100 : 0;

    // Calculate trend by comparing last 5 vs previous 5
    const last5 = recentLogs.slice(-5);
    const prev5 = recentLogs.slice(-10, -5);

    const last5Success = last5.filter(log => !log.details?.toLowerCase().includes('error')).length;
    const prev5Success = prev5.filter(log => !log.details?.toLowerCase().includes('error')).length;

    const recentRate = last5.length > 0 ? (last5Success / last5.length) * 100 : 0;
    const olderRate = prev5.length > 0 ? (prev5Success / prev5.length) * 100 : 0;

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (recentRate > olderRate + 10) trend = 'up';
    else if (recentRate < olderRate - 10) trend = 'down';

    return {
      agent,
      passRate: Math.round(passRate),
      totalRuns: recentLogs.length,
      trend,
      recentRate: Math.round(recentRate),
      olderRate: Math.round(olderRate),
    };
  });
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp size={14} className="text-green-400" />;
  if (trend === 'down') return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-gray-400" />;
}

function PassRateCard({ data }: { data: PassRateData }) {
  const displayName = AGENT_DISPLAY_NAMES[data.agent];
  const color = COLORS[data.agent];

  return (
    <div className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium" style={{ color }}>{displayName}</span>
        <TrendIcon trend={data.trend} />
      </div>
      <div className="flex items-end gap-1">
        <span className="text-2xl font-bold text-white">{data.passRate}</span>
        <span className="text-sm text-gray-400 mb-1">%</span>
      </div>
      <div className="text-xs text-gray-500">
        {data.totalRuns} 次运行
      </div>
    </div>
  );
}

function PassRateCards() {
  const [passRates, setPassRates] = useState<PassRateData[]>([]);

  useEffect(() => {
    const logs = getPipelineLogs();
    setPassRates(calculatePassRates(logs));
  }, []);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle size={14} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-300">通过率统计</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {passRates.map(pr => (
          <PassRateCard key={pr.agent} data={pr} />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// PipelineHistoryList - Collapsible list of recent pipeline runs
// ============================================================================
interface PipelineHistoryItem {
  traceId: string;
  startTime: number;
  endTime?: number;
  duration: number;
  status: 'success' | 'error' | 'partial';
  errors: number;
}

function PipelineHistoryList() {
  const [history, setHistory] = useState<PipelineHistoryItem[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const logs = getPipelineLogs();
    const lastState = getLastPipelineState();

    // Group logs by traceId and find cycle completions
    const cycleLogs = logs.filter(l => l.agent === 'supervisor' && l.action === 'cycle_complete');
    const recentCycles = cycleLogs.slice(-10).reverse();

    const historyItems: PipelineHistoryItem[] = recentCycles.map(log => {
      const stateForTrace = logs.filter(l => l.traceId === log.traceId);
      const errorCount = stateForTrace.filter(l => l.details?.toLowerCase().includes('error')).length;

      return {
        traceId: log.traceId,
        startTime: log.timestamp - log.duration,
        endTime: log.timestamp,
        duration: log.duration,
        status: errorCount === 0 ? 'success' : errorCount > 2 ? 'error' : 'partial',
        errors: errorCount,
      };
    });

    // Include last pipeline state if not in history
    if (lastState && !historyItems.find(h => h.traceId === lastState.traceId)) {
      historyItems.unshift({
        traceId: lastState.traceId,
        startTime: lastState.startTime,
        endTime: lastState.endTime,
        duration: (lastState.endTime || Date.now()) - lastState.startTime,
        status: lastState.errors.length === 0 ? 'success' : lastState.errors.length > 2 ? 'error' : 'partial',
        errors: lastState.errors.length,
      });
    }

    setHistory(historyItems.slice(0, 10));
  }, []);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const StatusBadge = ({ status, errors }: { status: string; errors: number }) => {
    if (status === 'success') return <span className="text-green-400 text-xs">成功</span>;
    if (status === 'error') return <span className="text-red-400 text-xs">失败</span>;
    return (
      <span className="text-yellow-400 text-xs flex items-center gap-1">
        <AlertCircle size={10} />
        {errors} 错误
      </span>
    );
  };

  if (history.length === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Pipeline 历史</span>
        </div>
        <div className="text-center text-gray-500 text-sm py-4">暂无历史记录</div>
      </div>
    );
  }

  const displayHistory = expanded ? history : history.slice(0, 5);

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <button
        className="w-full flex items-center justify-between mb-3"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Pipeline 历史</span>
          <span className="text-xs text-gray-500">({history.length})</span>
        </div>
        {expanded ? (
          <ChevronUp size={14} className="text-gray-400" />
        ) : (
          <ChevronDown size={14} className="text-gray-400" />
        )}
      </button>

      <div className="space-y-2">
        {displayHistory.map((item, idx) => (
          <div
            key={item.traceId}
            className="flex items-center justify-between py-2 px-3 bg-gray-700/50 rounded-lg text-sm"
          >
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-mono text-xs">
                {formatTime(item.startTime)}
              </span>
              <StatusBadge status={item.status} errors={item.errors} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-400 font-mono text-xs">
                {formatDuration(item.duration)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main PipelineTimeline Component
// ============================================================================
export default function PipelineTimeline({ currentRun }: PipelineTimelineProps) {
  const [agentRuns, setAgentRuns] = useState<AgentRunData[]>([]);

  const buildAgentRuns = useCallback(() => {
    if (currentRun?.agentRuns) {
      return currentRun.agentRuns.map(run => ({
        agent: run.agent,
        duration: run.duration || 0,
        status: run.status === 'running' ? 'idle' : run.status === 'success' ? 'success' : run.status === 'error' ? 'error' : 'idle',
        tokens: run.tokens,
      }));
    }

    // Fallback: build from agent metadata
    const agentNames: AgentName[] = ['selector', 'backtester', 'risk', 'executor', 'research', 'bull', 'bear', 'judge', 'news'];
    return agentNames.map(name => {
      const metadata = getAgentMetadata(name);
      return {
        agent: name,
        duration: metadata?.lastDuration || 0,
        status: metadata?.status === 'success' ? 'success' : metadata?.status === 'error' ? 'error' : 'idle',
      };
    });
  }, [currentRun]);

  useEffect(() => {
    setAgentRuns(buildAgentRuns());
  }, [buildAgentRuns]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Pipeline Duration Chart */}
      <div className="lg:col-span-2">
        <PipelineDurationChart agentRuns={agentRuns} />
      </div>

      {/* Token Usage Chart */}
      <div className="lg:col-span-2">
        <TokenUsageChart agentRuns={agentRuns} />
      </div>

      {/* Pass Rate Cards */}
      <div className="lg:col-span-2">
        <PassRateCards />
      </div>

      {/* Pipeline History */}
      <div className="lg:col-span-2">
        <PipelineHistoryList />
      </div>
    </div>
  );
}
