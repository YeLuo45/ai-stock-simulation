/**
 * Drawdown Alert Card Component
 * Color-coded alert display based on severity level
 */
import { AlertTriangle, AlertOctagon, Info, X } from "lucide-react";
import clsx from "clsx";
import type { AlertRule } from "../services/drawdownEngine";

interface DrawdownAlertCardProps {
  rule: AlertRule;
  currentDrawdown: number;
  onDismiss?: () => void;
}

const SEVERITY_CONFIG = {
  info: {
    label: "提示",
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: Info,
    gradient: "from-blue-500/5 to-transparent",
  },
  warning: {
    label: "警告",
    color: "text-yellow-400",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/30",
    icon: AlertTriangle,
    gradient: "from-yellow-500/5 to-transparent",
  },
  critical: {
    label: "严重",
    color: "text-red-400",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    icon: AlertOctagon,
    gradient: "from-red-500/5 to-transparent",
  },
};

export default function DrawdownAlertCard({ rule, currentDrawdown, onDismiss }: DrawdownAlertCardProps) {
  const cfg = SEVERITY_CONFIG[rule.severity];
  const Icon = cfg.icon;
  const pct = (currentDrawdown * 100).toFixed(1);
  const thresholdPct = (rule.threshold * 100).toFixed(0);
  const exceededBy = ((currentDrawdown - rule.threshold) * 100).toFixed(1);

  return (
    <div
      className={clsx(
        "relative overflow-hidden rounded-xl border p-4",
        cfg.bg,
        cfg.border
      )}
    >
      {/* Gradient background accent */}
      <div
        className={clsx(
          "absolute inset-0 bg-gradient-to-br opacity-50 pointer-events-none",
          cfg.gradient
        )}
      />

      {/* Content */}
      <div className="relative flex items-start gap-3">
        {/* Icon */}
        <div
          className={clsx(
            "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
            cfg.bg,
            cfg.border,
            "border"
          )}
        >
          <Icon size={20} className={cfg.color} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={clsx("text-sm font-semibold", cfg.color)}>
              {cfg.label}
            </span>
            <span className="text-xs text-text-muted">{rule.name}</span>
          </div>

          <p className="text-sm text-text-secondary leading-relaxed">
            当前回撤 <span className={clsx("font-mono font-bold", cfg.color)}>{pct}%</span> ，
            超过阈值 <span className="font-mono">-{thresholdPct}%</span>{" "}
            <span className="text-text-muted">（超出 {exceededBy}%）</span>
          </p>

          {rule.triggered && rule.triggeredAt && (
            <p className="text-xs text-text-muted mt-2">
              触发时间: {new Date(rule.triggeredAt).toLocaleString("zh-CN")}
            </p>
          )}

          {/* Action hints */}
          <div className="flex items-center gap-2 mt-3">
            {rule.actions.includes("browser") && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-bg-tertiary border border-border-color text-text-muted">
                浏览器通知
              </span>
            )}
            {rule.actions.includes("notification") && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-bg-tertiary border border-border-color text-text-muted">
                弹窗通知
              </span>
            )}
            {rule.actions.includes("email") && (
              <span className="text-[10px] px-2 py-0.5 rounded bg-bg-tertiary border border-border-color text-text-muted">
                邮件通知
              </span>
            )}
          </div>
        </div>

        {/* Dismiss */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
