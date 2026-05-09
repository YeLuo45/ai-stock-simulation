/**
 * Strategy Market Page - Browse, subscribe to and manage trading strategies
 */
import { useState, useEffect, useMemo } from 'react';
import { useStore } from '../store';
import type {
  StrategyMarketItem,
  StrategyCategory,
  StrategyRiskLevel,
  StrategyMarketFilters,
  StrategyReview,
} from '../types';
import type { SubscribedStrategy } from '../store';
import {
  Search, Filter, Star, Users, BarChart3,
  ChevronDown, X, BookOpen, Check, Crown, Zap,
  ThumbsUp, Calendar, Activity, ChevronRight, SlidersHorizontal
} from 'lucide-react';
import clsx from 'clsx';

// ============ Mock Data ============

const MOCK_STRATEGIES: StrategyMarketItem[] = [
  {
    id: 's1',
    name: '均线金叉策略',
    description: '基于MA5/MA20均线金叉死叉的经典趋势跟踪策略，配合RSI过滤假信号，适合中长期趋势行情。',
    author: { id: 'u1', name: '量化研究猿', verified: true },
    category: 'technical',
    tags: ['均线', '趋势跟踪', 'MA', 'RSI'],
    total_return: 42.5,
    annual_return: 18.3,
    sharpe_ratio: 1.45,
    max_drawdown: -15.2,
    win_rate: 58.5,
    total_trades: 124,
    risk_level: 'medium',
    volatility: 18.5,
    subscribers: 2456,
    rating: 4.8,
    review_count: 89,
    version: '2.1.0',
    created_at: '2025-08-15T10:00:00Z',
    updated_at: '2026-01-20T14:30:00Z',
    status: 'active',
    is_premium: false,
    is_featured: true,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['MA5上穿MA20', 'RSI<70'],
      exit_conditions: ['MA5下穿MA20', 'RSI>80'],
      position_size: 0.3,
      stop_loss: 0.05,
      take_profit: 0.15,
    },
  },
  {
    id: 's2',
    name: '价值低估精选',
    description: '基于PE、PB、ROE等基本面指标筛选低估值高成长股票，配合股息率过滤，适合价值投资者。',
    author: { id: 'u2', name: '价值投资达人', verified: true },
    category: 'fundamental',
    tags: ['价值投资', '低估值', '基本面', '股息'],
    total_return: 35.8,
    annual_return: 14.2,
    sharpe_ratio: 1.28,
    max_drawdown: -22.1,
    win_rate: 65.0,
    total_trades: 42,
    risk_level: 'low',
    volatility: 12.3,
    subscribers: 1823,
    rating: 4.6,
    review_count: 67,
    version: '1.5.0',
    created_at: '2025-06-10T08:00:00Z',
    updated_at: '2025-12-15T09:00:00Z',
    status: 'active',
    is_premium: true,
    is_featured: false,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['PE<15', 'ROE>10%', 'PB<2'],
      exit_conditions: ['PE>30', 'ROE<5%'],
      position_size: 0.4,
      stop_loss: 0.1,
      take_profit: 0.3,
    },
  },
  {
    id: 's3',
    name: 'MACD多周期共振',
    description: '结合日线、周线MACD多周期信号共振，配合成交量放大确认，适合短线交易者。',
    author: { id: 'u3', name: '短线狙击手', verified: false },
    category: 'technical',
    tags: ['MACD', '多周期', '短线', '成交量'],
    total_return: 68.2,
    annual_return: 25.6,
    sharpe_ratio: 1.82,
    max_drawdown: -28.5,
    win_rate: 52.3,
    total_trades: 312,
    risk_level: 'high',
    volatility: 32.1,
    subscribers: 3156,
    rating: 4.4,
    review_count: 124,
    version: '3.0.1',
    created_at: '2025-03-20T12:00:00Z',
    updated_at: '2026-02-01T16:00:00Z',
    status: 'active',
    is_premium: false,
    is_featured: true,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['日线MACD金叉', '周线MACD金叉', '成交量放大1.5倍'],
      exit_conditions: ['日线MACD死叉'],
      position_size: 0.2,
      stop_loss: 0.03,
      take_profit: 0.08,
    },
  },
  {
    id: 's4',
    name: 'AI智能选股',
    description: '基于机器学习模型融合多因子选股，动态调整权重，适应市场风格切换。',
    author: { id: 'u4', name: 'AI量化实验室', verified: true },
    category: 'ai',
    tags: ['AI', '机器学习', '多因子', '动态调整'],
    total_return: 55.3,
    annual_return: 22.1,
    sharpe_ratio: 1.65,
    max_drawdown: -18.7,
    win_rate: 61.2,
    total_trades: 186,
    risk_level: 'medium',
    volatility: 22.4,
    subscribers: 4289,
    rating: 4.9,
    review_count: 203,
    version: '4.2.0',
    created_at: '2025-01-15T09:00:00Z',
    updated_at: '2026-03-01T11:00:00Z',
    status: 'active',
    is_premium: true,
    is_featured: true,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['AI信号买入', '多因子得分>0.7'],
      exit_conditions: ['AI信号卖出', '多因子得分<0.3'],
      position_size: 0.25,
      stop_loss: 0.08,
      take_profit: 0.2,
    },
  },
  {
    id: 's5',
    name: '布林带均值回归',
    description: '利用布林带上下轨的均值回归特性，在价格触及下轨时买入，上轨时卖出。',
    author: { id: 'u5', name: '布林格', verified: false },
    category: 'quantitative',
    tags: ['布林带', '均值回归', '震荡行情'],
    total_return: 28.9,
    annual_return: 11.8,
    sharpe_ratio: 1.15,
    max_drawdown: -12.5,
    win_rate: 70.5,
    total_trades: 89,
    risk_level: 'low',
    volatility: 10.2,
    subscribers: 987,
    rating: 4.3,
    review_count: 45,
    version: '1.2.0',
    created_at: '2025-09-05T14:00:00Z',
    updated_at: '2025-11-20T10:00:00Z',
    status: 'active',
    is_premium: false,
    is_featured: false,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['价格触及布林下轨', 'RSI<30'],
      exit_conditions: ['价格触及布林上轨', 'RSI>70'],
      position_size: 0.35,
      stop_loss: 0.04,
      take_profit: 0.1,
    },
  },
  {
    id: 's6',
    name: '趋势+价值混合策略',
    description: '结合趋势跟踪与价值投资优点，在上升趋势中寻找低估值标的，适合稳健型投资者。',
    author: { id: 'u6', name: '稳健前行', verified: true },
    category: 'hybrid',
    tags: ['混合策略', '趋势', '价值', '稳健'],
    total_return: 38.7,
    annual_return: 16.0,
    sharpe_ratio: 1.38,
    max_drawdown: -16.8,
    win_rate: 60.0,
    total_trades: 76,
    risk_level: 'medium',
    volatility: 15.6,
    subscribers: 1567,
    rating: 4.7,
    review_count: 78,
    version: '2.0.0',
    created_at: '2025-05-18T11:00:00Z',
    updated_at: '2026-01-10T15:00:00Z',
    status: 'active',
    is_premium: true,
    is_featured: false,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['MA20多头排列', 'PE<20', 'ROE>8%'],
      exit_conditions: ['MA20空头排列'],
      position_size: 0.3,
      stop_loss: 0.06,
      take_profit: 0.18,
    },
  },
  {
    id: 's7',
    name: 'RSI超卖反转',
    description: '专注于RSI超卖区域的反弹机会，适合震荡市和熊市反弹行情。',
    author: { id: 'u7', name: '超跌猎手', verified: false },
    category: 'technical',
    tags: ['RSI', '超卖', '反弹', '短线'],
    total_return: 45.2,
    annual_return: 19.5,
    sharpe_ratio: 1.52,
    max_drawdown: -20.3,
    win_rate: 55.8,
    total_trades: 198,
    risk_level: 'medium',
    volatility: 25.8,
    subscribers: 1234,
    rating: 4.5,
    review_count: 56,
    version: '2.3.1',
    created_at: '2025-07-22T08:00:00Z',
    updated_at: '2025-12-28T12:00:00Z',
    status: 'active',
    is_premium: false,
    is_featured: false,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['RSI<25', '成交量放大'],
      exit_conditions: ['RSI>60', 'RSI>80'],
      position_size: 0.25,
      stop_loss: 0.04,
      take_profit: 0.12,
    },
  },
  {
    id: 's8',
    name: '北向资金跟投',
    description: '追踪北向资金流向，跟随外资布局A股核心资产，适合长期定投。',
    author: { id: 'u8', name: '外资情报员', verified: true },
    category: 'quantitative',
    tags: ['北向资金', '外资', '价值投资', '定投'],
    total_return: 32.1,
    annual_return: 13.5,
    sharpe_ratio: 1.22,
    max_drawdown: -19.5,
    win_rate: 62.0,
    total_trades: 58,
    risk_level: 'medium',
    volatility: 14.8,
    subscribers: 2134,
    rating: 4.4,
    review_count: 91,
    version: '1.8.0',
    created_at: '2025-04-12T10:00:00Z',
    updated_at: '2026-02-15T09:00:00Z',
    status: 'active',
    is_premium: false,
    is_featured: false,
    backtest_start_date: '2023-01-01',
    backtest_end_date: '2026-01-01',
    initial_cash: 1000000,
    config_snapshot: {
      entry_conditions: ['北向资金连续净流入3日', '持仓市值增加>5%'],
      exit_conditions: ['北向资金净流出', '持仓市值减少>10%'],
      position_size: 0.35,
      stop_loss: 0.08,
      take_profit: 0.25,
    },
  },
];

