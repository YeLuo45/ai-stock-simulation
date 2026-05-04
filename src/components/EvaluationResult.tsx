/**
 * EvaluationResult - 新股评估结果展示组件
 */
import clsx from "clsx";
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown, AlertTriangle, Star } from "lucide-react";
import type { IPOEvaluationResult, Recommendation } from "../types";

const RECOMMENDATION_CONFIG: Record<Recommendation, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  "强烈推荐": { label: "强烈推荐", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <Star size={14} className="fill-green-500 text-green-500" /> },
  "推荐": { label: "推荐", color: "text-blue-700", bg: "bg-blue-50 border-blue-200", icon: <ArrowUp size={14} className="text-blue-500" /> },
  "中性": { label: "中性", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", icon: <Minus size={14} className="text-yellow-500" /> },
  "回避": { label: "回避", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: <ArrowDown size={14} className="text-orange-500" /> },
  "强烈回避": { label: "强烈回避", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: <AlertTriangle size={14} className="text-red-500" /> },
};

const TREND_CONFIG = {
  上涨: { icon: <TrendingUp size={14} />, color: "text-red-500 bg-red-50" },
  下跌: { icon: <TrendingDown size={14} />, color: "text-green-500 bg-green-50" },
  震荡: { icon: <Minus size={14} />, color: "text-gray-500 bg-gray-50" },
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "text-green-500" : score >= 50 ? "text-yellow-500" : "text-red-500";
  const pct = Math.min(100, Math.max(0, score));
  const colorBar = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r="50"
            fill="none"
            className={colorBar}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 50}`}
            strokeDashoffset={`${2 * Math.PI * 50 * (1 - pct / 100)}`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={clsx("text-3xl font-bold", color)}>{score}</span>
          <span className="text-xs text-slate-500">/ 100</span>
        </div>
      </div>
    </div>
  );
}

function DataCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <h5 className="text-sm font-semibold text-slate-700 mb-3">{title}</h5>
      {children}
    </div>
  );
}

function MetricRow({ label, value, unit = "" }: { label: string; value?: number | string; unit?: string }) {
  if (value === undefined || value === null || value === "") {
    return (
      <div className="flex justify-between items-center py-1.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-xs text-slate-400">—</span>
      </div>
    );
  }
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xs font-medium text-slate-800">
        {typeof value === "number" ? value.toLocaleString() : value}
        {unit && <span className="text-slate-400 ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}

interface EvaluationResultProps {
  result: IPOEvaluationResult;
}

export default function EvaluationResult({ result }: EvaluationResultProps) {
  const recConfig = RECOMMENDATION_CONFIG[result.recommendation] || RECOMMENDATION_CONFIG["中性"];
  const trendConfig = TREND_CONFIG[result.technical.trend] || TREND_CONFIG["震荡"];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header: Score + Recommendation */}
      <div className={clsx("rounded-xl border p-5 flex flex-col sm:flex-row items-center gap-5", recConfig.bg)}>
        <ScoreGauge score={result.score} />
        <div className="flex-1 text-center sm:text-left">
          <div className="flex items-center gap-2 justify-center sm:justify-start mb-1">
            <span className={clsx("font-bold text-lg", recConfig.color)}>{recConfig.label}</span>
            {recConfig.icon}
          </div>
          <p className="text-sm text-slate-600 font-medium">
            {result.stock_name}（{result.stock_code}）
          </p>
          <p className="text-xs text-slate-500 mt-1">
            评估时间：{new Date(result.evaluated_at).toLocaleString("zh-CN")}
          </p>
          {result.data_sources.length > 0 && (
            <p className="text-xs text-slate-400 mt-0.5">
              数据源：{result.data_sources.join(", ")}
            </p>
          )}
        </div>
      </div>

      {/* AI Analysis */}
      {result.analysis && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4">
          <h5 className="text-sm font-semibold text-blue-700 mb-2">💡 AI综合分析</h5>
          <p className="text-sm text-slate-700 leading-relaxed">{result.analysis}</p>
        </div>
      )}

      {/* Fundamental + Technical */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <DataCard title="📊 基本面数据">
          <div className="space-y-0.5">
            <MetricRow label="市盈率 (PE)" value={result.fundamental.pe} />
            <MetricRow label="市净率 (PB)" value={result.fundamental.pb} />
            <MetricRow label="净资产收益率 (ROE)" value={result.fundamental.roe} unit="%" />
            <MetricRow label="销售毛利率" value={result.fundamental.gross_margin} unit="%" />
            <MetricRow label="发行价" value={result.fundamental.issue_price} />
            <MetricRow label="当前价格" value={result.fundamental.current_price} />
            <MetricRow label="上市天数" value={result.fundamental.listing_days} unit="天" />
          </div>
        </DataCard>

        <DataCard title="📈 技术面数据">
          <div className="space-y-0.5">
            <div className="flex justify-between items-center py-1.5">
              <span className="text-xs text-slate-500">趋势</span>
              <span className={clsx("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded", trendConfig.color)}>
                {trendConfig.icon}
                {result.technical.trend}
              </span>
            </div>
            <MetricRow label="RSI (14)" value={result.technical.rsi} />
            <MetricRow label="MACD 信号" value={result.technical.macd_signal} />
            <MetricRow label="MA5" value={result.technical.ma5} />
            <MetricRow label="MA20" value={result.technical.ma20} />
            <MetricRow label="支撑位" value={result.technical.support_level} />
            <MetricRow label="压力位" value={result.technical.resistance_level} />
            <MetricRow label="涨跌幅" value={result.technical.change_pct} unit="%" />
          </div>
        </DataCard>
      </div>

      {/* Disclaimer */}
      <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3">
        <p className="text-xs text-yellow-700">
          ⚠️ 评估结果仅供参考，不构成投资建议。新股/次新股风险较高，请自行判断。
        </p>
      </div>
    </div>
  );
}
