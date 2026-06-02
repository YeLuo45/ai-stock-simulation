/**
 * PatternLearner - Extract winning patterns from debate history
 * Analyzes debate outcomes to generate actionable trading hints
 */

export interface DebatePattern {
  id: string;
  type: 'bull' | 'bear' | 'neutral';
  regime: string;
  indicators: string[];
  winRate: number;
  sampleCount: number;
  hint: string;
}

interface DebateOutcome {
  stockCode: string;
  regime: string;
  phaseOutputs: unknown[];
  finalDecision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

interface PatternEntry {
  regime: string;
  type: 'bull' | 'bear' | 'neutral';
  indicators: string[];
  decision: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
}

// In-memory pattern store (persisted via DebateMemoryStore)
const patternStore: Map<string, PatternEntry[]> = new Map();

function generatePatternId(regime: string, indicators: string[]): string {
  const key = [regime, ...indicators].join('|');
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `pattern_${Math.abs(hash).toString(36)}`;
}

function extractIndicators(phaseOutputs: unknown[]): string[] {
  const indicators: string[] = [];
  for (const output of phaseOutputs) {
    if (output && typeof output === 'object') {
      const obj = output as Record<string, unknown>;
      // Extract RSI
      if (typeof obj.rsi === 'number') {
        if (obj.rsi < 30) indicators.push('RSI<30');
        else if (obj.rsi > 70) indicators.push('RSI>70');
        else indicators.push(`RSI=${Math.round(obj.rsi)}`);
      }
      // Extract MA cross
      if (obj.maCross) {
        indicators.push(`MA_cross_${obj.maCross}`);
      }
      // Extract price position
      if (typeof obj.pricePosition === 'string') {
        indicators.push(`price_${obj.pricePosition}`);
      }
      // Extract volume spike
      if (obj.volumeSpike === true) indicators.push('volume_spike');
      if (obj.volumeSpike === false) indicators.push('volume_normal');
      // Extract trend
      if (typeof obj.trend === 'string') {
        indicators.push(`trend_${obj.trend}`);
      }
      // Extract MACD
      if (obj.macdSignal) {
        indicators.push(obj.macdSignal === 'BUY' ? 'MACD_BUY' : 'MACD_SELL');
      }
      // Extract Bollinger position
      if (typeof obj.bollingerPosition === 'string') {
        indicators.push(`BB_${obj.bollingerPosition}`);
      }
    }
  }
  return [...new Set(indicators)];
}

function determinePatternType(decision: 'BUY' | 'SELL' | 'HOLD', confidence: number): 'bull' | 'bear' | 'neutral' {
  if (decision === 'BUY' && confidence > 0.6) return 'bull';
  if (decision === 'SELL' && confidence > 0.6) return 'bear';
  return 'neutral';
}

export class PatternLearner {
  /**
   * Learn from a debate outcome and create/update a pattern
   */
  learn(debate: DebateOutcome): DebatePattern {
    const indicators = extractIndicators(debate.phaseOutputs);
    const patternType = determinePatternType(debate.finalDecision, debate.confidence);
    const patternId = generatePatternId(debate.regime, indicators);

    // Store the entry
    const entry: PatternEntry = {
      regime: debate.regime,
      type: patternType,
      indicators,
      decision: debate.finalDecision,
      confidence: debate.confidence,
    };

    const existing = patternStore.get(patternId) || [];
    existing.push(entry);
    patternStore.set(patternId, existing);

    // Calculate win rate
    const wins = existing.filter(e => {
      if (e.type === 'bull' && e.decision === 'BUY') return true;
      if (e.type === 'bear' && e.decision === 'SELL') return true;
      if (e.type === 'neutral' && e.decision === 'HOLD') return true;
      return false;
    }).length;

    const winRate = existing.length > 0 ? wins / existing.length : 0;

    return {
      id: patternId,
      type: patternType,
      regime: debate.regime,
      indicators,
      winRate,
      sampleCount: existing.length,
      hint: this.generateHint(debate.regime, indicators),
    };
  }

