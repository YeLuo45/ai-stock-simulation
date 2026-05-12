/**
 * Alert Panel Component - Risk Alert Display
 * Cyberpunk terminal style with dark card background
 */
import { useState, useEffect, useCallback } from 'react';
import { Bell, AlertTriangle, X, Check, Trash2 } from 'lucide-react';
import { NotificationService, type RiskAlert } from '../services/NotificationService';
import clsx from 'clsx';

interface AlertPanelProps {
  onClose?: () => void;
}

export default function AlertPanel({ onClose }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const loadAlerts = useCallback(() => {
    const data = NotificationService.getAlerts();
    // Sort by timestamp descending (newest first)
    data.sort((a, b) => b.timestamp - a.timestamp);
    setAlerts(data);
  }, []);

  useEffect(() => {
    loadAlerts();
    // Poll for new alerts every 2 seconds
    const interval = setInterval(loadAlerts, 2000);
    return () => clearInterval(interval);
  }, [loadAlerts]);

  const handleAcknowledge = (id: string) => {
    NotificationService.acknowledgeAlert(id);
    loadAlerts();
  };

  const handleAcknowledgeAll = () => {
    const unacknowledged = alerts.filter(a => !a.acknowledged);
    unacknowledged.forEach(a => NotificationService.acknowledgeAlert(a.id));
    loadAlerts();
  };

  const handleClearHistory = () => {
    if (confirm('确定清除所有告警历史吗？')) {
      localStorage.removeItem('risk_alerts');
      loadAlerts();
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    if (diffHours < 24) return `${diffHours}小时前`;
    if (diffDays < 7) return `${diffDays}天前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  const filteredAlerts = filter === 'unread'
    ? alerts.filter(a => !a.acknowledged)
    : alerts;

  const unreadCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="bg-bg-secondary border border-border-color rounded-xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border-color bg-bg-tertiary/50">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-accent-primary" />
          <span className="text-sm font-medium text-text-primary">风险告警</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-xs font-bold bg-accent-danger/20 text-accent-danger">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-bg-tertiary text-text-muted hover:text-text-primary transition-colors"
              title="关闭"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 px-4 py-2 border-b border-border-color/50 bg-bg-tertiary/30">
        <button
          onClick={() => setFilter('all')}
          className={clsx(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            filter === 'all'
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          全部 ({alerts.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={clsx(
            'px-3 py-1 rounded text-xs font-medium transition-colors',
            filter === 'unread'
              ? 'bg-accent-primary/20 text-accent-primary'
              : 'text-text-muted hover:text-text-secondary'
          )}
        >
          未读 ({unreadCount})
        </button>
      </div>

      {/* Alert List */}
      <div className="max-h-96 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Bell size={32} className="text-text-muted/40 mb-3" />
            <p className="text-sm text-text-muted">
              {filter === 'unread' ? '暂无未读告警' : '暂无告警记录'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border-color/30">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={clsx(
                  'relative px-4 py-3 transition-colors hover:bg-bg-tertiary/30',
                  !alert.acknowledged && 'border-l-2'
                )}
                style={{
                  borderLeftColor: !alert.acknowledged
                    ? alert.level === 'critical' ? '#ef4444' : '#eab308'
                    : 'transparent',
                }}
              >
                <div className="flex items-start gap-3">
                  {/* Level Icon */}
                  <div className={clsx(
                    'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                    alert.level === 'critical'
                      ? 'bg-accent-danger/10 text-accent-danger'
                      : 'bg-yellow-500/10 text-yellow-400'
                  )}>
                    <AlertTriangle size={16} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        'px-1.5 py-0.5 rounded text-xs font-bold uppercase',
                        alert.level === 'critical'
                          ? 'bg-accent-danger/20 text-accent-danger'
                          : 'bg-yellow-500/20 text-yellow-400'
                      )}>
                        {alert.level === 'critical' ? '严重' : '警告'}
                      </span>
                      <span className="text-xs text-text-muted">
                        {formatTime(alert.timestamp)}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-text-primary mb-1">
                      {alert.title}
                    </p>
                    <p className="text-xs text-text-muted leading-relaxed">
                      {alert.message}
                    </p>
                  </div>

                  {/* Actions */}
                  {!alert.acknowledged && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="shrink-0 p-1.5 rounded-lg text-text-muted hover:text-accent-primary hover:bg-accent-primary/10 transition-colors"
                      title="标记已读"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      {alerts.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border-color bg-bg-tertiary/30">
          <button
            onClick={handleAcknowledgeAll}
            disabled={unreadCount === 0}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
              unreadCount === 0
                ? 'text-text-muted/40 cursor-not-allowed'
                : 'text-accent-primary hover:bg-accent-primary/10'
            )}
          >
            <Check size={12} />
            全部标记已读
          </button>
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-accent-danger/60 hover:text-accent-danger hover:bg-accent-danger/10 transition-colors"
          >
            <Trash2 size={12} />
            清除历史
          </button>
        </div>
      )}
    </div>
  );
}
