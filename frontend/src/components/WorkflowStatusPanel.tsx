/**
 * WorkflowStatusPanel - UI Component for Phase Workflow Display
 * Shows current phase progress, phase results, and control buttons
 */
import { useState, useEffect } from 'react';
import { useWorkflowStore, getPhaseName, getPhaseIndex } from '../services/workflow/WorkflowStore';
import type { PhaseResult, WorkflowCandidate, DebateDecision, ExecutedOrder } from '../services/workflow/types';

interface PhaseDetailModalProps {
  result: PhaseResult;
  onClose: () => void;
}

function PhaseDetailModal({ result, onClose }: PhaseDetailModalProps) {
  const getPhaseIcon = (phase: string) => {
    switch (phase) {
      case 'scan': return '🔍';
      case 'analyze': return '📊';
      case 'debate': return '💬';
      case 'execute': return '📈';
      default: return '⏳';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-50';
      case 'failed': return 'text-red-600 bg-red-50';
      case 'running': return 'text-blue-600 bg-blue-50';
      case 'skipped': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{getPhaseIcon(result.phase)}</span>
            <h3 className="text-lg font-semibold">{getPhaseName(result.phase as any)}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm mb-4 ${getStatusColor(result.status)}`}>
          {result.status}
        </div>

        {result.message && (
          <p className="text-gray-700 mb-4">{result.message}</p>
        )}

        {result.duration && (
          <p className="text-sm text-gray-500 mb-4">耗时: {(result.duration / 1000).toFixed(1)}秒</p>
        )}

        {result.error && (
          <p className="text-red-600 mb-4">错误: {result.error}</p>
        )}

        {/* Phase-specific data display */}
        {result.phase === 'scan' && result.data && (
          <div className="border rounded p-4 mb-4">
            <h4 className="font-medium mb-2">扫描结果</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}

        {result.phase === 'analyze' && result.data && (
          <div className="border rounded p-4 mb-4">
            <h4 className="font-medium mb-2">分析结果</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}

        {result.phase === 'debate' && result.data && (
          <div className="border rounded p-4 mb-4">
            <h4 className="font-medium mb-2">辩论决策</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}

        {result.phase === 'execute' && result.data && (
          <div className="border rounded p-4 mb-4">
            <h4 className="font-medium mb-2">执行结果</h4>
            <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-60">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 bg-gray-100 hover:bg-gray-200 rounded font-medium"
        >
          关闭
        </button>
      </div>
    </div>
  );
}

export default function WorkflowStatusPanel() {
  const {
    currentPhase,
    phaseResults,
    isRunning,
    isPaused,
    progress,
    config,
    pauseWorkflow,
    resumeWorkflow,
    skipPhase,
    abortWorkflow,
  } = useWorkflowStore();

  const [showModal, setShowModal] = useState(false);
  const [selectedResult, setSelectedResult] = useState<PhaseResult | null>(null);
  const [phaseStartTime, setPhaseStartTime] = useState<number | null>(null);
  const [phaseElapsed, setPhaseElapsed] = useState(0);

  // Track phase timing
  useEffect(() => {
    if (isRunning && currentPhase !== 'idle') {
      setPhaseStartTime(Date.now());
      setPhaseElapsed(0);
    }
  }, [currentPhase, isRunning]);

  useEffect(() => {
    if (!isRunning || !phaseStartTime) return;

    const interval = setInterval(() => {
      setPhaseElapsed(Date.now() - phaseStartTime);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, phaseStartTime]);

  const handleSkip = () => {
    skipPhase();
  };

  const handleAbort = () => {
    if (confirm('确定要中止当前工作流吗？')) {
      abortWorkflow();
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeWorkflow();
    } else {
      pauseWorkflow();
    }
  };

  const handleResultClick = (result: PhaseResult) => {
    setSelectedResult(result);
    setShowModal(true);
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    if (minutes > 0) {
      return `${minutes}分${remainingSeconds}秒`;
    }
    return `${seconds}秒`;
  };

  const PHASES = [
    { key: 'scan', label: '市场扫描', icon: '🔍' },
    { key: 'analyze', label: '多因子分析', icon: '📊' },
    { key: 'debate', label: '辩论决策', icon: '💬' },
    { key: 'execute', label: '执行下单', icon: '📈' },
  ] as const;

  const getPhaseStatus = (phaseKey: string) => {
    const phaseIndex = PHASES.findIndex(p => p.key === phaseKey);
    const currentIndex = getPhaseIndex(currentPhase);

    if (!isRunning && phaseIndex > currentIndex) {
      return 'pending';
    }
    if (phaseIndex < currentIndex) {
      return 'completed';
    }
    if (phaseIndex === currentIndex) {
      if (isPaused) return 'paused';
      if (isRunning) return 'running';
    }
    return 'pending';
  };

  const getResultForPhase = (phase: string) => {
    return phaseResults.find(r => r.phase === phase);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-800">Phase Workflow</h3>
          {isRunning && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              {isPaused ? '已暂停' : '运行中'}
            </span>
          )}
        </div>
        {isRunning && (
          <div className="text-sm text-gray-500">
            {formatTime(phaseElapsed)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="mb-4">
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 text-right">{progress.toFixed(0)}%</div>
        </div>
      )}

      {/* Phase steps */}
      <div className="flex items-center justify-between mb-4">
        {PHASES.map((phase, idx) => {
          const status = getPhaseStatus(phase.key);
          const result = getResultForPhase(phase.key);

          return (
            <div key={phase.key} className="flex flex-col items-center">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`absolute h-0.5 w-full -ml-6 ${
                    getPhaseStatus(PHASES[idx - 1].key) === 'completed'
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                  }`}
                  style={{ width: 'calc(100% + 24px)', left: 0 }}
                />
              )}

              {/* Step circle */}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-lg relative z-10 ${
                  status === 'completed'
                    ? 'bg-green-500 text-white'
                    : status === 'running'
                    ? 'bg-blue-500 text-white animate-pulse'
                    : status === 'paused'
                    ? 'bg-yellow-500 text-white'
                    : status === 'failed'
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {status === 'completed' ? '✓' : phase.icon}
              </div>

              {/* Label */}
              <div className="text-xs mt-1 text-center">
                <div className={`font-medium ${
                  status === 'running' ? 'text-blue-600' :
                  status === 'completed' ? 'text-green-600' :
                  'text-gray-500'
                }`}>
                  {phase.label}
                </div>
                {result && (
                  <button
                    onClick={() => handleResultClick(result)}
                    className="text-xs text-blue-500 hover:text-blue-700"
                  >
                    查看详情
                  </button>
                )}
              </div>

              {/* Duration */}
              {result?.duration && (
                <div className="text-xs text-gray-400">
                  {formatTime(result.duration)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Control buttons */}
      <div className="flex gap-2 mt-4">
        {isRunning ? (
          <>
            <button
              onClick={handlePauseResume}
              className={`flex-1 py-2 rounded font-medium ${
                isPaused
                  ? 'bg-green-500 hover:bg-green-600 text-white'
                  : 'bg-yellow-500 hover:bg-yellow-600 text-white'
              }`}
            >
              {isPaused ? '继续' : '暂停'}
            </button>
            <button
              onClick={handleSkip}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium"
            >
              跳过'
            </button>
            <button
              onClick={handleAbort}
              className="flex-1 py-2 bg-red-500 hover:bg-red-600 text-white rounded font-medium"
            >
              中止
            </button>
          </>
        ) : (
          <div className="w-full text-center text-sm text-gray-500 py-2">
            {currentPhase === 'idle' ? '点击开始运行工作流' : '工作流已结束'}
          </div>
        )}
      </div>

      {/* Phase results summary */}
      {phaseResults.length > 0 && (
        <div className="mt-4 border-t pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2">执行结果</h4>
          <div className="space-y-2">
            {phaseResults.map((result, idx) => (
              <button
                key={idx}
                onClick={() => handleResultClick(result)}
                className="w-full text-left p-2 bg-gray-50 hover:bg-gray-100 rounded text-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <span>{PHASES.find(p => p.key === result.phase)?.icon}</span>
                    <span>{getPhaseName(result.phase as any)}</span>
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {result.success ? '成功' : '失败'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && selectedResult && (
        <PhaseDetailModal
          result={selectedResult}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}