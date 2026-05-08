import { useEffect } from 'react'
import { useStore } from './store'
import NavHeader from './components/NavHeader'
import HomePage from './pages/HomePage'
import SelectionPage from './pages/SelectionPage'
import BacktestPage from './pages/BacktestPage'
import TradingPage from './pages/TradingPage'
import AnalysisPage from './pages/AnalysisPage'
import SettingsPage from './pages/SettingsPage'
import IPOEvaluationPage from './pages/IPOEvaluationPage'
import StockPoolPage from './pages/StockPoolPage'
import OptimizePage from './pages/OptimizePage'
import StrategyBuilderPage from './pages/StrategyBuilderPage'
import MarketPage from './pages/MarketPage'
import CapitalFlowPage from './pages/CapitalFlowPage'
import ContestPage from './pages/ContestPage'
import PortfolioOptimizerPage from './pages/PortfolioOptimizerPage'
import Notification from './components/Notification'
import { getPortfolio } from './services/api'

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
      default:
        return <HomePage />
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary grid-pattern">
      <NavHeader />
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        {renderPage()}
      </main>
      <Notification />
    </div>
  )
}

export default App
