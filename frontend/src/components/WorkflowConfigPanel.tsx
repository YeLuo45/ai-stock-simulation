/**
 * WorkflowConfigPanel - Settings Panel for Phase Workflow Configuration
 * Allows editing of Scan/Analyze/Debate/Execute parameters
 */
import { useState } from 'react';
import { useWorkflowStore, getPhaseName } from '../services/workflow/WorkflowStore';
import type { PhaseConfig } from '../services/workflow/types';
import { DEFAULT_PHASE_CONFIG } from '../services/workflow/types';

interface WorkflowConfigImportExportProps {
  onImport: (config: PhaseConfig) => void;
}

function WorkflowConfigImportExport({ onImport }: WorkflowConfigImportExportProps) {
  const [importText, setImportText] = useState('');
  const [showImport, setShowImport] = useState(false);

  const handleExport = () => {
    const { config } = useWorkflowStore.getState();
    const jsonStr = JSON.stringify(config, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-config-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const config = JSON.parse(importText) as PhaseConfig;
      // Basic validation
      if (!config.scan || !config.analyze || !config.debate || !config.execute) {
        alert('配置格式错误：缺少必要字段');
        return;
      }
      onImport(config);
      setShowImport(false);
      setImportText('');
      alert('导入成功！');
    } catch {
      alert('JSON 格式错误');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={handleExport}
          className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white rounded text-sm font-medium"
        >
          导出配置
        </button>
        <button
          onClick={() => setShowImport(!showImport)}
          className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm font-medium"
        >
          导入配置
        </button>
      </div>

      {showImport && (
        <div className="border rounded p-3 bg-gray-50">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="粘贴 JSON 配置..."
            className="w-full h-24 p-2 text-xs border rounded mb-2 font-mono"
          />
          <button
            onClick={handleImport}
            className="w-full py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            确认导入
          </button>
        </div>
      )}
    </div>
  );
}

export default function WorkflowConfigPanel() {
  const { config, setConfig, updateConfig, resetConfig } = useWorkflowStore();
  const [activeSection, setActiveSection] = useState<'scan' | 'analyze' | 'debate' | 'execute'>('scan');

  const sections = [
    { key: 'scan', label: '市场扫描', icon: '🔍' },
    { key: 'analyze', label: '多因子分析', icon: '📊' },
    { key: 'debate', label: '辩论决策', icon: '💬' },
    { key: 'execute', label: '执行下单', icon: '📈' },
  ] as const;

  const handleImport = (newConfig: PhaseConfig) => {
    setConfig(newConfig);
  };

  return (
    <div className="space-y-4">
      {/* Import/Export */}
      <WorkflowConfigImportExport onImport={handleImport} />

      {/* Section Tabs */}
      <div className="flex border-b">
        {sections.map((section) => (
          <button
            key={section.key}
            onClick={() => setActiveSection(section.key)}
            className={`flex-1 py-2 text-sm font-medium flex items-center justify-center gap-1 ${
              activeSection === section.key
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span>{section.icon}</span>
            <span>{section.label}</span>
          </button>
        ))}
      </div>

      {/* Scan Config */}
      {activeSection === 'scan' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium text-gray-800">市场扫描配置</h4>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.scan.enabled}
              onChange={(e) => updateConfig({ scan: { enabled: e.target.checked } })}
              className="w-4 h-4"
            />
            <span>启用扫描阶段</span>
          </label>

          <div>
            <label className="block text-sm text-gray-600 mb-1">数据源</label>
            <select
              value={config.scan.dataSource}
              onChange={(e) => updateConfig({ scan: { dataSource: e.target.value as any } })}
              className="w-full p-2 border rounded"
            >
              <option value="mock">模拟数据</option>
              <option value="tushare">Tushare</option>
              <option value="akshare">AKShare</option>
              <option value="eastmoney">东方财富</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.scan.filters.excludeSt}
                onChange={(e) => updateConfig({ 
                  scan: { filters: { ...config.scan.filters, excludeSt: e.target.checked } }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">排除 ST</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.scan.filters.excludeSuspended}
                onChange={(e) => updateConfig({ 
                  scan: { filters: { ...config.scan.filters, excludeSuspended: e.target.checked } }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">排除停牌</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.scan.filters.excludeDelisted}
                onChange={(e) => updateConfig({ 
                  scan: { filters: { ...config.scan.filters, excludeDelisted: e.target.checked } }
                })}
                className="w-4 h-4"
              />
              <span className="text-sm">排除退市</span>
            </label>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">最低候选数量</label>
            <input
              type="number"
              value={config.scan.minCandidates}
              onChange={(e) => updateConfig({ scan: { minCandidates: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
              min="1"
            />
            <p className="text-xs text-gray-400 mt-1">达不到此数量则终止流程</p>
          </div>
        </div>
      )}

      {/* Analyze Config */}
      {activeSection === 'analyze' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium text-gray-800">多因子分析配置</h4>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.analyze.enabled}
              onChange={(e) => updateConfig({ analyze: { enabled: e.target.checked } })}
              className="w-4 h-4"
            />
            <span>启用分析阶段</span>
          </label>

          <div>
            <label className="block text-sm text-gray-600 mb-1">取前 N 名</label>
            <input
              type="number"
              value={config.analyze.topN}
              onChange={(e) => updateConfig({ analyze: { topN: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">因子（逗号分隔）</label>
            <input
              type="text"
              value={config.analyze.factors.join(', ')}
              onChange={(e) => updateConfig({ 
                analyze: { factors: e.target.value.split(',').map(f => f.trim()) } 
              })}
              className="w-full p-2 border rounded"
              placeholder="pe, roe, volume, change"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">IC 阈值</label>
            <input
              type="number"
              step="0.01"
              value={config.analyze.icThreshold}
              onChange={(e) => updateConfig({ analyze: { icThreshold: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
            />
            <p className="text-xs text-gray-400 mt-1">低于此值的股票被过滤</p>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">最低评分</label>
            <input
              type="number"
              step="0.1"
              value={config.analyze.minScore || 0}
              onChange={(e) => updateConfig({ analyze: { minScore: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
            />
          </div>
        </div>
      )}

      {/* Debate Config */}
      {activeSection === 'debate' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium text-gray-800">辩论决策配置</h4>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.debate.enabled}
              onChange={(e) => updateConfig({ debate: { enabled: e.target.checked } })}
              className="w-4 h-4"
            />
            <span>启用辩论阶段</span>
          </label>

          <div>
            <label className="block text-sm text-gray-600 mb-1">置信度阈值</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={config.debate.confidenceThreshold}
              onChange={(e) => updateConfig({ debate: { confidenceThreshold: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
            />
            <p className="text-xs text-gray-400 mt-1">低于此值的股票跳过</p>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">辩论轮数</label>
            <input
              type="number"
              value={config.debate.maxRounds}
              onChange={(e) => updateConfig({ debate: { maxRounds: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
              min="1"
            />
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.debate.humanConfirm}
              onChange={(e) => updateConfig({ debate: { humanConfirm: e.target.checked } })}
              className="w-4 h-4"
            />
            <span>需要人工确认后执行</span>
          </label>
        </div>
      )}

      {/* Execute Config */}
      {activeSection === 'execute' && (
        <div className="space-y-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium text-gray-800">执行下单配置</h4>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={config.execute.dryRun}
              onChange={(e) => updateConfig({ execute: { dryRun: e.target.checked } })}
              className="w-4 h-4"
            />
            <span>模拟运行（不真实下单）</span>
          </label>

          <div>
            <label className="block text-sm text-gray-600 mb-1">最大持仓数</label>
            <input
              type="number"
              value={config.execute.maxPositions}
              onChange={(e) => updateConfig({ execute: { maxPositions: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">单笔仓位比例 (%)</label>
            <input
              type="number"
              value={config.execute.positionSizePct}
              onChange={(e) => updateConfig({ execute: { positionSizePct: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
              min="1"
              max="100"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">订单超时时间（秒）</label>
            <input
              type="number"
              value={config.execute.orderTimeoutSec}
              onChange={(e) => updateConfig({ execute: { orderTimeoutSec: Number(e.target.value) } })}
              className="w-full p-2 border rounded"
              min="5"
            />
          </div>
        </div>
      )}

      {/* Reset */}
      <div className="flex gap-2">
        <button
          onClick={resetConfig}
          className="flex-1 py-2 border border-gray-300 rounded text-sm text-gray-600 hover:bg-gray-50"
        >
          恢复默认
        </button>
      </div>
    </div>
  );
}