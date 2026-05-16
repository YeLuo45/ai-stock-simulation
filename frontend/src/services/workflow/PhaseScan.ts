/**
 * PhaseScan - Scan Phase Implementation
 * Pulls full market data and filters out ST/suspended/delisted stocks
 */
import { mockStocks } from '../mockData';
import type { WorkflowContext, WorkflowCandidate, PhaseResult, ScanConfig, ScanFilters } from './types';

export const PhaseScan = {
  /**
   * Run the Scan phase
   * Pulls market data, filters ST/suspended/delisted, returns candidates
   */
  async run(context: WorkflowContext, config: ScanConfig): Promise<PhaseResult> {
    try {
      // Get symbols to scan - either from context or full market
      const symbolsToScan = context.symbols?.length 
        ? context.symbols 
        : mockStocks.map(s => s.symbol);

      const candidates: WorkflowCandidate[] = [];
      let filteredOut = 0;

      // Simulate scanning each stock
      for (const symbol of symbolsToScan) {
        // Find stock data (mock - in real impl would fetch from data source)
        const stockData = mockStocks.find(s => s.symbol === symbol) || {
          symbol,
          name: `股票${symbol}`,
          price: Math.random() * 100 + 10,
          change_pct: (Math.random() - 0.5) * 10,
          volume: Math.random() * 100000000,
          pe: Math.random() * 50,
          pb: Math.random() * 5,
          roe: Math.random() * 30,
          market_cap: Math.random() * 1000000000000,
        };

        // Apply filters
        if (this.shouldFilter(stockData, config.filters)) {
          filteredOut++;
          continue;
        }

        candidates.push({
          symbol: stockData.symbol,
          name: stockData.name || stockData.symbol,
          price: stockData.price,
          change_pct: stockData.change_pct,
          volume: stockData.volume,
          pe: stockData.pe,
          pb: stockData.pb,
          roe: stockData.roe,
          market_cap: stockData.market_cap,
        });
      }

      // Sort by volume (most liquid first)
      candidates.sort((a, b) => b.volume - a.volume);

      return {
        phase: 'scan',
        status: 'completed',
        success: true,
        data: {
          candidates,
          totalScanned: symbolsToScan.length,
          filteredOut,
        },
        message: `扫描完成：找到 ${candidates.length} 只候选股票（过滤 ${filteredOut} 只）`,
      };
    } catch (err) {
      return {
        phase: 'scan',
        status: 'failed',
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  },

  /**
   * Check if stock should be filtered out based on filters config
   */
  shouldFilter(stock: any, filters: ScanFilters): boolean {
    // Filter by ST status (mock - would need real data)
    if (filters.excludeSt && stock.name?.includes('ST')) {
      return true;
    }

    // Filter by suspended (mock)
    if (filters.excludeSuspended && stock.suspended) {
      return true;
    }

    // Filter by delisted (mock)
    if (filters.excludeDelisted && stock.delisted) {
      return true;
    }

    // Filter by volume
    if (filters.minVolume && (stock.volume || 0) < filters.minVolume * 10000) {
      return true;
    }

    // Filter by price range
    if (filters.minPrice && stock.price < filters.minPrice) {
      return true;
    }
    if (filters.maxPrice && stock.price > filters.maxPrice) {
      return true;
    }

    return false;
  },
};