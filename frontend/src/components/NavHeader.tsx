import { useStore } from '../store'
import { getPortfolio } from '../services/api'
import { useState, useEffect } from 'react'
import { TrendingUp, Bot, Wallet, Settings, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import type { Page } from '../types'

const NAV_ITEMS: { key: Page; label: string; icon: React.ReactNode }[] = [
  { key: 'home', label: '首页', icon: <TrendingUp size={18} /> },
  { key: 'selection', label: '智能选股', icon: <Bot size={18} /> },
  { key: 'trading', label: '交易', icon: <Wallet size={18} /> },
  { key: 'settings', label: '设置', icon: <Settings size={18} /> },
]

const MODELS = [
  { name: 'minimax', label: 'MiniMax' },
  { name: 'zhipu', label: '智谱 GLM' },
  { name: 'claude', label: 'Claude' },
  { name: 'gemini', label: 'Gemini' },
]

export default function NavHeader() {
  const { currentPage, setPage, portfolio, activeModel, setActiveModel, setPortfolio } = useStore()
  const [modelMenuOpen, setModelMenuOpen] = useState(false)

  useEffect(() => {
    // Refresh portfolio periodically
    const interval = setInterval(async () => {
      try {
        const data = await getPortfolio()
        setPortfolio(data)
      } catch (e) {
        // ignore
      }
    }, 30000)
    return () => clearInterval(interval)
  }, [setPortfolio])

  return (
    <header className="bg-bg-secondary border-b border-border-color sticky top-0 z-50">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-accent-primary to-accent-secondary flex items-center justify-center">
              <TrendingUp size={20} className="text-bg-primary" />
            </div>
            <span className="font-mono font-bold text-lg">AlphaTrader</span>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => setPage(item.key)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all',
                  currentPage === item.key
                    ? 'bg-accent-primary/10 text-accent-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-tertiary'
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right side: Balance + Model selector */}
          <div className="flex items-center gap-4">
            {/* Balance */}
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-text-muted">总资产</span>
              <span className="font-mono font-semibold text-accent-primary">
                ¥{portfolio?.total_assets?.toLocaleString() ?? '1,000,000'}
              </span>
            </div>

            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelMenuOpen(!modelMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-tertiary border border-border-color hover:border-accent-primary/50 transition-colors text-sm"
              >
                <Bot size={16} className="text-accent-secondary" />
                <span className="hidden sm:inline">{MODELS.find(m => m.name === activeModel)?.label ?? 'MiniMax'}</span>
                <ChevronDown size={14} className={clsx('transition-transform', modelMenuOpen && 'rotate-180')} />
              </button>

              {modelMenuOpen && (
                <div className="absolute right-0 mt-2 w-40 bg-bg-secondary border border-border-color rounded-lg shadow-xl py-1 z-50">
                  {MODELS.map((model) => (
                    <button
                      key={model.name}
                      onClick={() => {
                        setActiveModel(model.name)
                        setModelMenuOpen(false)
                      }}
                      className={clsx(
                        'w-full text-left px-4 py-2 text-sm hover:bg-bg-tertiary transition-colors',
                        activeModel === model.name ? 'text-accent-primary' : 'text-text-secondary'
                      )}
                    >
                      {model.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <nav className="md:hidden flex items-center gap-2 pb-3 overflow-x-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                currentPage === item.key
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:text-text-primary'
              )}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  )
}