const MOCK_REVIEWS: StrategyReview[] = [
  {
    id: 'r1',
    strategy_id: 's1',
    user_id: 'user1',
    user_name: '趋势追随者',
    rating: 5,
    content: '策略表现非常稳定，尤其是2024年熊市期间回撤控制得很好。均线参数可以根据市场调整，灵活性高。',
    pros: ['回撤控制好', '参数灵活', '信号明确'],
    cons: ['趋势行情效果一般'],
    created_at: '2026-01-15T10:00:00Z',
    helpful_count: 45,
  },
  {
    id: 'r2',
    strategy_id: 's1',
    user_id: 'user2',
    user_name: '量化新手',
    rating: 4,
    content: '对于新手来说很容易上手，文档也比较完善。建议配合其他指标使用效果更佳。',
    pros: ['易上手', '文档完善'],
    cons: ['需要配合其他指标'],
    created_at: '2026-01-10T14:30:00Z',
    helpful_count: 23,
  },
  {
    id: 'r3',
    strategy_id: 's4',
    user_id: 'user3',
    user_name: 'AI量化粉',
    rating: 5,
    content: 'AI策略确实比传统量化策略表现更好，尤其是市场风格切换时能快速适应。收费合理，值得订阅。',
    pros: ['适应性强', '收益高', '风控好'],
    cons: ['Premium价格略高'],
    created_at: '2026-02-20T09:00:00Z',
    helpful_count: 67,
  },
];

