/**
 * SchedulerPanel - Agent Automation Scheduling UI
 * Dark card style matching project UI
 */
import { useState, useEffect } from 'react';
import { SchedulerStore, type ScheduleConfig } from '../agents/SchedulerStore';
import { runScheduledCycle } from '../agents/ScheduleEngine';
import { Clock, Play, Trash2, Plus, X, Check, Calendar, Zap } from 'lucide-react';
import clsx from 'clsx';

const DAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function formatTime(ts: number | undefined): string {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function formatTrigger(config: ScheduleConfig): string {
  if (config.trigger === 'manual') return '手动';
  if (config.trigger === 'daily') return `每日 ${config.timeOfDay || ''}`;
  if (config.trigger === 'weekly') {
    const day = config.dayOfWeek !== undefined ? DAYS[config.dayOfWeek] : '';
    return `每周 ${day} ${config.timeOfDay || ''}`;
  }
  return '';
}

export default function SchedulerPanel() {
  const [schedules, setSchedules] = useState<ScheduleConfig[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    trigger: 'daily' as ScheduleConfig['trigger'],
    timeOfDay: '14:30',
    dayOfWeek: 1,
    stockPool: '000001,000002,300750',
  });

  const loadSchedules = () => {
    setSchedules(SchedulerStore.getSchedules());
  };

  useEffect(() => {
    loadSchedules();
    // Poll every 60 seconds for due schedules
    const interval = setInterval(() => {
      checkAndRunDueSchedules();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Check and run due schedules
  const checkAndRunDueSchedules = () => {
    const now = Date.now();
    const currentSchedules = SchedulerStore.getSchedules();
    for (const schedule of currentSchedules) {
      if (
        schedule.enabled &&
        schedule.trigger !== 'manual' &&
        schedule.nextRun &&
        schedule.nextRun <= now &&
        schedule.status !== 'running'
      ) {
        runScheduledCycle(schedule);
      }
    }
    loadSchedules();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    const id = `schedule-${Date.now()}`;
    const stockSymbols = formData.stockPool
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const config: ScheduleConfig = {
      id,
      name: formData.name.trim(),
      enabled: true,
      trigger: formData.trigger,
      timeOfDay: formData.trigger !== 'manual' ? formData.timeOfDay : undefined,
      dayOfWeek: formData.trigger === 'weekly' ? formData.dayOfWeek : undefined,
      stockPool: stockSymbols,
      factors: [
        { factor_id: 'volume_ratio', weight: 0.3, direction: 'long' },
        { factor_id: 'price_strength', weight: 0.3, direction: 'long' },
        { factor_id: 'rsi', weight: 0.2, direction: 'short' },
        { factor_id: 'volatility', weight: 0.2, direction: 'short' },
      ],
      status: 'idle',
      nextRun: 0,
    };

    // Calculate initial next run
    config.nextRun = SchedulerStore.calculateNextRun(config);

    SchedulerStore.saveSchedule(config);
    setFormData({ name: '', trigger: 'daily', timeOfDay: '14:30', dayOfWeek: 1, stockPool: '000001,000002,300750' });
    setShowForm(false);
    loadSchedules();
  };

  const handleDelete = (id: string) => {
    if (!confirm('确定删除该调度?')) return;
    SchedulerStore.deleteSchedule(id);
    loadSchedules();
  };

  const handleToggle = (schedule: ScheduleConfig) => {
    SchedulerStore.updateScheduleStatus(schedule.id, {
      enabled: !schedule.enabled,
      nextRun: !schedule.enabled ? SchedulerStore.calculateNextRun(schedule) : 0,
    });
    loadSchedules();
  };

  const handleRunNow = (schedule: ScheduleConfig) => {
    runScheduledCycle(schedule);
    loadSchedules();
  };

  const statusColor = (status: ScheduleConfig['status']) => {
    switch (status) {
      case 'running': return 'text-yellow-400';
      case 'success': return 'text-accent-success';
      case 'error': return 'text-accent-danger';
      default: return 'text-text-muted';
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-primary/10 border border-accent-primary/30 flex items-center justify-center">
            <Zap size={18} className="text-accent-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">自动化调度</h2>
            <p className="text-xs text-text-muted">Agent 自动化执行计划</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent-primary text-bg-primary text-sm font-medium hover:bg-accent-primary/90 transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? '取消' : '新建调度'}
        </button>
      </div>

      {/* New Schedule Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-bg-tertiary border border-border-color rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">调度名称</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="例如：每日选股"
                className="w-full px-4 py-2.5 bg-bg-secondary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors"
              />
            </div>

            {/* Trigger */}
            <div>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">触发频率</label>
              <div className="flex gap-2">
                {(['daily', 'weekly', 'manual'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFormData({ ...formData, trigger: t })}
                    className={clsx(
                      'flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                      formData.trigger === t
                        ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary'
                        : 'bg-bg-secondary border-border-color text-text-muted hover:text-text-secondary'
                    )}
                  >
                    {t === 'daily' ? '每日' : t === 'weekly' ? '每周' : '手动'}
                  </button>
                ))}
              </div>
            </div>

            {/* Time (for daily/weekly) */}
            {formData.trigger !== 'manual' && (
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">执行时间</label>
                <input
                  type="time"
                  value={formData.timeOfDay}
                  onChange={e => setFormData({ ...formData, timeOfDay: e.target.value })}
                  className="w-full px-4 py-2.5 bg-bg-secondary border border-border-color rounded-xl text-sm text-text-primary focus:outline-none focus:border-accent-primary/50 transition-colors"
                />
              </div>
            )}

            {/* Day of week (for weekly) */}
            {formData.trigger === 'weekly' && (
              <div>
                <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">选择星期</label>
                <div className="flex gap-1">
                  {DAYS.map((day, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFormData({ ...formData, dayOfWeek: idx })}
                      className={clsx(
                        'flex-1 py-2 rounded-lg text-xs font-medium border transition-colors',
                        formData.dayOfWeek === idx
                          ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary'
                          : 'bg-bg-secondary border-border-color text-text-muted hover:text-text-secondary'
                      )}
                    >
                      {day.slice(0, 1)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stock Pool */}
            <div className={clsx(formData.trigger === 'manual' ? 'md:col-span-2' : '')}>
              <label className="block text-xs text-text-muted uppercase tracking-wider mb-2">股票池 (逗号分隔)</label>
              <textarea
                value={formData.stockPool}
                onChange={e => setFormData({ ...formData, stockPool: e.target.value })}
                placeholder="000001,000002,300750"
                rows={2}
                className="w-full px-4 py-2.5 bg-bg-secondary border border-border-color rounded-xl text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50 transition-colors resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-xl border border-border-color text-text-muted text-sm hover:text-text-secondary transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-xl bg-accent-primary text-bg-primary text-sm font-medium hover:bg-accent-primary/90 transition-colors"
            >
              创建调度
            </button>
          </div>
        </form>
      )}

      {/* Schedule Cards */}
      {schedules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-bg-tertiary flex items-center justify-center mb-4">
            <Calendar size={28} className="text-text-muted" />
          </div>
          <p className="text-text-secondary font-medium mb-1">暂无调度</p>
          <p className="text-text-muted text-sm">点击上方按钮创建第一个自动化调度</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {schedules.map(schedule => (
            <div
              key={schedule.id}
              className="bg-bg-secondary border border-border-color rounded-2xl p-5 hover:border-accent-primary/30 transition-colors"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={clsx(
                    'w-10 h-10 rounded-xl flex items-center justify-center',
                    schedule.enabled ? 'bg-accent-primary/10' : 'bg-bg-tertiary'
                  )}>
                    <Clock size={18} className={schedule.enabled ? 'text-accent-primary' : 'text-text-muted'} />
                  </div>
                  <div>
                    <h3 className="font-medium text-text-primary">{schedule.name}</h3>
                    <p className="text-xs text-text-muted mt-0.5">{formatTrigger(schedule)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={clsx('text-xs font-medium', statusColor(schedule.status))}>
                    {schedule.status === 'running' ? '执行中' : schedule.status === 'success' ? '成功' : schedule.status === 'error' ? '失败' : '空闲'}
                  </span>
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(schedule)}
                    className={clsx(
                      'w-12 h-6 rounded-full transition-colors relative',
                      schedule.enabled ? 'bg-accent-primary' : 'bg-bg-tertiary'
                    )}
                  >
                    <div className={clsx(
                      'w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform',
                      schedule.enabled ? 'translate-x-6' : 'translate-x-0.5'
                    )} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div>
                  <span className="text-xs text-text-muted block">下次执行</span>
                  <span className="text-sm text-text-secondary font-mono">
                    {schedule.enabled && schedule.nextRun ? formatTime(schedule.nextRun) : '--'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-muted block">上次执行</span>
                  <span className="text-sm text-text-secondary font-mono">{formatTime(schedule.lastRun)}</span>
                </div>
                <div>
                  <span className="text-xs text-text-muted block">选中股票</span>
                  <span className="text-sm text-text-secondary font-mono">
                    {schedule.lastResult?.selectedSymbol || '--'}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-text-muted block">收益率</span>
                  <span className={clsx(
                    'text-sm font-mono',
                    schedule.lastResult?.totalReturn !== undefined
                      ? schedule.lastResult.totalReturn >= 0 ? 'text-accent-danger' : 'text-accent-success'
                      : 'text-text-muted'
                  )}>
                    {schedule.lastResult?.totalReturn !== undefined
                      ? `${schedule.lastResult.totalReturn >= 0 ? '+' : ''}${schedule.lastResult.totalReturn.toFixed(2)}%`
                      : '--'}
                  </span>
                </div>
              </div>

              {/* Last error if any */}
              {schedule.lastResult?.error && (
                <div className="mb-4 p-3 rounded-lg bg-accent-danger/10 border border-accent-danger/20">
                  <span className="text-xs text-accent-danger">{schedule.lastResult.error}</span>
                </div>
              )}

              <div className="flex items-center gap-2 pt-3 border-t border-border-color">
                <button
                  onClick={() => handleRunNow(schedule)}
                  disabled={schedule.status === 'running'}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-primary/10 border border-accent-primary/30 text-accent-primary text-sm hover:bg-accent-primary/20 transition-colors disabled:opacity-40"
                >
                  <Play size={14} />
                  立即运行
                </button>
                <button
                  onClick={() => handleDelete(schedule.id)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border-color text-text-muted text-sm hover:text-accent-danger hover:border-accent-danger/30 transition-colors"
                >
                  <Trash2 size={14} />
                  删除
                </button>
                <span className="ml-auto text-xs text-text-muted">
                  股票池: {schedule.stockPool.length} 个
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
