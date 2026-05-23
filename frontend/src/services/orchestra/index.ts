/**
 * Trading Orchestra - Multi-Agent Trading System
 * V40: Four-agent collaboration with regime-aware dynamic weight adjustment
 * 
 * Exports:
 * - TradingOrchestra: Main orchestration class
 * - tradingOrchestra: Singleton instance
 * - TrendAgent, MeanReversionAgent, ArbitrageAgent, RiskControlAgent
 * - Types: TradingAgent, AgentDecision, MarketContext, MarketRegime, etc.
 */
export * from './types';
export * from './TrendAgent';
export * from './MeanReversionAgent';
export * from './ArbitrageAgent';
export * from './RiskControlAgent';
export { TradingOrchestra, tradingOrchestra } from './TradingOrchestra';