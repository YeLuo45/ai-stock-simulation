/**
 * IPOEvaluationPage - 新股价值评估页面
 * IPO/次新股基本面+技术面综合评估
 */
import { useState, useCallback } from "react";
import { useStore } from "../store";
import { evaluateIPO } from "../services/api";
import StockSearch from "../components/StockSearch";
import EvaluationResult from "../components/EvaluationResult";
import { Loader2, AlertCircle } from "lucide-react";

export default function IPOEvaluationPage() {
  const { ipoResult, setIpoResult, showNotification } = useStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(
    async (stockCode: string) => {
      setLoading(true);
      setError(null);
      setIpoResult(null);
      try {
        const result = await evaluateIPO(stockCode);
        setIpoResult(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "评估失败，请检查股票代码或后端服务";
        setError(msg);
        showNotification("error", msg);
      } finally {
        setLoading(false);
      }
    },
    [setIpoResult, showNotification]
  );

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
          <span className="text-xl">📈</span>
        </div>
        <div>
          <h1 className="text-2xl font-bold">新股价值评估</h1>
          <p className="text-text-muted text-sm">IPO/次新股基本面+技术面综合分析</p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <StockSearch onSearch={handleSearch} loading={loading} />
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center gap-3 py-12 text-slate-500">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <p className="text-sm">正在从 AkShare 获取数据并评估...</p>
          <p className="text-xs text-slate-400">获取K线、财务数据后调用AI分析</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-red-700 font-medium">评估失败</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Result */}
      {!loading && ipoResult && (
        <EvaluationResult result={ipoResult} />
      )}

      {/* Empty State */}
      {!loading && !ipoResult && !error && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-slate-500 font-medium">输入股票代码开始评估</p>
          <p className="text-xs text-slate-400 mt-2">
            支持沪深A股、科创板、创业板等新股及次新股评估
          </p>
        </div>
      )}
    </div>
  );
}
