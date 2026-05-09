/**
 * Broker Settings Component
 * Configure broker API credentials and connection status
 */

import { useState, useEffect } from 'react';
import { useStore, useBrokerStore } from '../store';
import {
  BrokerConfig,
  BrokerType,
  loadBrokerConfig,
  saveBrokerConfig,
  createBrokerProvider,
} from '../services/brokerProvider';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Plug, Unplug } from 'lucide-react';
import clsx from 'clsx';

const BROKER_OPTIONS: { value: BrokerType; label: string; desc: string }[] = [
  { value: 'simulate', label: '模拟交易', desc: '使用本地模拟，不连接真实券商' },
  { value: 'alpaca', label: 'Alpaca', desc: '美国股票/加密货币，支持Paper/Live' },
  { value: 'interactive_brokers', label: 'Interactive Brokers', desc: '港股/美股（暂不支持）' },
];

export default function BrokerSettings() {
  const { showNotification } = useStore();
  const brokerState = useBrokerStore();
  const [config, setConfig] = useState<BrokerConfig>(loadBrokerConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingConfig, setPendingConfig] = useState<BrokerConfig | null>(null);

  useEffect(() => {
    // Sync with store
    if (brokerState?.config) {
      setConfig(brokerState.config);
    }
  }, [brokerState?.config]);

  const isLiveMode = config.provider === 'alpaca' && !config.paper;

  const handleProviderChange = (provider: BrokerType) => {
    if (provider !== 'simulate' && !isLiveMode && config.provider === 'simulate') {
      // Switching to live mode - show confirmation
      setPendingConfig({ ...config, provider });
      setShowConfirm(true);
      return;
    }
    setConfig(prev => ({ ...prev, provider }));
    setTestResult(null);
  };

  const handlePaperToggle = (paper: boolean) => {
    if (!paper && config.provider === 'alpaca') {
      // Switching to live mode
      setPendingConfig({ ...config, paper: false });
      setShowConfirm(true);
      return;
    }
    setConfig(prev => ({ ...prev, paper }));
    setTestResult(null);
  };

  const handleConfirmSwitch = () => {
    if (pendingConfig) {
      setConfig(pendingConfig);
      setPendingConfig(null);
    }
    setShowConfirm(false);
  };

  const handleCancelConfirm = () => {
    setPendingConfig(null);
    setShowConfirm(false);
  };

  const handleTestConnection = async () => {
    if (config.provider === 'simulate') {
      const provider = createBrokerProvider(config);
      const result = await provider.testConnection();
      setTestResult(result);
      return;
    }

    if (!config.apiKey || !config.apiSecret) {
      setTestResult({ success: false, message: '请输入 API Key 和 Secret' });
      return;
    }

    setTesting(true);
    setTestResult(null);
    try {
      const provider = createBrokerProvider(config);
      const result = await provider.testConnection();
      setTestResult(result);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '测试失败';
      setTestResult({ success: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    if (config.provider === 'simulate') {
      await brokerState?.connect?.();
      return;
    }

    if (!config.apiKey || !config.apiSecret) {
      showNotification('error', '请先填写 API Key 和 Secret');
      return;
    }

    setConnecting(true);
    try {
      const provider = createBrokerProvider(config);
      await provider.connect();
      saveBrokerConfig(config);
      await brokerState?.setConfig?.(config);
      await brokerState?.connect?.();
      showNotification('success', '券商连接成功');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '连接失败';
      showNotification('error', msg);
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await brokerState?.disconnect?.();
      showNotification('info', '已断开券商连接');
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = () => {
    saveBrokerConfig(config);
    brokerState?.setConfig?.(config);
    showNotification('success', '配置已保存');
  };

  const getConnectionStatus = () => {
    if (connecting || testing) return 'connecting';
    if (brokerState?.isConnected) return 'connected';
    return 'disconnected';
  };

  const statusConfig = {
    disconnected: { color: 'bg-gray-400', label: '未连接', icon: <Unplug size={14} /> },
    connecting: { color: 'bg-yellow-400', label: '连接中', icon: <Loader2 size={14} className="animate-spin" /> },
    connected: { color: 'bg-green-400', label: '已连接', icon: <CheckCircle size={14} /> },
  };

  const status = getConnectionStatus();
  const statusInfo = statusConfig[status];

  const currentModeLabel = () => {
    if (config.provider === 'simulate') return '模拟';
    if (config.provider === 'alpaca' && config.paper) return 'Paper';
    if (config.provider === 'alpaca') return 'Live';
    return config.provider;
  };

  return (
    <div className="space-y-6">
      {/* Header with Status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
            <Plug size={20} className="text-accent-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">券商账户</h3>
            <p className="text-xs text-text-muted">配置实盘交易券商</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-bg-tertiary border border-border-color">
          <div className={clsx('w-2 h-2 rounded-full', statusInfo.color)} />
          {statusInfo.icon}
          <span className="text-xs text-text-secondary">{statusInfo.label}</span>
        </div>
      </div>

      {/* Mode Badge */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gradient-to-r from-accent-primary/10 to-transparent border border-accent-primary/20">
        <span className="text-xs text-text-muted uppercase tracking-wider">当前模式</span>
        <span className={clsx(
          'px-3 py-1 rounded-full text-xs font-bold',
          config.provider === 'simulate' ? 'bg-gray-500/20 text-gray-400' :
          config.paper ? 'bg-yellow-500/20 text-yellow-400' : 'bg-green-500/20 text-green-400'
        )}>
          {currentModeLabel()}
        </span>
        {isLiveMode && (
          <AlertTriangle size={14} className="text-accent-danger" />
        )}
      </div>

      {/* Broker Selection */}
      <div className="space-y-3">
        <label className="block text-xs text-text-muted uppercase tracking-wider">选择券商</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {BROKER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleProviderChange(opt.value)}
              disabled={opt.value === 'interactive_brokers'}
              className={clsx(
                'p-4 rounded-xl border-2 text-left transition-all',
                config.provider === opt.value
                  ? 'border-accent-primary bg-accent-primary/5'
                  : 'border-border-color hover:border-accent-primary/30',
                opt.value === 'interactive_brokers' && 'opacity-50 cursor-not-allowed'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-text-primary text-sm">{opt.label}</span>
                {config.provider === opt.value && (
                  <CheckCircle size={16} className="text-accent-primary" />
                )}
              </div>
              <p className="text-xs text-text-muted">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Alpaca Config */}
      {config.provider === 'alpaca' && (
        <div className="space-y-4 p-4 rounded-xl bg-bg-tertiary/50 border border-border-color">
          <div>
            <label className="block text-xs text-text-muted mb-2">API Key</label>
            <input
              type="password"
              value={config.apiKey || ''}
              onChange={e => setConfig(prev => ({ ...prev, apiKey: e.target.value }))}
              placeholder="输入 Alpaca API Key"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div>
            <label className="block text-xs text-text-muted mb-2">API Secret</label>
            <input
              type="password"
              value={config.apiSecret || ''}
              onChange={e => setConfig(prev => ({ ...prev, apiSecret: e.target.value }))}
              placeholder="输入 Alpaca API Secret"
              className="w-full px-4 py-2.5 bg-bg-tertiary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
            />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-text-primary">Paper Trade</span>
              <p className="text-xs text-text-muted">开启使用模拟资金交易</p>
            </div>
            <button
              onClick={() => handlePaperToggle(!config.paper)}
              className={clsx(
                'relative w-12 h-6 rounded-full transition-colors',
                config.paper ? 'bg-accent-primary' : 'bg-gray-600'
              )}
            >
              <div className={clsx(
                'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                config.paper ? 'translate-x-7' : 'translate-x-1'
              )} />
            </button>
          </div>
        </div>
      )}

      {/* Test Result */}
      {testResult && (
        <div className={clsx(
          'flex items-start gap-3 p-4 rounded-xl border',
          testResult.success
            ? 'bg-accent-success/10 border-accent-success/30 text-accent-success'
            : 'bg-accent-danger/10 border-accent-danger/30 text-accent-danger'
        )}>
          {testResult.success ? <CheckCircle size={18} /> : <XCircle size={18} />}
          <div>
            <p className="text-sm font-medium">{testResult.success ? '连接成功' : '连接失败'}</p>
            <p className="text-xs mt-1 opacity-80">{testResult.message}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleTestConnection}
          disabled={testing || connecting}
          className="flex-1 py-2.5 border border-border-color rounded-xl text-sm text-text-secondary hover:bg-bg-tertiary transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : null}
          {testing ? '测试中...' : '测试连接'}
        </button>
        {brokerState?.isConnected ? (
          <button
            onClick={handleDisconnect}
            className="flex-1 py-2.5 bg-accent-danger/10 border border-accent-danger/30 rounded-xl text-sm text-accent-danger hover:bg-accent-danger/20 transition-colors flex items-center justify-center gap-2"
          >
            <Unplug size={14} />
            断开连接
          </button>
        ) : (
          <button
            onClick={handleConnect}
            disabled={connecting || testing}
            className="flex-1 py-2.5 bg-accent-primary rounded-xl text-sm text-white font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {connecting ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />}
            {connecting ? '连接中...' : '连接券商'}
          </button>
        )}
      </div>

      <button
        onClick={handleSave}
        className="w-full py-2.5 border border-border-color rounded-xl text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
      >
        保存配置
      </button>

      {/* Live Mode Warning */}
      {isLiveMode && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-accent-danger/5 border border-accent-danger/20">
          <AlertTriangle size={18} className="text-accent-danger shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-accent-danger">实盘交易警告</p>
            <p className="text-xs text-text-muted mt-1">
              切换到 Live 模式后将使用真实资金进行交易。请确保您已充分了解风险，并确认 API 密钥正确无误。
            </p>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-bg-secondary border border-border-color rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-accent-danger/10 flex items-center justify-center">
                <AlertTriangle size={20} className="text-accent-danger" />
              </div>
              <div>
                <h4 className="font-semibold text-text-primary">切换到实盘</h4>
                <p className="text-xs text-text-muted">确认切换券商模式</p>
              </div>
            </div>
            <p className="text-sm text-text-secondary">
              {pendingConfig?.provider === 'alpaca' && !pendingConfig?.paper
                ? '即将切换到 Alpaca Live 实盘模式。这将使用您的真实资金进行交易，是否继续？'
                : '即将切换到实盘交易模式。请确认已正确配置券商 API。'}
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleCancelConfirm}
                className="flex-1 py-2.5 border border-border-color rounded-xl text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleConfirmSwitch}
                className="flex-1 py-2.5 bg-accent-danger rounded-xl text-sm text-white font-medium hover:bg-accent-danger/90 transition-colors"
              >
                确认切换
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
