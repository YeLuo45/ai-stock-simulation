/**
 * Portfolio Analytics — 实时组合分析、归因分析、风险分析
 */

export interface PortfolioMetrics {
  totalValue: number
  dailyReturn: number
  totalReturn: number
  sharpeRatio: number
  maxDrawdown: number
  winRate: number
  profitFactor: number
  avgWin: number
  avgLoss: number
}

export interface Position {
  ticker: string
  shares: number
  avgCost: number
  currentPrice: number
  marketValue: number
  unrealizedPnL: number
  unrealizedPnLPercent: number
  weight: number
}

export interface AttributionResult {
  ticker: string
  contribution: number
  contributionPercent: number
}

export interface ComparisonResult {
  portfolioReturn: number
  benchmarkReturn: number
  alpha: number
  beta: number
  trackingError: number
  informationRatio: number
}

export class PortfolioAnalytics {
  private positions: Position[] = []
  private historicalValues: number[] = []

  setPositions(positions: Position[]): void {
    this.positions = positions
  }

  addHistoricalValue(value: number): void {
    this.historicalValues.push(value)
  }

  calculateMetrics(): PortfolioMetrics {
    const totalValue = this.positions.reduce((sum, p) => sum + p.marketValue, 0)
    const dailyReturn = this.calculateDailyReturn()
    const totalReturn = this.calculateTotalReturn()
    const sharpeRatio = this.calculateSharpeRatio()
    const maxDrawdown = this.calculateMaxDrawdown()
    const winRate = this.calculateWinRate()
    const { profitFactor, avgWin, avgLoss } = this.calculateProfitStats()

    return {
      totalValue,
      dailyReturn,
      totalReturn,
      sharpeRatio,
      maxDrawdown,
      winRate,
      profitFactor,
      avgWin,
      avgLoss,
    }
  }

  attributeReturns(): AttributionResult[] {
    const totalValue = this.positions.reduce((sum, p) => sum + p.marketValue, 0)
    if (totalValue === 0) return []

    return this.positions.map(p => ({
      ticker: p.ticker,
      contribution: p.unrealizedPnL,
      contributionPercent: (p.unrealizedPnL / totalValue) * 100,
    })).sort((a, b) => b.contribution - a.contribution)
  }

  compareWithBenchmark(benchmarkReturns: number[]): ComparisonResult {
    const portfolioReturn = this.calculateTotalReturn()

    if (this.historicalValues.length < 2 || benchmarkReturns.length === 0) {
      return {
        portfolioReturn,
        benchmarkReturn: 0,
        alpha: 0,
        beta: 1,
        trackingError: 0,
        informationRatio: 0,
      }
    }

    const benchmarkReturn = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length

    // Calculate beta
    const portfolioChanges = this.historicalValues.slice(1).map((v, i) =>
      (v - this.historicalValues[i]) / this.historicalValues[i]
    )

    const avgPortfolioChange = portfolioChanges.reduce((a, b) => a + b, 0) / portfolioChanges.length
    const avgBenchmarkChange = benchmarkReturns.reduce((a, b) => a + b, 0) / benchmarkReturns.length

    let covariance = 0
    let benchmarkVariance = 0
    const n = Math.min(portfolioChanges.length, benchmarkReturns.length)

    for (let i = 0; i < n; i++) {
      const pDiff = portfolioChanges[i] - avgPortfolioChange
      const bDiff = benchmarkReturns[i] - avgBenchmarkChange
      covariance += pDiff * bDiff
      benchmarkVariance += bDiff * bDiff
    }

    const beta = benchmarkVariance !== 0 ? covariance / benchmarkVariance : 1
    const alpha = portfolioReturn - beta * benchmarkReturn

    // Tracking error
    let trackingErrorSum = 0
    for (let i = 0; i < n; i++) {
      const diff = portfolioChanges[i] - benchmarkReturns[i]
      trackingErrorSum += diff * diff
    }
    const trackingError = Math.sqrt(trackingErrorSum / n)

    const informationRatio = trackingError !== 0 ? alpha / trackingError : 0

    return {
      portfolioReturn,
      benchmarkReturn,
      alpha,
      beta,
      trackingError,
      informationRatio,
    }
  }

  private calculateDailyReturn(): number {
    if (this.historicalValues.length < 2) return 0
    const last = this.historicalValues[this.historicalValues.length - 1]
    const prev = this.historicalValues[this.historicalValues.length - 2]
    return prev !== 0 ? ((last - prev) / prev) * 100 : 0
  }

  private calculateTotalReturn(): number {
    if (this.historicalValues.length < 2) return 0
    const first = this.historicalValues[0]
    const last = this.historicalValues[this.historicalValues.length - 1]
    return first !== 0 ? ((last - first) / first) * 100 : 0
  }

  private calculateSharpeRatio(): number {
    if (this.historicalValues.length < 2) return 0
    const returns = this.historicalValues.slice(1).map((v, i) =>
      (v - this.historicalValues[i]) / this.historicalValues[i]
    )
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length
    const stdDev = this.standardDeviation(returns)
    return stdDev !== 0 ? (avgReturn / stdDev) * Math.sqrt(252) : 0 // Annualized
  }

  private calculateMaxDrawdown(): number {
    if (this.historicalValues.length < 2) return 0
    let maxDrawdown = 0
    let peak = this.historicalValues[0]

    for (const value of this.historicalValues) {
      if (value > peak) peak = value
      const drawdown = ((peak - value) / peak) * 100
      if (drawdown > maxDrawdown) maxDrawdown = drawdown
    }

    return maxDrawdown
  }

  private calculateWinRate(): number {
    if (this.historicalValues.length < 2) return 0
    const returns = this.historicalValues.slice(1).map((v, i) =>
      v - this.historicalValues[i]
    )
    const wins = returns.filter(r => r > 0).length
    return returns.length > 0 ? (wins / returns.length) * 100 : 0
  }

  private calculateProfitStats(): { profitFactor: number; avgWin: number; avgLoss: number } {
    if (this.positions.length === 0) {
      return { profitFactor: 0, avgWin: 0, avgLoss: 0 }
    }

    const wins = this.positions.filter(p => p.unrealizedPnL > 0)
    const losses = this.positions.filter(p => p.unrealizedPnL < 0)

    const totalWin = wins.reduce((sum, p) => sum + p.unrealizedPnL, 0)
    const totalLoss = Math.abs(losses.reduce((sum, p) => sum + p.unrealizedPnL, 0))

    const avgWin = wins.length > 0 ? totalWin / wins.length : 0
    const avgLoss = losses.length > 0 ? totalLoss / losses.length : 0
    const profitFactor = totalLoss !== 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0

    return { profitFactor, avgWin, avgLoss }
  }

  private standardDeviation(values: number[]): number {
    if (values.length === 0) return 0
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const squareDiffs = values.map(v => (v - avg) ** 2)
    return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / values.length)
  }
}

export const portfolioAnalytics = new PortfolioAnalytics()