/**
 * MonteCarloEngine - Monte Carlo Simulation Engine for Stock Price Paths
 * Uses Geometric Brownian Motion (GBM) model with Box-Muller transform for normal random numbers
 */

export interface MCConfig {
  symbol: string;
  numSimulations: number;
  holdingPeriodDays: number;
  confidenceLevel: number;
}

export interface MCResult {
  config: MCConfig;
  meanReturn: number;
  medianReturn: number;
  stdDev: number;
  minReturn: number;
  maxReturn: number;
  var: number;
  cvar: number;
  probLoss: number;
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  simulationReturns: number[];
  timestamp: number;
}

/**
 * Box-Muller transform to generate standard normal random numbers
 */
function boxMuller(): number {
  let u1 = 0;
  let u2 = 0;
  // Ensure u1 is not zero to avoid log(0)
  while (u1 === 0) u1 = Math.random();
  u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * Run Monte Carlo simulation using GBM model
 * S_T = S_0 * exp((drift - 0.5*vol^2)*T + vol*sqrt(T)*Z)
 */
export function runMonteCarlo(
  config: MCConfig,
  entryPrice: number,
  historicalVol: number,
  drift: number = 0.08
): MCResult {
  const { symbol, numSimulations, holdingPeriodDays, confidenceLevel } = config;

  // Convert holding period to years (252 trading days per year)
  const T = holdingPeriodDays / 252;
  const sqrtT = Math.sqrt(T);
  const vol = historicalVol;

  // Generate simulated returns
  const simulationReturns: number[] = [];

  for (let i = 0; i < numSimulations; i++) {
    const Z = boxMuller();
    // GBM: S_T = S_0 * exp((drift - 0.5*vol^2)*T + vol*sqrt(T)*Z)
    const pricePath = entryPrice * Math.exp((drift - 0.5 * vol * vol) * T + vol * sqrtT * Z);
    // Return = (S_T - S_0) / S_0
    const ret = (pricePath - entryPrice) / entryPrice;
    simulationReturns.push(ret);
  }

  // Sort returns for percentile calculations
  const sortedReturns = [...simulationReturns].sort((a, b) => a - b);

  // Basic statistics
  const meanReturn = simulationReturns.reduce((sum, r) => sum + r, 0) / numSimulations;
  const sortedForMedian = [...sortedReturns];
  const midIdx = Math.floor(numSimulations / 2);
  const medianReturn =
    numSimulations % 2 === 0
      ? (sortedForMedian[midIdx - 1] + sortedForMedian[midIdx]) / 2
      : sortedForMedian[midIdx];

  const variance =
    simulationReturns.reduce((sum, r) => sum + (r - meanReturn) ** 2, 0) / numSimulations;
  const stdDev = Math.sqrt(variance);

  const minReturn = sortedReturns[0];
  const maxReturn = sortedReturns[numSimulations - 1];

  // VaR: at (1 - confidenceLevel) percentile, taken as negative
  const varIndex = Math.floor(numSimulations * (1 - confidenceLevel));
  const varValue = -sortedReturns[varIndex]; // VaR is reported as positive number (loss)

  // CVaR: mean of all returns below VaR threshold
  const varThreshold = sortedReturns[varIndex];
  const cvarReturns = sortedReturns.filter((r) => r <= varThreshold);
  const cvarValue = cvarReturns.length > 0
    ? -(cvarReturns.reduce((sum, r) => sum + r, 0) / cvarReturns.length)
    : varValue;

  // Probability of loss
  const lossCount = simulationReturns.filter((r) => r < 0).length;
  const probLoss = lossCount / numSimulations;

  // Percentiles
  const getPercentile = (p: number): number => {
    const idx = Math.floor(numSimulations * p);
    return sortedReturns[Math.min(idx, numSimulations - 1)];
  };

  return {
    config,
    meanReturn,
    medianReturn,
    stdDev,
    minReturn,
    maxReturn,
    var: varValue,
    cvar: cvarValue,
    probLoss,
    percentiles: {
      p5: getPercentile(0.05),
      p25: getPercentile(0.25),
      p50: getPercentile(0.50),
      p75: getPercentile(0.75),
      p95: getPercentile(0.95),
    },
    simulationReturns,
    timestamp: Date.now(),
  };
}
