/**
 * DataSourceSelector - 多行情数据源管理组件
 * 支持启用/禁用东方财富、同花顺、聚宽
 */
import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle, Database } from "lucide-react";
import { getDataSources, updateDataSource } from "../services/api";
import type { DataSourceItem } from "../types";
import clsx from "clsx";

const SOURCE_META: Record<string, { label: string; desc: string; color: string }> = {
  east_money: {
    label: "东方财富",
    desc: "覆盖全面，更新速度快",
    color: "from-blue-500 to-blue-700",
  },
  tonghuashun: {
    label: "同花顺",
    desc: "技术指标丰富，用户众多",
    color: "from-green-500 to-green-700",
  },
  joinquant: {
    label: "聚宽",
    desc: "量化数据权威，质量较高",
    color: "from-purple-500 to-purple-700",
  },
};

export default function DataSourceSelector() {
  const [sources, setSources] = useState<DataSourceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    setLoading(true);
    try {
      const data = await getDataSources();
      setSources(data.sources);
    } catch (e) {
      console.error("Failed to load data sources:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (sourceId: string, currentEnabled: boolean) => {
    setToggling(sourceId);
    try {
      await updateDataSource(sourceId, !currentEnabled);
      setSources((prev) =>
        prev.map((s) =>
          s.id === sourceId ? { ...s, enabled: !currentEnabled } : s
        )
      );
    } catch (e) {
      console.error("Failed to toggle data source:", e);
    } finally {
      setToggling(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <RefreshCw size={20} className="animate-spin mr-2" />
        加载数据源...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h4 className="font-semibold text-slate-800 flex items-center gap-2">
            <Database size={16} className="text-green-500" />
            行情数据源
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            启用多个数据源可提高数据获取稳定性（自动降级）
          </p>
        </div>
        <button
          onClick={loadSources}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-400 hover:text-slate-600 transition-colors"
          title="刷新"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="space-y-2">
        {sources.map((source) => {
          const meta = SOURCE_META[source.id] || { label: source.name, desc: "", color: "from-gray-400 to-gray-600" };
          const isToggling = toggling === source.id;

          return (
            <div
              key={source.id}
              className={clsx(
                "flex items-center gap-3 p-4 rounded-xl border transition-all",
                source.enabled
                  ? "bg-white border-gray-200 shadow-sm"
                  : "bg-gray-50 border-gray-100 opacity-60"
              )}
            >
              {/* Icon */}
              <div className={clsx("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold flex-shrink-0", meta.color)}>
                {source.name.charAt(0)}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{meta.label}</span>
                  {source.enabled ? (
                    <span className="text-xs flex items-center gap-0.5 text-green-600">
                      <CheckCircle size={10} /> 运行中
                    </span>
                  ) : (
                    <span className="text-xs flex items-center gap-0.5 text-gray-400">
                      <XCircle size={10} /> 已禁用
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
              </div>

              {/* Toggle */}
              <button
                onClick={() => handleToggle(source.id, source.enabled)}
                disabled={isToggling}
                className={clsx(
                  "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                  source.enabled ? "bg-blue-500" : "bg-gray-300"
                )}
              >
                <span
                  className={clsx(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    source.enabled ? "translate-x-6" : "translate-x-1"
                  )}
                />
                {isToggling && (
                  <RefreshCw size={12} className="absolute inset-0 m-auto animate-spin text-white" />
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
        <p className="text-xs text-amber-700">
          💡 数据源按优先级顺序自动降级。当高优先级数据源不可用时，系统自动切换到下一个可用数据源。
        </p>
      </div>
    </div>
  );
}
