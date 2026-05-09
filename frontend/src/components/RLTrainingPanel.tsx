/**
 * RL Training Panel Component
 * Provides UI for configuring and running RL training (Q-Learning & REINFORCE)
 */

import { useState, useRef, useCallback } from 'react';
import { useStore } from '../store';
import { trainRL, generateStrategyCode } from '../services/rlEngine';
import type { RLConfig, RLAlgorithm, RLStateSpace, RLRewardFunction, RLTrainingResult } from '../types';
import { Play, Pause, RotateCcw, Download, Brain, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const ALL_STATE_SPACE: RLStateSpace[] = ['MA5', 'MA10', 'MA20', 'RSI', 'MACD', 'KDJ', 'BOLL', 'Volume'];
const STATE_SPACE_LABELS: Record<RLStateSpace, string> = {
  MA5: 'MA5',
  MA10: 'MA10',
  MA20: 'MA20',
  RSI: 'RSI',
  MACD: 'MACD',
  KDJ: 'KDJ',
  BOLL: 'Bollinger',
  Volume: '成交量比',
};

const REWARD_OPTIONS: { value: RLRewardFunction; label: string }[] = [
  { value: 'total_return', label: '累计收益率' },
  { value: 'sharpe_ratio', label: '夏普比率' },
  { value: 'calmar_ratio', label: '卡玛比率' },
  { value: 'max_drawdown_penalty', label: '收益 − 2×回撤' },
];

const ALGORITHM_OPTIONS: { value: RLAlgorithm; label: string }[] = [
  { value: 'q-learning', label: 'Q-Learning' },
  { value: 'policy-gradient', label: 'Policy Gradient (REINFORCE)' },
];

const DEFAULT_CONFIG: RLConfig = {
  algorithm: 'q-learning',
  stateSpace: ['MA5', 'RSI', 'MACD'],
  rewardFunction: 'total_return',
  episodes: 500,
  learningRate: 0.01,
  epsilon: 0.1,
  gamma: 0.95,
};

export default function RLTrainingPanel() {
  const { selectedSymbol, setSelectedSymbol, trainingHistory, addTrainingResult, clearTrainingHistory, setTrainingProgress, resetRLState, qTable, setQTable } = useStore();

  const [symbol, setSymbol] = useState(selectedSymbol);
  const [config, setConfig] = useState<RLConfig>(DEFAULT_CONFIG);
  const [strategyCode, setStrategyCode] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const stopRef = useRef(false);

  // Build chart data
  const chartData = trainingHistory.map(r => ({
    episode: r.episode,
    reward: r.reward,
    equity: r.equity,
    sharpe: r.sharpe,
    drawdown: r.maxDrawdown,
  }));

  // Moving average of reward (window=10)
  const maReward = chartData.map((_d, idx) => {
    const start = Math.max(0, idx - 9);
    const windowData = chartData.slice(start, idx + 1);
    const avg = windowData.reduce((s, d2) => s + d2.reward, 0) / windowData.length;
    return avg;
  });

  const chartDataWithMA = chartData.map((d, _i) => ({
    ...d,
    maReward,
  }));

  const toggleStateSpace = (s: RLStateSpace) => {
    setConfig(prev => ({
      ...prev,
      stateSpace: prev.stateSpace.includes(s)
        ? prev.stateSpace.filter(x => x !== s)
        : [...prev.stateSpace, s],
    }));
  };

  const handleStart = useCallback(async () => {
    if (config.stateSpace.length === 0) {
      alert('请至少选择一个状态空间指标');
      return;
    }
    setIsRunning(true);
    setIsPaused(false);
    stopRef.current = false;
    clearTrainingHistory();
    setStrategyCode('');

    setTrainingProgress({ isRunning: true, isPaused: false });

    try {
      const result = await trainRL(symbol, '1d', config, {
        onEpisodeComplete: (episode, epResult) => {
          if (stopRef.current) return;
          setCurrentEpisode(episode);
          const trainingResult: RLTrainingResult = {
            episode,
            reward: epResult.totalReward,
            equity: epResult.finalEquity,
            sharpe: epResult.sharpe,
            maxDrawdown: epResult.maxDrawdown,
          };
          addTrainingResult(trainingResult);
        },
        onProgress: (progress) => {
          if (stopRef.current) return;
          setTrainingProgress(progress);
        },
        shouldStop: () => stopRef.current,
      });

      setQTable(result.qTable);
      const code = generateStrategyCode(config.algorithm, result.qTable, result.policyWeights, config.stateSpace);
      setStrategyCode(code);
    } catch (e) {
      console.error('Training error:', e);
    } finally {
      setIsRunning(false);
      setTrainingProgress({ isRunning: false, isPaused: false });
    }
  }, [symbol, config, clearTrainingHistory, addTrainingResult, setTrainingProgress, setQTable]);

  const handlePause = () => {
    stopRef.current = true;
    setIsPaused(true);
    setIsRunning(false);
    setTrainingProgress({ isRunning: false, isPaused: true });
  };

  const handleReset = () => {
    stopRef.current = true;
    setTimeout(() => {
      stopRef.current = false;
    }, 100);
    setIsRunning(false);
    setIsPaused(false);
    setCurrentEpisode(0);
    clearTrainingHistory();
    setStrategyCode('');
    setTrainingProgress({ isRunning: false, isPaused: false, currentEpisode: 0 });
    resetRLState();
  };

  const progressPct = config.episodes > 0 ? (currentEpisode / config.episodes) * 100 : 0;

  // Last result summary
  const lastResult = trainingHistory[trainingHistory.length - 1];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent-secondary/20 flex items-center justify-center">
          <Brain size={22} className="text-accent-secondary" />
        </div>
        <div>
          <h2 className="text-xl font-bold">RL 训练</h2>
          <p className="text-text-muted text-sm">强化学习自动训练交易策略</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Configuration */}
        <div className="lg:col-span-1 space-y-6">
          {/* Symbol Input */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-4 space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Activity size={14} className="text-accent-primary" />
              训练标的
            </h3>
            <input
              type="text"
              value={symbol}
              onChange={e => { setSymbol(e.target.value); setSelectedSymbol(e.target.value); }}
              placeholder="例如：AAPL, 600519.SS"
              className="w-full bg-bg-tertiary border border-border-color rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent-primary/50"
            />
          </div>

          {/* Algorithm Selection */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-4 space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Brain size={14} className="text-accent-secondary" />
              算法选择
            </h3>
            <div className="flex gap-2">
              {ALGORITHM_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setConfig(prev => ({ ...prev, algorithm: opt.value }))}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    config.algorithm === opt.value
                      ? 'bg-accent-primary text-bg-primary'
                      : 'bg-bg-tertiary text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* State Space */}
            <div>
              <div className="text-xs text-text-muted mb-2">状态空间（勾选指标）</div>
              <div className="flex flex-wrap gap-2">
                {ALL_STATE_SPACE.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleStateSpace(s)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      config.stateSpace.includes(s)
                        ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                        : 'bg-bg-tertiary text-text-muted border border-border-color hover:text-text-secondary'
                    }`}
                  >
                    {STATE_SPACE_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Reward Function */}
            <div>
              <div className="text-xs text-text-muted mb-2">奖励函数</div>
              <div className="grid grid-cols-2 gap-2">
                {REWARD_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setConfig(prev => ({ ...prev, rewardFunction: opt.value }))}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      config.rewardFunction === opt.value
                        ? 'bg-accent-success/20 text-accent-success border border-accent-success/40'
                        : 'bg-bg-tertiary text-text-muted border border-border-color hover:text-text-secondary'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Training Parameters */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-4 space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <TrendingUp size={14} className="text-accent-primary" />
              训练参数
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted flex justify-between">
                  <span>Episodes</span>
                  <span className="font-mono text-text-secondary">{config.episodes}</span>
                </label>
                <input
                  type="range"
                  min={100}
                  max={2000}
                  step={100}
                  value={config.episodes}
                  onChange={e => setConfig(prev => ({ ...prev, episodes: Number(e.target.value) }))}
                  className="w-full accent-accent-primary"
                />
              </div>
              <div>
                <label className="text-xs text-text-muted flex justify-between">
                  <span>Learning Rate</span>
                  <span className="font-mono text-text-secondary">{config.learningRate.toFixed(3)}</span>
                </label>
                <input
                  type="range"
                  min={0.001}
                  max={0.5}
                  step={0.001}
                  value={config.learningRate}
                  onChange={e => setConfig(prev => ({ ...prev, learningRate: Number(e.target.value) }))}
                  className="w-full accent-accent-primary"
                />
              </div>
              {config.algorithm === 'q-learning' && (
                <div>
                  <label className="text-xs text-text-muted flex justify-between">
                    <span>Epsilon</span>
                    <span className="font-mono text-text-secondary">{config.epsilon.toFixed(2)}</span>
                  </label>
                  <input
                    type="range"
                    min={0.01}
                    max={1.0}
                    step={0.01}
                    value={config.epsilon}
                    onChange={e => setConfig(prev => ({ ...prev, epsilon: Number(e.target.value) }))}
                    className="w-full accent-accent-primary"
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-text-muted flex justify-between">
                  <span>Gamma (折扣因子)</span>
                  <span className="font-mono text-text-secondary">{config.gamma.toFixed(2)}</span>
                </label>
                <input
                  type="range"
                  min={0.8}
                  max={0.99}
                  step={0.01}
                  value={config.gamma}
                  onChange={e => setConfig(prev => ({ ...prev, gamma: Number(e.target.value) }))}
                  className="w-full accent-accent-primary"
                />
              </div>
            </div>
          </div>

          {/* Control Buttons */}
          <div className="flex gap-3">
            {!isRunning ? (
              <button
                onClick={handleStart}
                className="flex-1 px-4 py-3 bg-accent-success text-white font-medium rounded-lg hover:bg-accent-success/90 transition-colors flex items-center justify-center gap-2"
              >
                <Play size={16} />
                {isPaused ? '继续训练' : '开始训练'}
              </button>
            ) : (
              <button
                onClick={handlePause}
                className="flex-1 px-4 py-3 bg-accent-warning text-white font-medium rounded-lg hover:bg-accent-warning/90 transition-colors flex items-center justify-center gap-2"
              >
                <Pause size={16} />
                暂停
              </button>
            )}
            <button
              onClick={handleReset}
              className="px-4 py-3 bg-bg-tertiary text-text-secondary font-medium rounded-lg hover:bg-border-color transition-colors flex items-center gap-2 border border-border-color"
            >
              <RotateCcw size={16} />
              重置
            </button>
          </div>

          {/* Progress Bar */}
          {isRunning && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Episode {currentEpisode} / {config.episodes}</span>
                <span>{progressPct.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-bg-tertiary rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-accent-primary rounded-full transition-all duration-300"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Last Result Summary */}
          {lastResult && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-4 space-y-2">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <DollarSign size={14} className="text-accent-success" />
                最新结果
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-bg-tertiary rounded-lg p-2 text-center">
                  <div className="text-text-muted">Episode</div>
                  <div className="font-mono font-semibold text-accent-primary">{lastResult.episode}</div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-2 text-center">
                  <div className="text-text-muted">Reward</div>
                  <div className="font-mono font-semibold text-accent-success">{lastResult.reward.toFixed(2)}</div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-2 text-center">
                  <div className="text-text-muted">资金</div>
                  <div className="font-mono font-semibold">${lastResult.equity.toFixed(0)}</div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-2 text-center">
                  <div className="text-text-muted">夏普</div>
                  <div className="font-mono font-semibold text-accent-secondary">{lastResult.sharpe.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Visualization */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reward Chart */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <TrendingUp size={14} className="text-accent-primary" />
              Reward 曲线
            </h3>
            {chartDataWithMA.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartDataWithMA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="episode" stroke="#888" fontSize={10} />
                  <YAxis stroke="#888" fontSize={10} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: 12 }}
                    labelStyle={{ color: '#888' }}
                  />
                  <Legend fontSize={12} />
                  <Line type="monotone" dataKey="reward" stroke="#4ade80" dot={false} name="Reward" />
                  <Line type="monotone" dataKey="maReward" stroke="#f59e0b" dot={false} name="MA(10)" strokeDasharray="5 5" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-text-muted text-sm">
                训练开始后将显示Reward曲线
              </div>
            )}
          </div>

          {/* Equity Chart */}
          <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
            <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
              <DollarSign size={14} className="text-accent-success" />
              资金曲线
            </h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="episode" stroke="#888" fontSize={10} />
                  <YAxis stroke="#888" fontSize={10} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: '8px', fontSize: 12 }}
                    labelStyle={{ color: '#888' }}
                  />
                  <Legend fontSize={12} />
                  <Line type="monotone" dataKey="equity" stroke="#22d3ee" dot={false} name="资金 ($)" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-text-muted text-sm">
                训练开始后将显示资金曲线
              </div>
            )}
          </div>

          {/* Strategy Code Export */}
          {strategyCode && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Download size={14} className="text-accent-primary" />
                  生成的策略代码
                </h3>
                <button
                  onClick={() => navigator.clipboard.writeText(strategyCode)}
                  className="px-3 py-1 bg-bg-tertiary text-text-secondary text-xs rounded-lg hover:text-text-primary transition-colors border border-border-color"
                >
                  复制
                </button>
              </div>
              <pre className="bg-bg-tertiary rounded-lg p-4 text-xs font-mono text-text-secondary overflow-x-auto whitespace-pre-wrap">
                {strategyCode}
              </pre>
            </div>
          )}

          {/* Q-Table Preview */}
          {qTable && Object.keys(qTable).length > 0 && (
            <div className="bg-bg-secondary rounded-xl border border-border-color p-4 space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Brain size={14} className="text-accent-secondary" />
                Q-Table 预览（已保存 {Object.keys(qTable).length} 个状态）
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {Object.entries(qTable).slice(0, 10).map(([state, qValues]) => (
                  <div key={state} className="flex items-center gap-2 text-xs font-mono bg-bg-tertiary rounded px-2 py-1">
                    <span className="text-text-muted flex-shrink-0">{state.substring(0, 30)}...</span>
                    <span className="text-accent-success">HOLD:{qValues[0]?.toFixed(1)}</span>
                    <span className="text-accent-primary">BUY:{qValues[1]?.toFixed(1)}</span>
                    <span className="text-accent-danger">SELL:{qValues[2]?.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
