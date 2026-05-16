/**
 * DebatePanel - 辩论面板
 * Displays bull arguments, bear arguments, and judge decision
 */

import { useMemo } from 'react';
import type { DebateResult, DebateArgument } from '../services/debate/types';
import { DECISION_LABELS, TRADE_ACTION_LABELS } from '../services/debate/types';
import { useStore } from '../store';

interface DebatePanelProps {
  debate: DebateResult | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

function ArgumentCard({ arg, side }: { arg: DebateArgument; side: 'bull' | 'bear' }) {
  const isBull = side === 'bull';
  const borderColor = isBull ? 'border-l-green-500' : 'border-l-red-500';
  const bgColor = isBull ? 'bg-green-50' : 'bg-red-50';
  const textColor = isBull ? 'text-green-800' : 'text-red-800';
  const weightColor = isBull ? 'bg-green-500' : 'bg-red-500';

  return (
    <div className={`border-l-4 ${borderColor} ${bgColor} p-3 rounded-r-lg mb-2`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className={`font-medium ${textColor}`}>{arg.point}</p>
          {arg.evidence && (
            <p className="text-xs text-gray-600 mt-1 italic">📎 {arg.evidence}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-medium ${textColor}`}>
            权重 {Math.round(arg.weight * 100)}%
          </span>
          <div className={`w-12 h-1.5 rounded-full ${weightColor} opacity-60`}>
            <div
              className={`h-full rounded-full ${weightColor}`}
              style={{ width: `${arg.weight * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function JudgeScoreBar({ bullScore, bearScore }: { bullScore: number; bearScore: number }) {
  const total = bullScore + bearScore;
  const bullPct = total > 0 ? (bullScore / total) * 100 : 50;

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-green-600 font-medium">🐂 多方 {bullScore.toFixed(1)}</span>
        <span className="text-red-600 font-medium">🐻 空方 {bearScore.toFixed(1)}</span>
      </div>
      <div className="h-4 rounded-full overflow-hidden flex">
        <div
          className="bg-green-500 transition-all duration-500"
          style={{ width: `${bullPct}%` }}
        />
        <div
          className="bg-red-500 transition-all duration-500"
          style={{ width: `${100 - bullPct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mt-0.5">
        <span>{bullPct.toFixed(0)}% 多方</span>
        <span>{(100 - bullPct).toFixed(0)}% 空方</span>
      </div>
    </div>
  );
}

function VerdictBadge({ decision, confidence }: { decision: DebateResult['decision']; confidence: number }) {
  const configs: Record<string, { bg: string; text: string; label: string }> = {
    STRONG_BUY: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ 强烈买入' },
    BUY: { bg: 'bg-green-100', text: 'text-green-800', label: '✅ 买入' },
    HOLD: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏸️ 观望' },
    SELL: { bg: 'bg-red-100', text: 'text-red-800', label: '🚨 卖出' },
    STRONG_SELL: { bg: 'bg-red-100', text: 'text-red-800', label: '🚨 强烈卖出' },
  };
  const cfg = configs[decision] || configs.HOLD;

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${cfg.bg} ${cfg.text} font-bold`}>
      <span>{cfg.label}</span>
      <span className="text-sm opacity-75">置信度 {Math.round(confidence * 100)}%</span>
    </div>
  );
}

export function DebatePanel({ debate, isLoading, onRefresh }: DebatePanelProps) {
  const formattedTime = useMemo(() => {
    if (!debate?.timestamp) return '';
    const d = new Date(debate.timestamp);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [debate?.timestamp]);

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="inline-block w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-gray-600">辩论进行中...</p>
      </div>
    );
  }

  if (!debate) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-4xl mb-2">⚖️</p>
        <p>暂无辩论记录</p>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="mt-4 px-4 py-2 bg-accent-primary/10 text-accent-primary rounded-lg text-sm hover:bg-accent-primary/20"
          >
            刷新
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-gray-800">
            辩论裁决
            {debate.symbol && <span className="ml-2 text-cyan-600">{debate.symbol}</span>}
          </h3>
          <p className="text-xs text-gray-400">
            {formattedTime}
          </p>
        </div>
        <VerdictBadge decision={debate.decision} confidence={debate.confidence} />
      </div>

      {/* Judge Score Bar */}
      <JudgeScoreBar bullScore={debate.bullScore} bearScore={debate.bearScore} />

      {/* Arguments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Bull Arguments */}
        <div>
          <h4 className="text-sm font-semibold text-green-600 mb-2 flex items-center gap-1">
            <span>🐂</span> 多方论点
            <span className="text-xs text-gray-400 font-normal">({debate.bullArguments?.length || 0}条)</span>
          </h4>
          {debate.bullArguments && debate.bullArguments.length > 0 ? (
            debate.bullArguments.map((arg, i) => (
              <ArgumentCard key={i} arg={arg} side="bull" />
            ))
          ) : (
            <p className="text-sm text-gray-400 italic">无多方论点</p>
          )}
        </div>

        {/* Bear Arguments */}
        <div>
          <h4 className="text-sm font-semibold text-red-600 mb-2 flex items-center gap-1">
            <span>🐻</span> 空方论点
            <span className="text-xs text-gray-400 font-normal">({debate.bearArguments?.length || 0}条)</span>
          </h4>
          {debate.bearArguments && debate.bearArguments.length > 0 ? (
            debate.bearArguments.map((arg, i) => (
              <ArgumentCard key={i} arg={arg} side="bear" />
            ))
          ) : (
            <p className="text-sm text-gray-400 italic">无空方论点</p>
          )}
        </div>
      </div>

      {/* Reasoning */}
      {debate.reasoning && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-3">
          <h4 className="text-xs font-semibold text-cyan-700 mb-1 flex items-center gap-1">
            <span>⚖️</span> 裁判推理
          </h4>
          <p className="text-sm text-gray-700">{debate.reasoning}</p>
        </div>
      )}

      {/* Trade Action */}
      <div className="mt-4 flex items-center gap-3 p-3 bg-bg-tertiary rounded-lg">
        <span className="text-xs text-gray-500">执行建议:</span>
        <span className={`text-sm font-medium ${
          debate.tradeAction === 'BUY' ? 'text-green-600' :
          debate.tradeAction === 'SELL' ? 'text-red-600' : 'text-gray-600'
        }`}>
          {TRADE_ACTION_LABELS[debate.tradeAction]} {debate.tradeQuantityPct > 0 ? `(${debate.tradeQuantityPct}%)` : ''}
        </span>
      </div>

      {/* Confidence indicator */}
      <div className="mt-4 flex items-center gap-3">
        <span className="text-xs text-gray-500">决策置信度:</span>
        <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              debate.confidence >= 0.7
                ? 'bg-green-500'
                : debate.confidence >= 0.4
                ? 'bg-yellow-500'
                : 'bg-gray-400'
            }`}
            style={{ width: `${debate.confidence * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          debate.confidence >= 0.7
            ? 'text-green-600'
            : debate.confidence >= 0.4
            ? 'text-yellow-600'
            : 'text-gray-500'
        }`}>
          {debate.confidence >= 0.7 ? '高 → 全量执行' :
           debate.confidence >= 0.4 ? '中 → 50%执行' : '低 → 跳过'}
        </span>
      </div>
    </div>
  );
}

export default DebatePanel;