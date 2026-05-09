/**
 * Drawdown Dashboard Component
 * Equity curve chart, alert records, and threshold configuration
 */
import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useStore } from "../store";
import {
  computeDrawdown,
  getEquitySnapshots,
  getAlertRules,
  getAlertEvents,
  trackEquitySnapshot,
  type EquitySnapshot,
  type AlertEvent,
  type DrawdownResult,
} from "../services/drawdownEngine";
import type { AlertRule } from "../services/drawdownEngine";
import AlertRuleEditor from "./AlertRuleEditor";
import DrawdownAlertCard from "./DrawdownAlertCard";
import {
  Shield,
  TrendingDown,
  Clock,
  AlertTriangle,
  History,
  Settings2,
  X,
  RefreshCw,
  BarChart3,
} from "lucide-react";
import clsx from "clsx";

interface DrawdownDashboardProps {
  onClose?: () => void;
}

type Tab = "dashboard" | "rules" | "history";

export default function DrawdownDashboard({ onClose }: DrawdownDashboardProps) {
  const { portfolio } = useStore();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [drawdownResult, setDrawdownResult] = useState<DrawdownResult | null>(null);
  const [snapshots, setSnapshots] = useState<EquitySnapshot[]>([]);
  const [alertRules, setAlertRules] = useState<AlertRule[]>([]);
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [historyFilter, setHistoryFilter] = useState<"all" | "info" | "warning" | "critical">("all");

  // Initialize data
  useEffect(() => {
    // Track current portfolio value as snapshot
    if (portfolio) {
      const currentValue = portfolio.total_assets;
      trackEquitySnapshot(currentValue);
    }

    // Load data
    setSnapshots(getEquitySnapshots());
    setDrawdownResult(computeDrawdown());
    setAlertRules(getAlertRules());
    setAlertEvents(getAlertEvents());
  }, [portfolio]);

  const refreshData = () => {
    setSnapshots(getEquitySnapshots());
    setDrawdownResult(computeDrawdown());
    setAlertRules(getAlertRules());
    setAlertEvents(getAlertEvents());
  };

  // Prepare chart data
  const chartData = snapshots.map(s => ({
    time: new Date(s.timestamp).toLocaleString("zh-CN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    value: s.value,
    drawdown: s.drawdown,
  }));

  // Get next threshold
  const getNextThreshold = () => {
    const current = drawdownResult?.currentDrawdown || 0;
    const enabledRules = alertRules.filter(r => r.enabled && r.threshold > current);
    if (enabledRules.length === 0) return null;
    return enabledRules.sort((a, b) => a.threshold - b.threshold)[0];
  };

  const nextThreshold = getNextThreshold();
  const exceededRules = alertRules.filter(r => r.enabled && (drawdownResult?.currentDrawdown || 0) <= r.threshold);

  // Format duration
  const formatDuration = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}分钟`;
    if (hours < 24) return `${Math.round(hours)}小时`;
    return `${Math.round(hours / 24)}天`;
  };

  // Filtered events
  const filteredEvents = historyFilter === "all"
    ? alertEvents
    : alertEvents.filter(e => e.severity === historyFilter);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-bg-primary border border-border-color rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-color">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
              <Shield size={20} className="text-accent-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">回撤预警系统</h2>
              <p className="text-xs text-text-muted">实时监控组合回撤风险</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={refreshData}
              className="p-2 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
              title="刷新"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 py-3 border-b border-border-color">
          {[
            { id: "dashboard", label: "总览", icon: BarChart3 },
            { id: "rules", label: "规则配置", icon: Settings2 },
            { id: "history", label: "预警历史", icon: History },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as Tab)}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-accent-primary/10 text-accent-primary"
                  : "text-text-muted hover:text-text-secondary hover:bg-bg-tertiary"
              )}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Dashboard Tab */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              {/* Current Status Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Current Drawdown */}
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted uppercase">当前回撤</span>
                  </div>
                  <p
                    className={clsx(
                      "text-2xl font-bold font-mono",
                      (drawdownResult?.currentDrawdown || 0) <= -0.2
                        ? "text-red-400"
                        : (drawdownResult?.currentDrawdown || 0) <= -0.1
                        ? "text-yellow-400"
                        : "text-blue-400"
                    )}
                  >
                    {((drawdownResult?.currentDrawdown || 0) * 100).toFixed(2)}%
                  </p>
                </div>

                {/* Max Drawdown */}
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted uppercase">历史最大</span>
                  </div>
                  <p className="text-2xl font-bold font-mono text-red-400">
                    {((drawdownResult?.maxDrawdown || 0) * 100).toFixed(2)}%
                  </p>
                </div>

                {/* Peak Value */}
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted uppercase">峰值</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-accent-success">
                    ¥{(drawdownResult?.peakValue || 0).toLocaleString("zh-CN", { maximumFractionDigits: 0 })}
                  </p>
                </div>

                {/* Duration */}
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={14} className="text-text-muted" />
                    <span className="text-xs text-text-muted uppercase">回撤持续</span>
                  </div>
                  <p className="text-lg font-bold font-mono text-text-primary">
                    {drawdownResult?.inDrawdown
                      ? formatDuration(drawdownResult.drawdownDuration || 0)
                      : "--"}
                  </p>
                </div>
              </div>

              {/* Next Threshold Warning */}
              {nextThreshold && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle size={16} className="text-yellow-400" />
                    <span className="text-sm font-medium text-yellow-400">预警提示</span>
                  </div>
                  <p className="text-sm text-text-secondary">
                    距离下一阈值{" "}
                    <span className="font-mono text-yellow-400">
                      {(nextThreshold.threshold * 100).toFixed(0)}%
                    </span>{" "}
                    还需回撤{" "}
                    <span className="font-mono text-text-primary">
                      {(((nextThreshold.threshold - (drawdownResult?.currentDrawdown || 0)) * 100).toFixed(1))}%
                    </span>
                  </p>
                </div>
              )}

              {/* Active Alerts */}
              {exceededRules.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-text-primary">当前预警</h3>
                  {exceededRules.map(rule => (
                    <DrawdownAlertCard
                      key={rule.id}
                      rule={rule}
                      currentDrawdown={drawdownResult?.currentDrawdown || 0}
                    />
                  ))}
                </div>
              )}

              {/* Equity Curve Chart */}
              {chartData.length > 0 && (
                <div className="bg-bg-secondary border border-border-color rounded-xl p-4">
                  <h3 className="text-sm font-medium text-text-primary mb-4">净值曲线</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
                        <XAxis
                          dataKey="time"
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                          tickLine={false}
                          axisLine={{ stroke: "#374151" }}
                        />
                        <YAxis
                          tick={{ fontSize: 10, fill: "#9ca3af" }}
                          tickLine={false}
                          axisLine={{ stroke: "#374151" }}
                          tickFormatter={v => `¥${(v / 10000).toFixed(0)}万`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#1f2937",
                            border: "1px solid #374151",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          formatter={(value: number) => [
                            `¥${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
                            "净值",
                          ]}
                        />
                        {alertRules
                          .filter(r => r.enabled)
                          .map(rule => (
                            <ReferenceLine
                              key={rule.id}
                              y={drawdownResult?.peakValue
                                ? drawdownResult.peakValue * (1 + rule.threshold)
                                : 0}
                              stroke={
                                rule.severity === "critical"
                                  ? "#ef4444"
                                  : rule.severity === "warning"
                                  ? "#eab308"
                                  : "#3b82f6"
                              }
                              strokeDasharray="5 5"
                              label={{
                                value: `${(rule.threshold * 100).toFixed(0)}%`,
                                position: "right",
                                fontSize: 10,
                                fill:
                                  rule.severity === "critical"
                                    ? "#ef4444"
                                    : rule.severity === "warning"
                                    ? "#eab308"
                                    : "#3b82f6",
                              }}
                            />
                          ))}
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#6366f1"
                          strokeWidth={2}
                          fill="url(#equityGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {chartData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <BarChart3 size={48} className="text-text-muted mb-4" />
                  <p className="text-text-secondary font-medium mb-1">暂无净值数据</p>
                  <p className="text-text-muted text-sm">开始交易后将自动记录净值变化</p>
                </div>
              )}
            </div>
          )}

          {/* Rules Tab */}
          {tab === "rules" && (
            <AlertRuleEditor />
          )}

          {/* History Tab */}
          {tab === "history" && (
            <div className="space-y-4">
              {/* Filter */}
              <div className="flex gap-2">
                {(["all", "info", "warning", "critical"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setHistoryFilter(f)}
                    className={clsx(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      historyFilter === f
                        ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/30"
                        : "bg-bg-secondary text-text-muted border border-border-color hover:border-accent-primary/30"
                    )}
                  >
                    {f === "all" ? "全部" : f === "info" ? "提示" : f === "warning" ? "警告" : "严重"}
                  </button>
                ))}
              </div>

              {/* Events Table */}
              {filteredEvents.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-color">
                        {["时间", "规则", "回撤值", "阈值", "触发时间", "恢复时间", "持续时长"].map(h => (
                          <th
                            key={h}
                            className="text-left px-4 py-3 text-xs font-medium text-text-muted uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEvents.map(event => (
                        <tr
                          key={event.id}
                          className="border-b border-border-color/50 hover:bg-bg-tertiary/30 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {new Date(event.triggeredAt).toLocaleString("zh-CN", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={clsx(
                                "text-xs px-2 py-0.5 rounded",
                                event.severity === "critical"
                                  ? "bg-red-500/10 text-red-400"
                                  : event.severity === "warning"
                                  ? "bg-yellow-500/10 text-yellow-400"
                                  : "bg-blue-500/10 text-blue-400"
                              )}
                            >
                              {event.ruleName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-red-400">
                            {(event.drawdownValue * 100).toFixed(2)}%
                          </td>
                          <td className="px-4 py-3 text-sm font-mono text-text-secondary">
                            {(event.threshold * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {event.triggeredAt
                              ? new Date(event.triggeredAt).toLocaleTimeString("zh-CN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "--"}
                          </td>
                          <td className="px-4 py-3 text-sm text-text-secondary">
                            {event.recoveredAt
                              ? new Date(event.recoveredAt).toLocaleTimeString("zh-CN", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "--"}
                          </td>
                          <td className="px-4 py-3 text-sm text-text-muted">
                            {event.duration ? formatDuration(event.duration) : "--"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <History size={48} className="text-text-muted mb-4" />
                  <p className="text-text-secondary font-medium mb-1">暂无预警记录</p>
                  <p className="text-text-muted text-sm">当回撤超过阈值时将自动记录</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
