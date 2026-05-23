/**
 * TradingPhasePanel - UI Component for Trading Phase Workflow Visualization
 * Displays current trading chain, phase progress, and regime-aware switching
 */
import { useState, useEffect, useCallback } from 'react';
import { messageBus, Channel } from '../services/messageBus';
import { createTradingPhaseEngine, type TradingPhaseEngine, type ChainConfig, type TradingResult, type PhaseResult } from '../services/workflow/TradingPhaseEngine';
import type { Regime } from '../services/regime/types';
import { Play, Pause, Square, RefreshCw, Zap, TrendingUp, TrendingDown, Minus, Activity, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface TradingPhasePanelProps {
  ticker?: string;
  initialRegime?: Regime;
}

interface PhaseStep {
  id: string;
  name: string;
  agent: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  duration?: number;
  icon: string;
}

export default function TradingPhasePanel({ ticker = 'AAPL', initialRegime = 'BULL' }: TradingPhasePanelProps) {
  const [engine, setEngine] = useState<TradingPhaseEngine | null>(null);
  const [currentChain, setCurrentChain] = useState<string>('standard');
  const [currentRegime, setCurrentRegime] = useState<Regime>(initialRegime);
  const [isRunning, setIsRunning] = useState(false);
  const [phases, setPhases] = useState<PhaseStep[]>([]);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(-1);
  const [results, setResults] = useState<TradingResult | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // Initialize engine
  useEffect(() => {
    const eng = createTradingPhaseEngine();
    setEngine(eng);

    // Subscribe to workflow events
    const unsubStart = messageBus.on(Channel.WORKFLOW_START, () => {
      setIsRunning(true);
      setElapsedTime(0);
      setPhaseStartTime(Date.now());
    });

    const unsubPhaseStart = messageBus.on(Channel.WORKFLOW_PHASE_START, ({ phaseId }: { phaseId: string }) => {
      setPhases(prev => prev.map((p, i) => 
        i === currentPhaseIndex + 1 ? { ...p, status: 'running' } : p
      ));
      setCurrentPhaseIndex(prev => prev + 1);
      setPhaseStartTime(Date.now());
    });

    const unsubPhaseComplete = messageBus.on(Channel.WORKFLOW_PHASE_COMPLETE, ({ result }: { result: PhaseResult }) => {
      setPhases(prev => prev.map((p, i) => 
        i === currentPhaseIndex ? { ...p, status: result.success ? 'completed' : 'failed', duration: result.duration } : p
      ));
    });

    const unsubComplete = messageBus.on(Channel.WORKFLOW_COMPLETE, ({ result }: { result: TradingResult }) => {
      setIsRunning(false);
      setResults(result);
      setPhases(prev => prev.map(p => p.status === 'running' ? { ...p, status: 'pending' } : p));
    });

    const unsubError = messageBus.on(Channel.WORKFLOW_ERROR, () => {
      setIsRunning(false);
      setPhases(prev => prev.map(p => p.status === 'running' ? { ...p, status: 'failed' } : p));
    });

    const unsubRegimeChange = messageBus.on(Channel.REGIME_CHANGED, ({ newRegime, chainId }: { newRegime: Regime; chainId: string }) => {
      setCurrentRegime(newRegime);
      setCurrentChain(chainId);
    });

    return () => {
      unsubStart();
      unsubPhaseStart();
      unsubPhaseComplete();
      unsubComplete();
      unsubError();
      unsubRegimeChange();
    };
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - (phaseStartTime || Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [isRunning, phaseStartTime]);

  // Build phase steps from current chain
  const buildPhaseSteps = useCallback((chainId: string): PhaseStep[] => {
    const chain = engine?.getChain(chainId);
    if (!chain) return [];

    return chain.phases.map(phase => ({
      id: phase.id,
      name: phase.name,
      agent: phase.agent,
      status: 'pending' as const,
      icon: getAgentIcon(phase.agent),
    }));
  }, [engine]);

  // Handle start trading
  const handleStart = async () => {
    if (!engine || !ticker) return;

    const chain = engine.getChain(currentChain);
    if (!chain) return;

    setPhases(buildPhaseSteps(currentChain));
    setCurrentPhaseIndex(-1);
    setResults(null);
    setElapsedTime(0);

    const marketContext = {
      ticker,
      regime: currentRegime,
      price: 150 + Math.random() * 50,
      volume: 1000000 + Math.random() * 5000000,
    };

    setIsRunning(true);
    const result = await engine.executeChain(currentChain, ticker, marketContext);
    setResults(result);
    setIsRunning(false);
  };

  // Handle stop
  const handleStop = () => {
    engine?.stop();
    setIsRunning(false);
  };

  // Handle regime change
  const handleRegimeChange = (regime: Regime) => {
    setCurrentRegime(regime);
    if (engine) {
      engine.onRegimeChange(regime);
    }
  };

  // Handle chain change
  const handleChainChange = (chainId: string) => {
    setCurrentChain(chainId);
    if (!isRunning) {
      setPhases(buildPhaseSteps(chainId));
    }
  };

  // Format time
  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`;
    }
    return `${seconds}s`;
  };

  // Get agent icon
  const getAgentIcon = (agent: string): string => {
    const icons: Record<string, string> = {
      NewsAnalyst: '📰',
      TechnicalAnalyst: '📊',
      StrategyPool: '🎯',
      TradingAgent: '⚖️',
      OrderExecutor: '📈',
      RiskAnalyst: '🛡️',
      RegimeDetector: '🔮',
    };
    return icons[agent] || '⚙️';
  };

  // Get status color
  const getStatusColor = (status: PhaseStep['status']) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      case 'running': return 'bg-blue-500 animate-pulse';
      case 'skipped': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };

  // Get regime icon and color
  const getRegimeDisplay = (regime: Regime) => {
    switch (regime) {
      case 'BULL':
        return { icon: <TrendingUp size={14} />, color: 'text-green-500', label: '多头' };
      case 'BEAR':
        return { icon: <TrendingDown size={14} />, color: 'text-red-500', label: '空头' };
      case 'RANGEBOUND':
        return { icon: <Minus size={14} />, color: 'text-yellow-500', label: '震荡' };
      default:
        return { icon: <Activity size={14} />, color: 'text-gray-500', label: '未知' };
    }
  };

  const regimeDisplay = getRegimeDisplay(currentRegime);
  const availableChains = engine?.getChains() || [];
  const totalDuration = results?.totalDuration || 0;

  return (
    <div className="bg-bg-secondary border border-border-color rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent-primary/20 flex items-center justify-center">
            <Zap size={16} className="text-accent-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">交易流程引擎</h3>
            <p className="text-xs text-text-muted">
              {ticker} · {engine?.getChain(currentChain)?.name || currentChain}
            </p>
          </div>
        </div>

        {/* Regime Badge */}
        <button
          onClick={() => {
            const regimes: Regime[] = ['BULL', 'BEAR', 'RANGEBOUND', 'UNKNOWN'];
            const nextRegime = regimes[(regimes.indexOf(currentRegime) + 1) % regimes.length];
            handleRegimeChange(nextRegime);
          }}
          className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
            regimeDisplay.color,
            'border-current/30 hover:bg-bg-tertiary transition-colors'
          )}
          title="点击切换市场状态"
        >
          {regimeDisplay.icon}
          <span>{regimeDisplay.label}</span>
        </button>
      </div>

      {/* Chain Selector */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {availableChains.map(chainId => (
          <button
            key={chainId}
            onClick={() => handleChainChange(chainId)}
            disabled={isRunning}
            className={clsx(
              'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all whitespace-nowrap',
              currentChain === chainId
                ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary'
                : 'bg-bg-tertiary border-border-color text-text-muted hover:text-text-secondary hover:border-accent-primary/30',
              isRunning && 'opacity-50 cursor-not-allowed'
            )}
          >
            {engine?.getChain(chainId)?.name || chainId}
          </button>
        ))}
      </div>

      {/* Phase Progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>流程进度</span>
          {isRunning && (
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatTime(elapsedTime)}
            </span>
          )}
        </div>

        {/* Phase Steps */}
        <div className="flex items-center gap-1">
          {phases.map((phase, idx) => (
            <div key={phase.id} className="flex-1 flex flex-col items-center">
              {/* Connector */}
              {idx > 0 && (
                <div
                  className={clsx(
                    'absolute h-0.5 w-full -ml-1',
                    phases[idx - 1].status === 'completed' ? 'bg-green-500' : 'bg-gray-300'
                  )}
                  style={{ width: 'calc(100% + 4px)' }}
                />
              )}

              {/* Step Circle */}
              <div
                className={clsx(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm relative z-10',
                  getStatusColor(phase.status),
                  phase.status === 'running' && 'animate-pulse'
                )}
              >
                {phase.status === 'completed' ? (
                  <CheckCircle size={14} className="text-white" />
                ) : phase.status === 'failed' ? (
                  <XCircle size={14} className="text-white" />
                ) : phase.status === 'skipped' ? (
                  <AlertTriangle size={14} className="text-white" />
                ) : (
                  <span>{phase.icon}</span>
                )}
              </div>

              {/* Label */}
              <div className="text-center mt-1">
                <div className={clsx(
                  'text-xs font-medium',
                  phase.status === 'running' ? 'text-blue-500' :
                  phase.status === 'completed' ? 'text-green-500' :
                  'text-text-muted'
                )}>
                  {phase.name}
                </div>
                {phase.duration && (
                  <div className="text-xs text-gray-400">
                    {formatTime(phase.duration)}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {phases.length === 0 && !isRunning && (
          <div className="text-center py-4 text-sm text-text-muted">
            点击开始运行交易流程
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex gap-2">
        {!isRunning ? (
          <button
            onClick={handleStart}
            disabled={!ticker}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent-primary hover:bg-accent-primary/90 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            开始交易
          </button>
        ) : (
          <>
            <button
              onClick={handleStop}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium transition-colors"
            >
              <Square size={14} />
              停止
            </button>
          </>
        )}

        <button
          onClick={() => setShowConfig(!showConfig)}
          className={clsx(
            'p-2 rounded-lg border transition-colors',
            showConfig
              ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary'
              : 'border-border-color text-text-muted hover:text-text-secondary hover:border-accent-primary/30'
          )}
          title="配置"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Results Summary */}
      {results && (
        <div className="border-t border-border-color pt-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-text-muted">执行结果</span>
            <span className={clsx(
              'text-xs px-2 py-0.5 rounded',
              results.status === 'completed' ? 'bg-green-100 text-green-700' :
              results.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            )}>
              {results.status === 'completed' ? '完成' : results.status === 'partial' ? '部分完成' : '已拒绝'}
            </span>
          </div>

          {/* Decision Card */}
          <div className="bg-bg-tertiary rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-text-muted">交易决策</span>
              <span className={clsx(
                'text-sm font-bold',
                results.decision.action === 'buy' ? 'text-green-500' :
                results.decision.action === 'sell' ? 'text-red-500' :
                'text-gray-500'
              )}>
                {results.decision.action === 'buy' ? '买入' :
                 results.decision.action === 'sell' ? '卖出' : '持仓'}
              </span>
            </div>

            {results.decision.action !== 'hold' && (
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-muted">数量:</span>
                  <span className="text-text-primary">{results.decision.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-muted">价格:</span>
                  <span className="text-text-primary">${results.decision.entryPrice.toFixed(2)}</span>
                </div>
                {results.decision.stopLoss && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">止损:</span>
                    <span className="text-accent-danger">${results.decision.stopLoss.toFixed(2)}</span>
                  </div>
                )}
                {results.decision.takeProfit && (
                  <div className="flex justify-between">
                    <span className="text-text-muted">止盈:</span>
                    <span className="text-accent-success">${results.decision.takeProfit.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between text-xs text-text-muted">
            <span>总耗时</span>
            <span>{formatTime(totalDuration)}</span>
          </div>

          {/* Phase Summary */}
          <div className="flex gap-1">
            {results.phases.map((phase, idx) => (
              <div
                key={idx}
                className={clsx(
                  'flex-1 h-1 rounded-full',
                  phase.status === 'success' ? 'bg-green-500' :
                  phase.status === 'failed' ? 'bg-red-500' :
                  'bg-yellow-500'
                )}
                title={`${phase.phaseId}: ${phase.status}`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Config Panel (Expandable) */}
      {showConfig && (
        <div className="border-t border-border-color pt-4 space-y-2">
          <h4 className="text-sm font-medium text-text-primary">流程配置</h4>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex justify-between">
              <span className="text-text-muted">版本:</span>
              <span className="text-text-primary">v1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">默认流程:</span>
              <span className="text-text-primary">{engine?.getDefaultChain()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Regime触发:</span>
              <span className="text-text-primary">{Object.keys(engine?.getRegimeTriggers() || {}).length} 个</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}