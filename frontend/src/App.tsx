import { useEffect, lazy, Suspense } from 'react'
import { useStore } from './store'
import NavHeader from './components/NavHeader'
import Notification from './components/Notification'
import { getPortfolio } from './services/api'

const HomePage = lazy(() => import('./pages/HomePage'))
const SelectionPage = lazy(() => import('./pages/SelectionPage'))
const BacktestPage = lazy(() => import('./pages/BacktestPage'))
const BacktestComparePage = lazy(() => import('./pages/BacktestComparePage'))
const TradingPage = lazy(() => import('./pages/TradingPage'))
const AnalysisPage = lazy(() => import('./pages/AnalysisPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const IPOEvaluationPage = lazy(() => import('./pages/IPOEvaluationPage'))
const StockPoolPage = lazy(() => import('./pages/StockPoolPage'))
const OptimizePage = lazy(() => import('./pages/OptimizePage'))
const StrategyBuilderPage = lazy(() => import('./pages/StrategyBuilderPage'))
const MarketPage = lazy(() => import('./pages/MarketPage'))
const CapitalFlowPage = lazy(() => import('./pages/CapitalFlowPage'))
const ContestPage = lazy(() => import('./pages/ContestPage'))
const PortfolioOptimizerPage = lazy(() => import('./pages/PortfolioOptimizerPage'))
const EvolutionPage = lazy(() => import('./pages/EvolutionPage'))
const MemoryReviewPage = lazy(() => import('./pages/MemoryReviewPage'))
const FactorEditorPage = lazy(() => import('./pages/FactorEditorPage'))
const StrategyMarketPage = lazy(() => import('./pages/StrategyMarketPage'))

function App() {
  const { currentPage, setPortfolio, setLoading, showNotification } = useStore()

  useEffect(() => {
    // Fetch initial portfolio data
    const fetchPortfolio = async () => {
      setLoading(true)
      try {
        const data = await getPortfolio()
        setPortfolio(data)
      } catch (err) {
        console.error('Failed to fetch portfolio:', err)
        showNotification('info', '请确保后端服务已启动 (python main.py)')
      } finally {
        setLoading(false)
      }
    }
    fetchPortfolio()
  }, [setPortfolio, setLoading, showNotification])

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage />
      case 'selection':
        return <SelectionPage />
      case 'backtest':
        return <BacktestPage />
      case 'backtest_compare':
        return <BacktestComparePage />
      case 'optimize':
        return <OptimizePage />
      case 'trading':
        return <TradingPage />
      case 'analysis':
        return <AnalysisPage />
      case 'stockpool':
        return <StockPoolPage />
      case 'settings':
        return <SettingsPage />
      case 'ipo':
        return <IPOEvaluationPage />
      case 'strategybuilder':
        return <StrategyBuilderPage />
      case 'market':
        return <MarketPage />
      case 'capitalflow':
        return <CapitalFlowPage />
      case 'contest':
        return <ContestPage />
      case 'portfolio_optimizer':
        return <PortfolioOptimizerPage />
      case 'evolution':
        return <EvolutionPage />
      case 'factor_editor':
        return <FactorEditorPage />
      case 'strategy_market':
        return <StrategyMarketPage />
      case 'memory':
        return <MemoryReviewPage />
      default:
        return <HomePage />
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary grid-pattern">
      <NavHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-text-muted">加载中...</div></div>}>
          {renderPage()}
        </Suspense>
      </main>
      <Notification />
    </div>
  )
}

export default App
