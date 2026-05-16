/**
 * AutoRunSettings - 无人值守配置组件
 * Settings for auto-run debate configuration
 */

import { useState, useEffect } from 'react';
import { useStore } from '../store';
import { getAutoRunConfig, saveAutoRunConfig, startAutoRunChecker, stopAutoRunChecker } from '../services/debate/AutoRunService';
import type { DebateConfig } from '../services/debate/types';
import { DEFAULT_DEBATE_CONFIG } from '../services/debate/types';
import { Clock, Play, Pause, CheckCircle2, AlertCircle } from 'lucide-react';

export function AutoRunSettings() {
  const { showNotification } = useStore();
  const [config, setConfig] = useState<DebateConfig>(DEFAULT_DEBATE_CONFIG);
  const [isActive, setIsActive] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  useEffect(() => {
    // Load saved config
    const saved = getAutoRunConfig();
    setConfig(saved);
    setIsActive(saved.enabled);
  }, []);

  const handleToggle = (enabled: boolean) => {
    const newConfig = { ...config, enabled };
    setConfig(newConfig);
    saveAutoRunConfig(newConfig);
    setIsActive(enabled);

    if (enabled) {
      startAutoRunChecker();
      showNotification('success', '无人值守模式已开启');
    } else {
      stopAutoRunChecker();
      showNotification('info', '无人值守模式已关闭');
    }
  };

  const handleSave = () => {
    saveAutoRunConfig(config);
    showNotification('success', '配置已保存');
  };

  const handleTestSchedule = () => {
    // Simple validation of cron expression
    const cronParts = config.schedule.split(' ');
    if (cronParts.length !== 5) {
      setTestResult('无效的cron表达式');
      return;
    }
    setTestResult('Cron表达式验证通过');
    setTimeout(() => setTestResult(''), 3000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock size={18} className="text-accent-primary" />
        <h3 className="font-semibold">无人值守模式</h3>
        {isActive && (
          <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
            <Play size={10} /> 运行中
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        开启后，系统将在工作日收盘后（默认15:00-16:00）自动执行辩论评估。
        在 dry-run 模式下只记录不执行交易。
      </p>

      {/* Enable Toggle */}
      <div className="flex items-center justify-between p-3 bg-bg-secondary rounded-lg border border-border-color">
        <div>
          <p className="text-sm font-medium">启用无人值守</p>
          <p className="text-xs text-gray-500">开启后将在指定时间自动运行辩论</p>
        </div>
        <button
          onClick={() => handleToggle(!isActive)}
          className={`w-12 h-6 rounded-full transition-colors relative ${
            isActive ? 'bg-green-500' : 'bg-gray-300'
          }`}
        >
          <div
            className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${
              isActive ? 'translate-x-6' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Configuration */}
      <div className="space-y-3 p-4 bg-bg-secondary rounded-lg border border-border-color">
        <h4 className="text-sm font-medium">调度配置</h4>

        {/* Schedule */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Cron表达式</label>
          <input
            type="text"
            value={config.schedule}
            onChange={(e) => setConfig({ ...config, schedule: e.target.value })}
            placeholder="0 15 * * 1-5"
            className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
          />
          <p className="text-xs text-gray-400 mt-1">默认: 0 15 * * 1-5 (工作日15:00)</p>
        </div>

        {/* Market Scan */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">扫描范围</label>
          <select
            value={config.marketScan}
            onChange={(e) => setConfig({ ...config, marketScan: e.target.value as 'all' | 'watchlist' })}
            className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
          >
            <option value="watchlist">自选股</option>
            <option value="all">全市场</option>
          </select>
        </div>

        {/* Dry Run */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm">Dry Run 模式</p>
            <p className="text-xs text-gray-500">开启后只记录不执行交易</p>
          </div>
          <button
            onClick={() => setConfig({ ...config, dryRun: !config.dryRun })}
            className={`w-10 h-5 rounded-full transition-colors relative ${
              config.dryRun ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <div
              className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-transform ${
                config.dryRun ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>

        {/* Confidence Threshold */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            信心分阈值: {config.confidenceThreshold.toFixed(2)}
          </label>
          <input
            type="range"
            min="0.3"
            max="0.9"
            step="0.05"
            value={config.confidenceThreshold}
            onChange={(e) => setConfig({ ...config, confidenceThreshold: parseFloat(e.target.value) })}
            className="w-full"
          />
          <p className="text-xs text-gray-400">低于此阈值的决策将被跳过</p>
        </div>

        {/* Max Positions */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            最大持仓数: {config.maxPositions}
          </label>
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={config.maxPositions}
            onChange={(e) => setConfig({ ...config, maxPositions: parseInt(e.target.value) })}
            className="w-full"
          />
        </div>
      </div>

      {/* Test Schedule */}
      {testResult && (
        <div className={`flex items-center gap-2 p-2 rounded-lg text-sm ${
          testResult.includes('通过') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {testResult.includes('通过') ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {testResult}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleTestSchedule}
          className="px-4 py-2 bg-bg-tertiary text-text-primary rounded-lg text-sm hover:bg-border-color transition-colors"
        >
          验证调度
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-accent-primary text-white rounded-lg text-sm hover:bg-accent-primary/90 transition-colors"
        >
          保存配置
        </button>
      </div>
    </div>
  );
}

export default AutoRunSettings;