  /**
   * Find patterns similar to the given criteria
   */
  findSimilar(criteria: Partial<DebatePattern>): DebatePattern[] {
    const results: DebatePattern[] = [];

    for (const [id, entries] of patternStore.entries()) {
      if (entries.length === 0) continue;

      const first = entries[0];
      let match = true;

      if (criteria.type && first.type !== criteria.type) match = false;
      if (criteria.regime && first.regime !== criteria.regime) match = false;
      if (criteria.indicators && criteria.indicators.length > 0) {
        const hasAll = criteria.indicators.every(ind => first.indicators.includes(ind));
        if (!hasAll) match = false;
      }

      if (match) {
        // Calculate win rate
        const wins = entries.filter(e => {
          if (e.type === 'bull' && e.decision === 'BUY') return true;
          if (e.type === 'bear' && e.decision === 'SELL') return true;
          if (e.type === 'neutral' && e.decision === 'HOLD') return true;
          return false;
        }).length;

        results.push({
          id,
          type: first.type,
          regime: first.regime,
          indicators: first.indicators,
          winRate: wins / entries.length,
          sampleCount: entries.length,
          hint: this.generateHint(first.regime, first.indicators),
        });
      }
    }

    return results.sort((a, b) => b.winRate - a.winRate);
  }

  /**
   * Generate a trading hint based on regime and indicators
   */
  generateHint(regime: string, indicators: string[]): string {
    const regimeHints: Record<string, string> = {
      'bull_market': 'Strong buy signals in uptrend: look for breakout above resistance with volume confirmation.',
      'bear_market': 'Strong sell signals in downtrend: avoid dip-buying, look for shorts or defensive positions.',
      'sideways': 'Range-bound market: buy support, sell resistance, avoid trend-following strategies.',
      'volatile': 'High volatility regime: consider options strategies, reduce position sizes, widen stops.',
      'low_volatility': 'Low volatility regime: expect eventual breakout, consider straddle strategies.',
    };

    const indicatorHints: Record<string, string> = {
      'RSI<30': 'Oversold - potential bounce candidate',
      'RSI>70': 'Overbought - potential pullback candidate',
      'MA_cross_up': 'Golden cross - bullish momentum shift',
      'MA_cross_down': 'Death cross - bearish momentum shift',
      'volume_spike': 'Volume surge - confirms directional move',
      'trend_up': 'Strong upward trend - favor long positions',
      'trend_down': 'Strong downward trend - favor short positions',
      'MACD_BUY': 'MACD bullish crossover',
      'MACD_SELL': 'MACD bearish crossover',
      'BB_lower': 'Near lower Bollinger Band - oversold',
      'BB_upper': 'Near upper Bollinger Band - overbought',
    };

    let hint = regimeHints[regime] || `Regime: ${regime}. `;

    const matchingIndicators = indicators
      .map(ind => indicatorHints[ind])
      .filter(Boolean);

    if (matchingIndicators.length > 0) {
      hint += ' Indicators: ' + matchingIndicators.join('; ') + '.';
    }

    // Add RSI-specific advice
    const rsi30 = indicators.includes('RSI<30');
    const rsi70 = indicators.includes('RSI>70');
    if (rsi30 && (indicators.includes('MA_cross_up') || indicators.includes('MACD_BUY'))) {
      hint += ' HIGH CONFIDENCE: Oversold + bullish crossover - strong buy signal.';
    }
    if (rsi70 && (indicators.includes('MA_cross_down') || indicators.includes('MACD_SELL'))) {
      hint += ' HIGH CONFIDENCE: Overbought + bearish crossover - strong sell signal.';
    }

    return hint;
  }

  /**
   * Clear all patterns (for testing)
   */
  clearPatterns(): void {
    patternStore.clear();
  }

  /**
   * Get pattern count (for testing)
   */
  getPatternCount(): number {
    return patternStore.size;
  }
}

// Export singleton
export const patternLearner = new PatternLearner();