// ============ Category Config ============

const CATEGORY_CONFIG: Record<StrategyCategory, { label: string; icon: typeof Zap; color: string }> = {
  technical: { label: '技术策略', icon: Activity, color: 'text-blue-400' },
  fundamental: { label: '基本面策略', icon: BarChart3, color: 'text-green-400' },
  quantitative: { label: '量化策略', icon: SlidersHorizontal, color: 'text-purple-400' },
  ai: { label: 'AI策略', icon: Zap, color: 'text-amber-400' },
  hybrid: { label: '混合策略', icon: Crown, color: 'text-pink-400' },
};

const RISK_CONFIG: Record<StrategyRiskLevel, { label: string; color: string; bg: string }> = {
  low: { label: '低风险', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  medium: { label: '中风险', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  high: { label: '高风险', color: 'text-rose-400', bg: 'bg-rose-400/10' },
};

// ============ Main Component ============

const STRATEGIES_KEY = 'strategy-market-strategies';

function loadCachedStrategies(): StrategyMarketItem[] {
  try {
    const stored = localStorage.getItem(STRATEGIES_KEY);
    if (stored) {
      const cached = JSON.parse(stored);
      // Merge with mock data to get new strategies added to mock
      const cachedIds = new Set(cached.map((s: StrategyMarketItem) => s.id));
      const newMock = MOCK_STRATEGIES.filter(s => !cachedIds.has(s.id));
      return [...cached, ...newMock];
    }
  } catch { /* ignore */ }
  return MOCK_STRATEGIES;
}

export default function StrategyMarketPage() {
  const { subscribedStrategies, addSubscribedStrategy, removeSubscribedStrategy, showNotification, strategySignals } = useStore();

  const [strategies, setStrategies] = useState<StrategyMarketItem[]>(loadCachedStrategies);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState<'browse' | 'subscribed' | 'signals'>('browse');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyMarketItem | null>(null);

  const [filters, setFilters] = useState<StrategyMarketFilters>({
    sort_by: 'rating',
    sort_order: 'desc',
  });

  // Persist strategy updates (e.g., subscriber count changes)
  useEffect(() => {
    localStorage.setItem(STRATEGIES_KEY, JSON.stringify(strategies));
  }, [strategies]);

  // Filter and sort strategies
  const filteredStrategies = useMemo(() => {
    let result = [...strategies].filter(s => s.status === 'active');

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q)) ||
        s.author.name.toLowerCase().includes(q)
      );
    }

    if (filters.category) {
      result = result.filter(s => s.category === filters.category);
    }

    if (filters.risk_level) {
      result = result.filter(s => s.risk_level === filters.risk_level);
    }

    if (filters.min_rating) {
      result = result.filter(s => s.rating >= (filters.min_rating || 0));
    }

    if (filters.min_annual_return !== undefined) {
      result = result.filter(s => s.annual_return >= filters.min_annual_return!);
    }

    if (filters.max_drawdown !== undefined) {
      result = result.filter(s => Math.abs(s.max_drawdown) <= filters.max_drawdown!);
    }

    if (filters.tags && filters.tags.length > 0) {
      result = result.filter(s => filters.tags!.some(t => s.tags.includes(t)));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (filters.sort_by) {
        case 'rating': cmp = b.rating - a.rating; break;
        case 'annual_return': cmp = b.annual_return - a.annual_return; break;
        case 'subscribers': cmp = b.subscribers - a.subscribers; break;
        case 'recent': cmp = new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(); break;
      }
      return filters.sort_order === 'asc' ? -cmp : cmp;
    });

    return result;
  }, [strategies, searchQuery, filters]);

  // All unique tags from strategies
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    strategies.forEach(s => s.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort();
  }, [strategies]);

  const isSubscribed = (strategyId: string) => {
    return subscribedStrategies.some(s => s.strategy_id === strategyId);
  };

  const handleSubscribe = async (strategy: StrategyMarketItem) => {
    if (isSubscribed(strategy.id)) {
      // Unsubscribe
      const sub = subscribedStrategies.find(s => s.strategy_id === strategy.id);
      if (sub) {
        removeSubscribedStrategy(sub.id);
        showNotification('info', `已取消订阅「${strategy.name}」`);
        // Update subscriber count
        setStrategies(prev => prev.map(s =>
          s.id === strategy.id ? { ...s, subscribers: Math.max(0, s.subscribers - 1) } : s
        ));
      }
    } else {
      // Subscribe
      const newSub: SubscribedStrategy = {
        id: `sub_${Date.now()}`,
        strategy_id: strategy.id,
        name: strategy.name,
        category: strategy.category,
        subscribed_at: new Date().toISOString(),
        status: 'active',
        config_snapshot: strategy.config_snapshot,
      };
      addSubscribedStrategy(newSub);
      showNotification('success', `成功订阅「${strategy.name}」！`);
      // Update subscriber count
      setStrategies(prev => prev.map(s =>
        s.id === strategy.id ? { ...s, subscribers: s.subscribers + 1 } : s
      ));
    }
  };

  const getStrategyReviews = (strategyId: string) => {
    return MOCK_REVIEWS.filter(r => r.strategy_id === strategyId);
  };

  const featuredStrategies = strategies.filter(s => s.is_featured && s.status === 'active');
  const subscribedList = strategies.filter(s => isSubscribed(s.id));

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">策略市场</h1>
          <p className="text-text-muted text-sm mt-1">发现、订阅优质交易策略</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('browse'); setSelectedStrategy(null); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              activeTab === 'browse'
                ? 'bg-accent-primary text-bg-primary'
                : 'bg-bg-secondary border border-border-color text-text-secondary hover:text-text-primary'
            )}
          >
            浏览策略
          </button>
          <button
            onClick={() => { setActiveTab('subscribed'); setSelectedStrategy(null); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === 'subscribed'
                ? 'bg-accent-primary text-bg-primary'
                : 'bg-bg-secondary border border-border-color text-text-secondary hover:text-text-primary'
            )}
          >
            我的订阅
            {subscribedStrategies.length > 0 && (
              <span className="bg-accent-secondary text-bg-primary text-xs px-1.5 py-0.5 rounded-full">
                {subscribedStrategies.length}
              </span>
            )}
          </button>
          <button
            onClick={() => { setActiveTab('signals'); setSelectedStrategy(null); }}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
              activeTab === 'signals'
                ? 'bg-accent-primary text-bg-primary'
                : 'bg-bg-secondary border border-border-color text-text-secondary hover:text-text-primary'
            )}
          >
            信号
            {strategySignals.length > 0 && (
              <span className="bg-accent-secondary text-bg-primary text-xs px-1.5 py-0.5 rounded-full">
                {strategySignals.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">策略总数</div>
          <div className="text-2xl font-bold text-text-primary">{strategies.filter(s => s.status === 'active').length}</div>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">订阅用户</div>
          <div className="text-2xl font-bold text-text-primary">
            {strategies.reduce((sum, s) => sum + s.subscribers, 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">平均评分</div>
          <div className="text-2xl font-bold text-text-primary flex items-center gap-1">
            {(strategies.reduce((sum, s) => sum + s.rating, 0) / strategies.length).toFixed(1)}
            <Star size={14} className="text-amber-400" fill="currentColor" />
          </div>
        </div>
        <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
          <div className="text-text-muted text-xs uppercase tracking-wider mb-1">我的订阅</div>
          <div className="text-2xl font-bold text-accent-primary">{subscribedStrategies.length}</div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-bg-secondary rounded-xl border border-border-color p-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              placeholder="搜索策略名称、描述、标签或作者..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors',
              showFilters
                ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'
            )}
          >
            <Filter size={14} />
            筛选
            {(filters.category || filters.risk_level || filters.min_rating) && (
              <span className="w-2 h-2 rounded-full bg-accent-primary" />
            )}
          </button>
          <select
            value={`${filters.sort_by}-${filters.sort_order}`}
            onChange={e => {
              const [sort_by, sort_order] = e.target.value.split('-') as [StrategyMarketFilters['sort_by'], StrategyMarketFilters['sort_order']];
              setFilters(prev => ({ ...prev, sort_by, sort_order }));
            }}
            className="px-3 py-2 bg-bg-tertiary border border-border-color rounded-lg text-sm text-text-primary focus:outline-none focus:border-accent-primary/50"
          >
            <option value="rating-desc">评分最高</option>
            <option value="annual_return-desc">收益最高</option>
            <option value="subscribers-desc">最热门</option>
            <option value="recent-desc">最近更新</option>
          </select>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border-color space-y-4">
            <div className="flex flex-wrap gap-4">
              {/* Category */}
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">类别</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                    const Icon = cfg.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setFilters(prev => ({
                          ...prev,
                          category: prev.category === key ? undefined : key as StrategyCategory,
                        }))}
                        className={clsx(
                          'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                          filters.category === key
                            ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                            : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'
                        )}
                      >
                        <Icon size={12} className={filters.category === key ? cfg.color : ''} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Risk Level */}
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">风险</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(RISK_CONFIG).map(([key, cfg]) => (
                    <button
                      key={key}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        risk_level: prev.risk_level === key ? undefined : key as StrategyRiskLevel,
                      }))}
                      className={clsx(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                        filters.risk_level === key
                          ? `${cfg.bg} border-current ${cfg.color}`
                          : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {cfg.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Min Rating */}
              <div>
                <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">最低评分</label>
                <div className="flex gap-1">
                  {[0, 4, 4.5, 4.8].map(r => (
                    <button
                      key={r}
                      onClick={() => setFilters(prev => ({ ...prev, min_rating: prev.min_rating === r ? undefined : r }))}
                      className={clsx(
                        'px-2 py-1 rounded text-xs font-medium border transition-colors',
                        filters.min_rating === r
                          ? 'bg-amber-400/10 border-amber-400 text-amber-400'
                          : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'
                      )}
                    >
                      {r === 0 ? '不限' : `${r}+`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Tags */}
            <div>
              <label className="text-text-muted text-xs uppercase tracking-wider mb-2 block">标签</label>
              <div className="flex flex-wrap gap-2">
                {allTags.slice(0, 12).map(tag => (
                  <button
                    key={tag}
                    onClick={() => setFilters(prev => {
                      const tags = prev.tags || [];
                      const newTags = tags.includes(tag)
                        ? tags.filter(t => t !== tag)
                        : [...tags, tag];
                      return { ...prev, tags: newTags.length > 0 ? newTags : undefined };
                    })}
                    className={clsx(
                      'px-2 py-1 rounded text-xs border transition-colors',
                      filters.tags?.includes(tag)
                        ? 'bg-accent-primary/10 border-accent-primary text-accent-primary'
                        : 'bg-bg-tertiary border-border-color text-text-secondary hover:text-text-primary'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Reset */}
            {(filters.category || filters.risk_level || filters.min_rating || filters.tags?.length) && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, category: undefined, risk_level: undefined, min_rating: undefined, tags: undefined }))}
                className="text-xs text-accent-primary hover:underline"
              >
                重置筛选
              </button>
            )}
          </div>
        )}
      </div>

      {/* Featured Banner */}
      {activeTab === 'browse' && !searchQuery && !filters.category && (
        <div className="grid grid-cols-2 gap-4">
          {featuredStrategies.slice(0, 2).map(strategy => (
            <div
              key={strategy.id}
              className="relative bg-gradient-to-br from-accent-primary/20 via-bg-secondary to-bg-secondary rounded-xl border border-accent-primary/30 p-5 overflow-hidden cursor-pointer hover:border-accent-primary/50 transition-colors"
              onClick={() => setSelectedStrategy(strategy)}
            >
              <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-amber-400/20 rounded-full text-xs text-amber-400 font-medium">
                <Crown size={10} />
                精选
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-text-primary">{strategy.name}</h3>
                    {strategy.is_premium && (
                      <span className="px-1.5 py-0.5 bg-amber-400/20 rounded text-xs text-amber-400 font-medium">
                        Premium
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary text-sm mb-3 line-clamp-2">{strategy.description}</p>
                  <div className="flex items-center gap-3 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <div className="w-5 h-5 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary text-[10px] font-bold">
                        {strategy.author.name[0]}
                      </div>
                      {strategy.author.name}
                      {strategy.author.verified && <Check size={10} className="text-blue-400" />}
                    </span>
                    <span className="flex items-center gap-1">
                      <Star size={10} className="text-amber-400" fill="currentColor" />
                      {strategy.rating.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users size={10} />
                      {strategy.subscribers.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-emerald-400 font-mono font-bold text-lg">
                    +{strategy.annual_return.toFixed(1)}%
                  </div>
                  <div className="text-text-muted text-xs">年化收益</div>
                  <div className={clsx(
                    'inline-flex px-2 py-0.5 rounded text-xs font-medium mt-1',
                    RISK_CONFIG[strategy.risk_level].bg,
                    RISK_CONFIG[strategy.risk_level].color
                  )}>
                    {RISK_CONFIG[strategy.risk_level].label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Strategy Grid */}
      {activeTab === 'browse' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredStrategies.length === 0 ? (
            <div className="col-span-full text-center py-12 text-text-muted">
              <Search size={40} className="mx-auto mb-3 opacity-30" />
              <p>未找到符合条件的策略</p>
            </div>
          ) : (
            filteredStrategies.map(strategy => (
              <StrategyCard
                key={strategy.id}
                strategy={strategy}
                isSubscribed={isSubscribed(strategy.id)}
                onSubscribe={() => handleSubscribe(strategy)}
                onClick={() => setSelectedStrategy(strategy)}
              />
            ))
          )}
        </div>
      )}

      {/* Subscribed Tab */}
      {activeTab === 'subscribed' && (
        <div className="space-y-4">
          {subscribedList.length === 0 ? (
            <div className="text-center py-12 text-text-muted bg-bg-secondary rounded-xl border border-border-color">
              <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无订阅的策略</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="mt-3 text-accent-primary hover:underline text-sm"
              >
                去浏览策略
              </button>
            </div>
          ) : (
            subscribedList.map(strategy => (
              <div
                key={strategy.id}
                className="bg-bg-secondary rounded-xl border border-border-color p-5 hover:border-accent-primary/30 transition-colors cursor-pointer"
                onClick={() => setSelectedStrategy(strategy)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                      {(() => {
                        const Icon = CATEGORY_CONFIG[strategy.category].icon;
                        return <Icon size={24} className={CATEGORY_CONFIG[strategy.category].color} />;
                      })()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-text-primary">{strategy.name}</h3>
                        <span className={clsx(
                          'px-1.5 py-0.5 rounded text-xs',
                          RISK_CONFIG[strategy.risk_level].bg,
                          RISK_CONFIG[strategy.risk_level].color
                        )}>
                          {RISK_CONFIG[strategy.risk_level].label}
                        </span>
                      </div>
                      <p className="text-text-muted text-sm mt-1">
                        {CATEGORY_CONFIG[strategy.category].label} · 订阅于{new Date(subscribedStrategies.find(s => s.strategy_id === strategy.id)?.subscribed_at || '').toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <div className="text-emerald-400 font-mono font-bold">+{strategy.annual_return.toFixed(1)}%</div>
                      <div className="text-text-muted text-xs">年化收益</div>
                    </div>
                    <div className="text-center">
                      <div className="text-rose-400 font-mono font-bold">{strategy.max_drawdown.toFixed(1)}%</div>
                      <div className="text-text-muted text-xs">最大回撤</div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubscribe(strategy);
                      }}
                      className="px-3 py-1.5 bg-rose-400/10 text-rose-400 rounded-lg text-sm hover:bg-rose-400/20 transition-colors"
                    >
                      取消订阅
                    </button>
                    <ChevronRight size={16} className="text-text-muted" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Signals Tab */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          {strategySignals.length === 0 ? (
            <div className="text-center py-12 text-text-muted bg-bg-secondary rounded-xl border border-border-color">
              <Zap size={40} className="mx-auto mb-3 opacity-30" />
              <p>暂无策略信号</p>
              <button
                onClick={() => setActiveTab('browse')}
                className="mt-3 text-accent-primary hover:underline text-sm"
              >
                去浏览策略
              </button>
            </div>
          ) : (
            strategySignals.map(signal => {
              const actionColor = signal.action === 'buy' ? 'text-emerald-400' : signal.action === 'sell' ? 'text-rose-400' : 'text-amber-400';
              const actionBg = signal.action === 'buy' ? 'bg-emerald-400/10' : signal.action === 'sell' ? 'bg-rose-400/10' : 'bg-amber-400/10';
              const actionLabel = signal.action === 'buy' ? '买入' : signal.action === 'sell' ? '卖出' : '观望';
              return (
                <div key={signal.id} className={clsx('rounded-xl border p-5', signal.expired ? 'border-border-color opacity-60' : 'border-border-color hover:border-accent-primary/30 transition-colors')}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={clsx('w-12 h-12 rounded-xl flex items-center justify-center', actionBg)}>
                        <Zap size={24} className={actionColor} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-text-primary">{signal.symbol} - {signal.name}</h3>
                          <span className={clsx('px-1.5 py-0.5 rounded text-xs font-medium', actionBg, actionColor)}>
                            {actionLabel}
                          </span>
                          {signal.expired && (
                            <span className="px-1.5 py-0.5 bg-bg-tertiary rounded text-xs text-text-muted">
                              已过期
                            </span>
                          )}
                          {signal.executed && (
                            <span className="px-1.5 py-0.5 bg-emerald-400/10 text-emerald-400 rounded text-xs">
                              已执行
                            </span>
                          )}
                        </div>
                        <p className="text-text-muted text-sm mt-1">
                          来自 {signal.strategy_name} · {new Date(signal.generated_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-center">
                        <div style={{fontFamily:'monospace',fontWeight:700}} className={actionColor}>{signal.action === 'sell' ? '-' : '+'}{((signal.target_price && signal.price) ? (((signal.target_price - signal.price) / signal.price * 100)).toFixed(1) : signal.confidence.toFixed(0))}%</div>
                        <div className="text-text-muted text-xs">置信度/预期</div>
                      </div>
                      <div className="text-center">
                        <div className="font-mono font-bold text-text-primary">¥{signal.price.toFixed(2)}</div>
                        <div className="text-text-muted text-xs">价格</div>
                      </div>
                      {signal.target_price && (
                        <div className="text-center">
                          <div className="font-mono font-bold text-text-primary">¥{signal.target_price.toFixed(2)}</div>
                          <div className="text-text-muted text-xs">目标价</div>
                        </div>
                      )}
                      {signal.stop_loss && (
                        <div className="text-center">
                          <div className="font-mono font-bold text-rose-400">¥{signal.stop_loss.toFixed(2)}</div>
                          <div className="text-text-muted text-xs">止损价</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {signal.trigger_conditions.map((c, i) => (
                      <span key={i} className="px-2 py-0.5 bg-bg-tertiary rounded text-xs text-text-secondary">
                        {c}
                      </span>
                    ))}
                  </div>
                  {signal.reason && (
                    <p className="mt-2 text-sm text-text-secondary">{signal.reason}</p>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Strategy Detail Modal */}
      {selectedStrategy && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedStrategy(null)}
        >
          <div
            className="bg-bg-secondary rounded-2xl border border-border-color w-full max-w-3xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="sticky top-0 bg-bg-secondary border-b border-border-color p-5 flex items-start justify-between z-10">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-xl font-bold text-text-primary">{selectedStrategy.name}</h2>
                  {selectedStrategy.is_premium && (
                    <span className="px-2 py-0.5 bg-amber-400/20 rounded text-xs text-amber-400 font-medium flex items-center gap-1">
                      <Crown size={10} /> Premium
                    </span>
                  )}
                  <span className={clsx(
                    'px-2 py-0.5 rounded text-xs font-medium',
                    RISK_CONFIG[selectedStrategy.risk_level].bg,
                    RISK_CONFIG[selectedStrategy.risk_level].color
                  )}>
                    {RISK_CONFIG[selectedStrategy.risk_level].label}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm text-text-muted">
                  <span className="flex items-center gap-1">
                    <div className="w-5 h-5 rounded-full bg-accent-primary/20 flex items-center justify-center text-accent-primary text-[10px] font-bold">
                      {selectedStrategy.author.name[0]}
                    </div>
                    {selectedStrategy.author.name}
                    {selectedStrategy.author.verified && <Check size={12} className="text-blue-400" />}
                  </span>
                  <span>v{selectedStrategy.version}</span>
                  <span>更新于{new Date(selectedStrategy.updated_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => setSelectedStrategy(null)}
                className="text-text-muted hover:text-text-primary transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 space-y-6">
              {/* Description */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">策略简介</h3>
                <p className="text-text-secondary text-sm leading-relaxed">{selectedStrategy.description}</p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {selectedStrategy.tags.map(tag => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-bg-tertiary border border-border-color rounded text-xs text-text-secondary"
                  >
                    {tag}
                  </span>
                ))}
                <span className={clsx(
                  'px-2 py-1 rounded text-xs font-medium',
                  CATEGORY_CONFIG[selectedStrategy.category].color,
                  'bg-current/10 border border-current/20'
                )}>
                  {CATEGORY_CONFIG[selectedStrategy.category].label}
                </span>
              </div>

              {/* Performance Metrics */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">业绩表现</h3>
                <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                  <MetricCard label="总收益" value={`+${selectedStrategy.total_return.toFixed(1)}%`} positive />
                  <MetricCard label="年化收益" value={`+${selectedStrategy.annual_return.toFixed(1)}%`} positive />
                  <MetricCard label="夏普比率" value={selectedStrategy.sharpe_ratio.toFixed(2)} />
                  <MetricCard label="最大回撤" value={`${selectedStrategy.max_drawdown.toFixed(1)}%`} danger />
                  <MetricCard label="胜率" value={`${selectedStrategy.win_rate.toFixed(1)}%`} />
                  <MetricCard label="交易次数" value={selectedStrategy.total_trades.toString()} />
                </div>
              </div>

              {/* Risk Metrics */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">风险指标</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="text-text-muted text-xs mb-1">风险等级</div>
                    <div className={clsx('font-medium', RISK_CONFIG[selectedStrategy.risk_level].color)}>
                      {RISK_CONFIG[selectedStrategy.risk_level].label}
                    </div>
                  </div>
                  <div className="bg-bg-tertiary rounded-lg p-3">
                    <div className="text-text-muted text-xs mb-1">波动率</div>
                    <div className="font-medium text-text-primary">{selectedStrategy.volatility.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Backtest Period */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">回测区间</h3>
                <div className="bg-bg-tertiary rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-text-secondary text-sm">
                    <Calendar size={14} />
                    {selectedStrategy.backtest_start_date} ~ {selectedStrategy.backtest_end_date}
                  </div>
                  <div className="text-text-muted text-sm">
                    初始资金: ¥{selectedStrategy.initial_cash.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Strategy Config */}
              {selectedStrategy.config_snapshot && (
                <div>
                  <h3 className="text-sm font-semibold text-text-primary mb-3">策略配置</h3>
                  <div className="bg-bg-tertiary rounded-lg p-4 space-y-3">
                    <div>
                      <div className="text-text-muted text-xs mb-1">入场条件</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedStrategy.config_snapshot.entry_conditions.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-emerald-400/10 text-emerald-400 rounded text-xs">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="text-text-muted text-xs mb-1">出场条件</div>
                      <div className="flex flex-wrap gap-1">
                        {selectedStrategy.config_snapshot.exit_conditions.map((c, i) => (
                          <span key={i} className="px-2 py-0.5 bg-rose-400/10 text-rose-400 rounded text-xs">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border-color">
                      <div>
                        <div className="text-text-muted text-xs">仓位</div>
                        <div className="font-mono text-text-primary">{(selectedStrategy.config_snapshot.position_size * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <div className="text-text-muted text-xs">止损</div>
                        <div className="font-mono text-rose-400">-{(selectedStrategy.config_snapshot.stop_loss * 100).toFixed(0)}%</div>
                      </div>
                      <div>
                        <div className="text-text-muted text-xs">止盈</div>
                        <div className="font-mono text-emerald-400">+{(selectedStrategy.config_snapshot.take_profit * 100).toFixed(0)}%</div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Social Proof */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-amber-400 font-bold">
                    <Star size={14} fill="currentColor" /> {selectedStrategy.rating.toFixed(1)}
                  </div>
                  <div className="text-text-muted text-xs mt-1">{selectedStrategy.review_count}条评价</div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-accent-primary font-bold">
                    <Users size={14} /> {selectedStrategy.subscribers.toLocaleString()}
                  </div>
                  <div className="text-text-muted text-xs mt-1">订阅用户</div>
                </div>
                <div className="bg-bg-tertiary rounded-lg p-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-text-primary font-bold">
                    <BarChart3 size={14} /> {selectedStrategy.total_trades}
                  </div>
                  <div className="text-text-muted text-xs mt-1">历史交易</div>
                </div>
              </div>

              {/* Reviews */}
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-3">用户评价</h3>
                <div className="space-y-3">
                  {getStrategyReviews(selectedStrategy.id).slice(0, 2).map(review => (
                    <div key={review.id} className="bg-bg-tertiary rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-accent-secondary/20 flex items-center justify-center text-accent-secondary text-xs font-bold">
                            {review.user_name[0]}
                          </div>
                          <span className="text-sm font-medium text-text-primary">{review.user_name}</span>
                          <div className="flex items-center gap-0.5">
                            {Array.from({ length: review.rating }).map((_, i) => (
                              <Star key={i} size={10} className="text-amber-400" fill="currentColor" />
                            ))}
                          </div>
                        </div>
                        <span className="text-text-muted text-xs">{new Date(review.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-text-secondary text-sm">{review.content}</p>
                      {review.pros.length > 0 && (
                        <div className="flex items-center gap-1 mt-2">
                          <ThumbsUp size={10} className="text-emerald-400" />
                          <span className="text-xs text-emerald-400">{review.pros.join('、')}</span>
                        </div>
                      )}
                    </div>
                  ))}
                  {getStrategyReviews(selectedStrategy.id).length === 0 && (
                    <p className="text-text-muted text-sm text-center py-4">暂无评价</p>
                  )}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="sticky bottom-0 bg-bg-secondary border-t border-border-color p-5 flex items-center justify-between">
              <div className="text-text-muted text-sm">
                {isSubscribed(selectedStrategy.id) ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check size={14} /> 已订阅此策略
                  </span>
                ) : (
                  <span>订阅后可使用此策略进行回测</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setSelectedStrategy(null)}
                  className="px-4 py-2 bg-bg-tertiary border border-border-color text-text-secondary rounded-lg text-sm font-medium hover:text-text-primary transition-colors"
                >
                  关闭
                </button>
                <button
                  onClick={() => handleSubscribe(selectedStrategy)}
                  className={clsx(
                    'px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    isSubscribed(selectedStrategy.id)
                      ? 'bg-rose-400/10 text-rose-400 border border-rose-400/30 hover:bg-rose-400/20'
                      : 'bg-accent-primary text-bg-primary hover:bg-accent-primary/90 shadow-[0_0_15px_rgba(0,212,255,0.3)]'
                  )}
                >
                  {isSubscribed(selectedStrategy.id) ? (
                    <>
                      <X size={14} /> 取消订阅
                    </>
                  ) : (
                    <>
                      <Check size={14} /> 立即订阅
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ Sub-Components ============

function StrategyCard({
  strategy,
  isSubscribed,
  onSubscribe,
  onClick,
}: {
  strategy: StrategyMarketItem;
  isSubscribed: boolean;
  onSubscribe: () => void;
  onClick: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const catConfig = CATEGORY_CONFIG[strategy.category];
  const Icon = catConfig.icon;

  return (
    <div className="bg-bg-secondary rounded-xl border border-border-color overflow-hidden hover:border-accent-primary/30 transition-all group">
      {/* Card Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={clsx('w-10 h-10 rounded-lg flex items-center justify-center', `${catConfig.color.replace('text-', 'bg-')}/10`)}>
              <Icon size={20} className={catConfig.color} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-text-primary">{strategy.name}</h3>
                {strategy.is_premium && (
                  <Crown size={12} className="text-amber-400" fill="currentColor" />
                )}
                {strategy.is_featured && (
                  <span className="px-1.5 py-0.5 bg-amber-400/20 rounded text-[10px] text-amber-400 font-medium">
                    精选
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                <span>{catConfig.label}</span>
                <span>·</span>
                <span className="flex items-center gap-1">
                  {strategy.author.name}
                  {strategy.author.verified && <Check size={10} className="text-blue-400" />}
                </span>
              </div>
            </div>
          </div>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
              className="p-1 text-text-muted hover:text-text-primary transition-colors"
            >
              <ChevronDown size={16} />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 bg-bg-tertiary border border-border-color rounded-lg shadow-xl z-10 min-w-[120px] py-1">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-text-secondary hover:bg-bg-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                >
                  <BookOpen size={12} /> 查看详情
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMenu(false); onSubscribe(); }}
                  className={clsx(
                    'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
                    isSubscribed
                      ? 'text-rose-400 hover:bg-rose-400/10'
                      : 'text-emerald-400 hover:bg-emerald-400/10'
                  )}
                >
                  {isSubscribed ? <X size={12} /> : <Check size={12} />}
                  {isSubscribed ? '取消订阅' : '立即订阅'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-text-secondary text-sm line-clamp-2 mb-3">{strategy.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-4">
          {strategy.tags.slice(0, 3).map(tag => (
            <span key={tag} className="px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px] text-text-muted">
              {tag}
            </span>
          ))}
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div>
            <div className="text-text-muted text-[10px] uppercase tracking-wider">年化</div>
            <div className={clsx('font-mono font-bold text-sm', strategy.annual_return >= 0 ? 'text-emerald-400' : 'text-rose-400')}>
              +{strategy.annual_return.toFixed(1)}%
            </div>
          </div>
          <div>
            <div className="text-text-muted text-[10px] uppercase tracking-wider">夏普</div>
            <div className="font-mono font-bold text-sm text-text-primary">{strategy.sharpe_ratio.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-text-muted text-[10px] uppercase tracking-wider">回撤</div>
            <div className="font-mono font-bold text-sm text-rose-400">{strategy.max_drawdown.toFixed(1)}%</div>
          </div>
          <div>
            <div className="text-text-muted text-[10px] uppercase tracking-wider">胜率</div>
            <div className="font-mono font-bold text-sm text-text-primary">{strategy.win_rate.toFixed(0)}%</div>
          </div>
        </div>

        {/* Risk & Rating */}
        <div className="flex items-center justify-between">
          <span className={clsx(
            'px-2 py-0.5 rounded text-xs font-medium',
            RISK_CONFIG[strategy.risk_level].bg,
            RISK_CONFIG[strategy.risk_level].color
          )}>
            {RISK_CONFIG[strategy.risk_level].label}
          </span>
          <div className="flex items-center gap-3 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <Star size={10} className="text-amber-400" fill="currentColor" />
              {strategy.rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={10} />
              {strategy.subscribers >= 1000
                ? `${(strategy.subscribers / 1000).toFixed(1)}k`
                : strategy.subscribers}
            </span>
          </div>
        </div>
      </div>

      {/* Card Footer */}
      <div className="px-5 py-3 bg-bg-tertiary/50 border-t border-border-color/50 flex items-center justify-between">
        <div className="text-text-muted text-xs">
          更新于 {new Date(strategy.updated_at).toLocaleDateString()}
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="text-accent-primary text-xs font-medium hover:underline flex items-center gap-1"
        >
          查看详情
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

function MetricCard({ label, value, positive, danger }: {
  label: string;
  value: string;
  positive?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-bg-tertiary rounded-lg p-3 text-center">
      <div className={clsx(
        'font-mono font-bold',
        danger ? 'text-rose-400' : positive ? 'text-emerald-400' : 'text-text-primary'
      )}>
        {value}
      </div>
      <div className="text-text-muted text-[10px] uppercase tracking-wider mt-1">{label}</div>
    </div>
  );
}
