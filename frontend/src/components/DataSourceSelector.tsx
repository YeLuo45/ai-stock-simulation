/**
 * DataSourceSelector - Multi data source management with Tushare config
 */
import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle, XCircle, Database, Key, TestTube } from "lucide-react";
import { getAllProviderStatus, setProviderEnabled, setProviderOrder } from "../services/dataSource/DataSourceRegistry";
import { testTushareConnection, TushareProvider } from "../services/dataSource/TushareProvider";
import type { DataSourceStatus } from "../services/dataSource/types";
import clsx from "clsx";

const SOURCE_META: Record<string, { label: string; desc: string; color: string }> = {
  tushare: {
    label: "Tushare",
    desc: "专业A股数据，120积分权限",
    color: "from-orange-500 to-red-600",
  },
  akshare: {
    label: "AKShare",
    desc: "免费数据源，备用选择",
    color: "from-green-500 to-green-700",
  },
  yahoo: {
    label: "Yahoo Finance",
    desc: "美股/港股/加密货币",
    color: "from-purple-500 to-purple-700",
  },
  mock: {
    label: "模拟数据",
    desc: "仅用于测试/演示",
    color: "from-gray-400 to-gray-600",
  },
};

const TUSHARE_TOKEN_KEY = 'tushare_token';

export default function DataSourceSelector() {
  const [statuses, setStatuses] = useState<DataSourceStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);
  const [tushareToken, setTushareToken] = useState(() => localStorage.getItem(TUSHARE_TOKEN_KEY) || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const loadStatuses = () => {
    setLoading(true);
    try {
      const status = getAllProviderStatus();
      setStatuses(status);
    } catch (e) {
      console.error("Failed to load provider status:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatuses();
  }, []);

  const handleToggle = (sourceId: string, currentEnabled: boolean) => {
    setToggling(sourceId);
    try {
      setProviderEnabled(sourceId, !currentEnabled);
      setStatuses(prev => prev.map(s => 
        s.source === sourceId ? { ...s, status: !currentEnabled ? 'connected' : 'disabled' } : s
      ));
    } catch (e) {
      console.error("Failed to toggle:", e);
    } finally {
      setToggling(null);
    }
  };

  const handleSaveToken = () => {
    localStorage.setItem(TUSHARE_TOKEN_KEY, tushareToken);
    setTestResult({ success: true, message: 'Token已保存' });
    loadStatuses();
  };

  const handleTestConnection = async () => {
    if (!tushareToken) {
      setTestResult({ success: false, message: '请输入Token' });
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testTushareConnection(tushareToken);
      setTestResult(result);
    } catch (e) {
      setTestResult({ success: false, message: String(e) });
    } finally {
      setTesting(false);
    }
  };

  // Get enabled state from status
  const getEnabled = (sourceId: string): boolean => {
    const status = statuses.find(s => s.source === sourceId);
    return status?.status !== 'disabled';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-slate-500">
        <RefreshCw size={20} className="animate-spin mr-2" />
        加载数据源...
      </div>
    );
  }

  const providerIds = ['tushare', 'akshare', 'yahoo', 'mock'];

  return (
    <div className="space-y-4">
      {/* Tushare Token Config */}
      <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-100 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Key size={16} className="text-orange-500" />
          <h4 className="font-semibold text-slate-800">Tushare Token</h4>
        </div>
        <p className="text-xs text-slate-500 mb-3">
          输入Tushare API Token以获取A股专业数据（需120积分权限）
        </p>
        <div className="flex gap-2">
          <input
            type="password"
            value={tushareToken}
            onChange={e => setTushareToken(e.target.value)}
            placeholder="输入Tushare Token"
            className="flex-1 px-3 py-2 border border-orange-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
          <button
            onClick={handleTestConnection}
            disabled={testing || !tushareToken}
            className="flex items-center gap-1 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 disabled:opacity-50"
          >
            <TestTube size={14} />
            {testing ? '测试中...' : '测试'}
          </button>
          <button
            onClick={handleSaveToken}
            disabled={!tushareToken}
            className="px-3 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 disabled:opacity-50"
          >
            保存
          </button>
        </div>
        {testResult && (
          <div className={clsx(
            "mt-2 text-xs p-2 rounded",
            testResult.success ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
          )}>
            {testResult.success ? '✓ ' : '✗ '}{testResult.message}
          </div>
        )}
      </div>

      {/* Provider List */}
      <div className="space-y-2">
        {providerIds.map(sourceId => {
          const meta = SOURCE_META[sourceId] || { label: sourceId, desc: "", color: "from-gray-400 to-gray-600" };
          const enabled = getEnabled(sourceId);
          const status = statuses.find(s => s.source === sourceId);
          const isToggling = toggling === sourceId;

          return (
            <div
              key={sourceId}
              className={clsx(
                "flex items-center gap-3 p-4 rounded-xl border transition-all",
                enabled ? "bg-white border-gray-200 shadow-sm" : "bg-gray-50 border-gray-100 opacity-60"
              )}
            >
              <div className={clsx("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-white text-sm font-bold flex-shrink-0", meta.color)}>
                {meta.label.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{meta.label}</span>
                  {enabled ? (
                    <span className="text-xs flex items-center gap-0.5 text-green-600">
                      <CheckCircle size={10} /> 运行中
                    </span>
                  ) : (
                    <span className="text-xs flex items-center gap-0.5 text-gray-400">
                      <XCircle size={10} /> 已禁用
                    </span>
                  )}
                  {status?.latency && enabled && (
                    <span className="text-xs text-gray-400">{status.latency}ms</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{meta.desc}</p>
              </div>
              <button
                onClick={() => handleToggle(sourceId, enabled)}
                disabled={isToggling}
                className={clsx(
                  "relative w-11 h-6 rounded-full transition-colors flex-shrink-0",
                  enabled ? "bg-blue-500" : "bg-gray-300"
                )}
              >
                <span
                  className={clsx(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform",
                    enabled ? "translate-x-6" : "translate-x-1"
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
          💡 数据源按优先级顺序自动降级。Tushare为主数据源，失败后自动切换到AKShare → Yahoo → Mock。
        </p>
      </div>
    </div>
  );
}