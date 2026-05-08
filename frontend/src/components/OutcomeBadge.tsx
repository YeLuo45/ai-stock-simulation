/**
 * OutcomeBadge - Display outcome status with colored badge
 * 🟡 pending | 🟢 profit | 🔴 loss | ⏸ stop_loss | 🏆 take_profit
 */
import clsx from "clsx";

export type OutcomeType = 'pending' | 'profit' | 'loss' | 'stop_loss' | 'take_profit';

interface OutcomeBadgeProps {
  outcome: OutcomeType | undefined;
  className?: string;
  size?: 'sm' | 'md';
}

const OUTCOME_CONFIG: Record<OutcomeType, { label: string; icon: string; color: string; bg: string }> = {
  pending: { label: '待验证', icon: '🟡', color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  profit: { label: '盈利', icon: '🟢', color: 'text-green-400', bg: 'bg-green-400/10' },
  loss: { label: '亏损', icon: '🔴', color: 'text-red-400', bg: 'bg-red-400/10' },
  stop_loss: { label: '止损', icon: '⏸', color: 'text-orange-400', bg: 'bg-orange-400/10' },
  take_profit: { label: '止盈', icon: '🏆', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
};

export default function OutcomeBadge({ outcome, className, size = 'sm' }: OutcomeBadgeProps) {
  if (!outcome) return null;
  
  const config = OUTCOME_CONFIG[outcome];
  if (!config) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-medium",
        config.color,
        config.bg,
        size === 'sm' ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
