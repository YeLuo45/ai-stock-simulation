/**
 * AgentMemoryPanel - UI component for viewing agent decision memories
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  queryMemory,
  getMemoryStats,
  type AgentMemory,
} from '../agents/AgentMemory';

const AgentMemoryPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [memories, setMemories] = useState<AgentMemory[]>([]);
  const [stats, setStats] = useState<{
    totalMemories: number;
    avgProfitBySelector: number;
    topSymbols: Array<{ symbol: string; count: number }>;
    recentTrend: 'improving' | 'declining' | 'stable';
  } | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const loadData = useCallback(() => {
    const allMemories = queryMemory({
      symbols: searchSymbol ? [searchSymbol.toUpperCase()] : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
      limit: 50,
    });
    setMemories(allMemories);

    const allStats = getMemoryStats();
    setStats(allStats);
  }, [searchSymbol, selectedTags]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const formatTime = (timestamp: number) => {
    const d = new Date(timestamp);
    return d.toLocaleString();
  };

  const renderAgentSummary = (memory: AgentMemory) => {
    return (
      <div className="space-y-2 text-sm">
        {/* Selector */}
        {memory.agents.selector && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700 dark:text-blue-300">
                📊 Selector
              </span>
              <span className="text-xs text-gray-500">
                {memory.agents.selector.symbol}
              </span>
            </div>
            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
              Score: {memory.agents.selector.score.toFixed(3)}
            </div>
            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400 line-clamp-2">
              {memory.agents.selector.reason}
            </div>
            {memory.agents.selector.tokens && (
              <div className="text-xs text-gray-400 mt-1">
                Tokens: {memory.agents.selector.tokens.input}/{memory.agents.selector.tokens.output}
              </div>
            )}
          </div>
        )}

        {/* Backtester */}
        {memory.agents.backtester && (
          <div className={`p-2 rounded ${memory.agents.backtester.passed ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center gap-2">
              <span className={`font-medium ${memory.agents.backtester.passed ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                {memory.agents.backtester.passed ? '✅ Backtester PASSED' : '❌ Backtester FAILED'}
              </span>
            </div>
            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400 line-clamp-1">
              {memory.agents.backtester.reason}
            </div>
            {memory.agents.backtester.metrics && (
              <div className="flex gap-3 mt-1 text-xs text-gray-500">
                <span>Return: {memory.agents.backtester.metrics.totalReturn.toFixed(2)}%</span>
                <span>Sharpe: {memory.agents.backtester.metrics.sharpeRatio.toFixed(2)}</span>
                <span>Win: {memory.agents.backtester.metrics.winRate.toFixed(2)}%</span>
              </div>
            )}
          </div>
        )}

        {/* Risk */}
        {memory.agents.risk && (
          <div className={`p-2 rounded ${memory.agents.risk.approved ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
            <span className={`font-medium ${memory.agents.risk.approved ? 'text-green-700 dark:text-green-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
              {memory.agents.risk.approved ? '🛡️ Risk APPROVED' : '🛡️ Risk REJECTED'}
            </span>
            <div className="text-xs mt-1 text-gray-600 dark:text-gray-400 line-clamp-1">
              {memory.agents.risk.reason}
            </div>
          </div>
        )}

        {/* Executor */}
        {memory.agents.executor && (
          <div className={`p-2 rounded ${memory.agents.executor.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <span className={`font-medium ${memory.agents.executor.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
              {memory.agents.executor.success ? '🚀 Executor SUCCESS' : '🚀 Executor FAILED'}
            </span>
            {memory.agents.executor.success && (
              <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
                Qty: {memory.agents.executor.executedQuantity} @ ¥{memory.agents.executor.executedPrice.toFixed(2)}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const allTags = ['executed', 'risk-rejected', 'full-pipeline', 'backtest-passed', 'backtest-failed'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-100 dark:bg-gray-700 cursor-pointer"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🧠</span>
          <h3 className="font-semibold text-gray-800 dark:text-gray-200">
            Agent Memory
          </h3>
          {stats && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              ({stats.totalMemories} memories)
            </span>
          )}
        </div>
        <button
          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div className="p-4 space-y-4">
          {/* Stats Summary */}
          {stats && stats.totalMemories > 0 && (
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                <div className="text-lg font-semibold text-blue-600 dark:text-blue-400">
                  {stats.totalMemories}
                </div>
                <div className="text-xs text-gray-500">Total</div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                <div className="text-lg font-semibold text-purple-600 dark:text-purple-400">
                  {stats.avgProfitBySelector.toFixed(3)}
                </div>
                <div className="text-xs text-gray-500">Avg Score</div>
              </div>
              <div className={`p-2 rounded ${stats.recentTrend === 'improving' ? 'bg-green-50 dark:bg-green-900/20' : stats.recentTrend === 'declining' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-gray-50 dark:bg-gray-700'}`}>
                <div className={`text-lg font-semibold ${stats.recentTrend === 'improving' ? 'text-green-600 dark:text-green-400' : stats.recentTrend === 'declining' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {stats.recentTrend === 'improving' ? '📈' : stats.recentTrend === 'declining' ? '📉' : '➡️'}
                </div>
                <div className="text-xs text-gray-500">{stats.recentTrend}</div>
              </div>
            </div>
          )}

          {/* Top Symbols */}
          {stats && stats.topSymbols.length > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1">Top Symbols:</div>
              <div className="flex flex-wrap gap-1">
                {stats.topSymbols.slice(0, 5).map(({ symbol, count }) => (
                  <span
                    key={symbol}
                    className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-xs rounded-full"
                  >
                    {symbol} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Search by symbol..."
              value={searchSymbol}
              onChange={e => setSearchSymbol(e.target.value)}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 placeholder-gray-400"
            />
            <button
              onClick={loadData}
              className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded"
            >
              Search
            </button>
          </div>

          {/* Tag Filters */}
          <div className="flex flex-wrap gap-1">
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                }`}
              >
                {tag}
              </button>
            ))}
            {selectedTags.length > 0 && (
              <button
                onClick={() => setSelectedTags([])}
                className="px-2 py-0.5 text-xs text-red-500 hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          {/* Memory List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {memories.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No memories yet. Run some pipelines to build your memory.
              </div>
            ) : (
              memories.map(memory => (
                <div
                  key={memory.id}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      {formatTime(memory.timestamp)}
                    </span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {memory.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                  {renderAgentSummary(memory)}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentMemoryPanel;
