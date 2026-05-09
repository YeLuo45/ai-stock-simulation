/**
 * Reinforcement Learning Training Engine
 * Pure TypeScript implementation - Q-Learning and REINFORCE algorithms
 */

import type { RLConfig, RLStateSpace, RLTrainingProgress, QTable, RLAlgorithm } from '../types';
import { fetchKlineData } from './yahooFinance';
import { sma, calculateRSI, calculateMACD, calculateKDJ, calculateBOLL } from './indicators';

// Actions: 0 = HOLD, 1 = BUY, 2 = SELL
export const ACTIONS = [0, 1, 2] as const;
export type Action = typeof ACTIONS[number];
export const ACTION_NAMES: Record<Action, string> = { 0: 'HOLD', 1: 'BUY', 2: 'SELL' };

export interface KLineData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface State {
  indicators: Record<string, number>;
  position: number; // 0 = no position, >0 = shares held
  discretized: string; // hash key for Q-table lookup
}

export interface EpisodeResult {
  totalReward: number;
  finalEquity: number;
  sharpe: number;
  maxDrawdown: number;
  trades: number;
}

export interface TrainingCallbacks {
  onEpisodeComplete: (episode: number, result: EpisodeResult) => void;
  onProgress: (progress: RLTrainingProgress) => void;
  shouldStop: () => boolean;
}

// Discretize continuous indicator into 3 levels: high, medium, low
function discretize(value: number, high: number, low: number): 'H' | 'M' | 'L' {
  const range = high - low;
  if (range === 0) return 'M';
  const normalized = (value - low) / range;
  if (normalized >= 0.7) return 'H';
  if (normalized <= 0.3) return 'L';
  return 'M';
}

// Compute all required indicators from kline data
function computeIndicators(klines: KLineData[], stateSpace: RLStateSpace[]): Record<string, number> {
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const volumes = klines.map(k => k.volume);

  const result: Record<string, number> = {};

  const maPeriods: Record<string, number> = { MA5: 5, MA10: 10, MA20: 20 };
  for (const [key, period] of Object.entries(maPeriods)) {
    if (stateSpace.includes(key as RLStateSpace)) {
      result[key] = sma(closes, Math.min(period, closes.length));
    }
  }

  if (stateSpace.includes('RSI')) {
    result.RSI = calculateRSI(closes);
  }

  if (stateSpace.includes('MACD')) {
    const macd = calculateMACD(closes);
    result.MACD = macd.hist;
  }

  if (stateSpace.includes('KDJ')) {
    const kdj = calculateKDJ(highs, lows, closes);
    result.KDJ = kdj.j;
  }

  if (stateSpace.includes('BOLL')) {
    const boll = calculateBOLL(closes);
    const current = closes[closes.length - 1];
    result.BOLL = (current - boll.lower) / (boll.upper - boll.lower + 0.0001);
  }

  if (stateSpace.includes('Volume')) {
    const avgVol = sma(volumes, 20);
    result.Volume = volumes[volumes.length - 1] / avgVol;
  }

  return result;
}

// Compute reference ranges for discretization from entire dataset
function computeIndicatorRanges(klines: KLineData[], stateSpace: RLStateSpace[]): Record<string, { high: number; low: number }> {
  const closes = klines.map(k => k.close);
  const highs = klines.map(k => k.high);
  const lows = klines.map(k => k.low);
  const volumes = klines.map(k => k.volume);

  const ranges: Record<string, { high: number; low: number }> = {};

  const maPeriods: Record<string, number> = { MA5: 5, MA10: 10, MA20: 20 };
  for (const [key, period] of Object.entries(maPeriods)) {
    if (stateSpace.includes(key as RLStateSpace)) {
      const vals = [];
      for (let i = period; i < closes.length; i++) {
        vals.push(sma(closes.slice(i - period, i), period));
      }
      if (vals.length > 0) {
        ranges[key] = { high: Math.max(...vals), low: Math.min(...vals) };
      }
    }
  }

  if (stateSpace.includes('RSI')) {
    ranges.RSI = { high: 100, low: 0 };
  }

  if (stateSpace.includes('MACD')) {
    const vals = [];
    for (let i = 30; i < closes.length; i++) {
      const macd = calculateMACD(closes.slice(0, i + 1));
      vals.push(macd.hist);
    }
    if (vals.length > 0) {
      ranges.MACD = { high: Math.max(...vals), low: Math.min(...vals) };
    }
  }

  if (stateSpace.includes('KDJ')) {
    const vals = [];
    for (let i = 9; i < closes.length; i++) {
      const kdj = calculateKDJ(highs.slice(0, i + 1), lows.slice(0, i + 1), closes.slice(0, i + 1));
      vals.push(kdj.j);
    }
    if (vals.length > 0) {
      ranges.KDJ = { high: Math.max(...vals), low: Math.min(...vals) };
    }
  }

  if (stateSpace.includes('BOLL')) {
    ranges.BOLL = { high: 1, low: 0 };
  }

  if (stateSpace.includes('Volume')) {
    const volVals = [];
    for (let i = 20; i < volumes.length; i++) {
      const avgVol = sma(volumes.slice(i - 20, i), 20);
      volVals.push(volumes[i] / avgVol);
    }
    if (volVals.length > 0) {
      ranges.Volume = { high: Math.max(...volVals), low: Math.min(...volVals) };
    }
  }

  return ranges;
}

// Discretize state based on selected indicators
function discretizeState(
  indicators: Record<string, number>,
  ranges: Record<string, { high: number; low: number }>,
  stateSpace: RLStateSpace[]
): string {
  const parts: string[] = [];
  for (const key of stateSpace) {
    const val = indicators[key] ?? 0;
    const range = ranges[key] ?? { high: val, low: val };
    parts.push(`${key}_${discretize(val, range.high, range.low)}`);
  }
  return parts.join('|');
}

// Load Q-table from localStorage
export function loadQTable(symbol: string, interval: string): QTable {
  try {
    const key = `rl_q_table_${symbol}_${interval}`;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Save Q-table to localStorage
export function saveQTable(symbol: string, interval: string, qTable: QTable): void {
  try {
    const key = `rl_q_table_${symbol}_${interval}`;
    localStorage.setItem(key, JSON.stringify(qTable));
  } catch {
    // localStorage full or unavailable
  }
}

// Q-Learning: choose action using epsilon-greedy
function qLearningAction(qTable: QTable, state: string, epsilon: number): Action {
  const qValues = qTable[state];
  if (!qValues) {
    return Math.floor(Math.random() * 3) as Action;
  }

  if (Math.random() < epsilon) {
    return Math.floor(Math.random() * 3) as Action;
  }

  let bestAction = 0;
  let bestValue = qValues[0];
  for (let a = 1; a < 3; a++) {
    if (qValues[a] > bestValue) {
      bestValue = qValues[a];
      bestAction = a;
    }
  }
  return bestAction as Action;
}

// Q-Learning update
function qLearningUpdate(
  qTable: QTable,
  state: string,
  action: Action,
  reward: number,
  nextState: string,
  gamma: number,
  lr: number
): QTable {
  const newTable = { ...qTable };
  if (!newTable[state]) {
    newTable[state] = [0, 0, 0];
  }
  const currentQ = newTable[state][action];
  const nextQValues = newTable[nextState] || [0, 0, 0];
  const maxNextQ = Math.max(...nextQValues);
  newTable[state][action] = currentQ + lr * (reward + gamma * maxNextQ - currentQ);
  return newTable;
}

// REINFORCE: softmax probability from policy weights
function softmaxProbs(weights: number[]): number[] {
  const maxW = Math.max(...weights);
  const exps = weights.map(w => Math.exp(w - maxW));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map(e => e / sum);
}

function reinforceAction(policyWeights: number[]): Action {
  if (policyWeights.length !== 3) {
    return 0;
  }
  const probs = softmaxProbs(policyWeights);
  const r = Math.random();
  let cumulative = 0;
  for (let a = 0; a < 3; a++) {
    cumulative += probs[a];
    if (r < cumulative) return a as Action;
  }
  return 2 as Action;
}

// REINFORCE policy gradient update (simplified, per-state weights)
function reinforceUpdate(
  policyWeights: number[],
  _state: string,
  action: Action,
  advantage: number,
  lr: number
): number[] {
  const newWeights = [...policyWeights];
  if (newWeights.length !== 3) {
    return [0, 0, 0];
  }
  // Simple gradient update: move weight of taken action toward advantage
  const probs = softmaxProbs(newWeights);
  for (let a = 0; a < 3; a++) {
    const grad = (a === action ? 1 - probs[a] : -probs[a]) * advantage;
    newWeights[a] += lr * grad;
  }
  return newWeights;
}

// Calculate reward based on reward function
function computeReward(
  rewardFunction: RLConfig['rewardFunction'],
  dailyReturn: number,
  _cumulativeReturn: number,
  peakEquity: number,
  currentEquity: number,
  sharpeBuffer: number[]
): number {
  switch (rewardFunction) {
    case 'total_return':
      return dailyReturn;

    case 'sharpe_ratio': {
      sharpeBuffer.push(dailyReturn);
      if (sharpeBuffer.length < 5) return 0;
      const mean = sharpeBuffer.reduce((a, b) => a + b, 0) / sharpeBuffer.length;
      const std = Math.sqrt(sharpeBuffer.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / sharpeBuffer.length);
      return std > 0 ? mean / std : 0;
    }

    case 'calmar_ratio': {
      const maxDD = (peakEquity - currentEquity) / peakEquity;
      return dailyReturn / (maxDD + 0.001);
    }

    case 'max_drawdown_penalty': {
      const dd = (peakEquity - currentEquity) / peakEquity;
      return dailyReturn - 2 * dd;
    }

    default:
      return dailyReturn;
  }
}

// Run a single episode
async function runEpisode(
  klines: KLineData[],
  config: RLConfig,
  ranges: Record<string, { high: number; low: number }>,
  qTable: QTable,
  policyWeights: number[],
  episode: number
): Promise<{ result: EpisodeResult; qTable: QTable; policyWeights: number[] }> {
  const INITIAL_CASH = 10000;
  const { stateSpace, learningRate, gamma, epsilon, algorithm } = config;

  let cash = INITIAL_CASH;
  let shares = 0;
  let position = 0; // 0 = flat, 1 = long
  let equity = INITIAL_CASH;
  let peak = INITIAL_CASH;
  let maxDrawdown = 0;
  let totalReward = 0;
  let trades = 0;
  const equityCurve: number[] = [equity];
  const dailyReturns: number[] = [];
  const sharpeBuffer: number[] = [];

  let currentState = '';
  let currentIndicators: Record<string, number> = {};
  let action: Action = 0;

  // Start from a random offset so we don't always trade the same sequence
  const startOffset = Math.floor(Math.random() * Math.max(1, klines.length - 50));

  for (let day = startOffset + 1; day < klines.length - 1; day++) {
    const window = klines.slice(Math.max(0, day - 60), day + 1);
    currentIndicators = computeIndicators(window, stateSpace);
    currentState = discretizeState(currentIndicators, ranges, stateSpace);

    // Decide action
    if (algorithm === 'q-learning') {
      action = qLearningAction(qTable, currentState, epsilon * (1 - episode / 1000)); // annealing
    } else {
      // REINFORCE uses a flat weight vector for now (simplified)
      action = reinforceAction(policyWeights);
    }

    const price = klines[day].close;
    const nextPrice = klines[day + 1].close;
    const dailyReturn = (nextPrice - price) / price;

    // Execute action
    if (action === 1 && position === 0) {
      // BUY
      shares = Math.floor(cash / price);
      if (shares > 0) {
        cash -= shares * price;
        position = 1;
        trades++;
      }
    } else if (action === 2 && position === 1) {
      // SELL
      cash += shares * price;
      shares = 0;
      position = 0;
      trades++;
    }

    // Calculate equity
    equity = cash + shares * nextPrice;
    equityCurve.push(equity);

    if (equity > peak) peak = equity;
    const dd = (peak - equity) / peak;
    if (dd > maxDrawdown) maxDrawdown = dd;

    dailyReturns.push(dailyReturn);

    // Compute reward
    const reward = computeReward(
      config.rewardFunction,
      dailyReturn,
      (equity - INITIAL_CASH) / INITIAL_CASH,
      peak,
      equity,
      sharpeBuffer
    );
    totalReward += reward;

    // Next state
    const nextWindow = klines.slice(Math.max(0, day - 59), day + 2);
    const nextIndicators = computeIndicators(nextWindow, stateSpace);
    const nextState = discretizeState(nextIndicators, ranges, stateSpace);

    // Update
    if (algorithm === 'q-learning') {
      qTable = qLearningUpdate(qTable, currentState, action, reward, nextState, gamma, learningRate);
    } else {
      // Advantage estimation
      const advantage = reward - (sharpeBuffer.length > 0 ? sharpeBuffer.reduce((a, b) => a + b, 0) / sharpeBuffer.length : 0);
      policyWeights = reinforceUpdate(policyWeights, currentState, action, advantage, learningRate);
    }

    // Give up the thread occasionally to avoid blocking
    if (day % 5 === 0) {
      await new Promise(r => setTimeout(r, 0));
    }
  }

  // Close any open position
  if (position === 1 && shares > 0) {
    equity = cash + shares * klines[klines.length - 1].close;
  }

  const meanRet = dailyReturns.length > 0 ? dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length : 0;
  const stdRet = dailyReturns.length > 0 ? Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - meanRet, 2), 0) / dailyReturns.length) : 0;
  const sharpe = stdRet > 0 ? (meanRet / stdRet) * Math.sqrt(252) : 0;

  return {
    result: {
      totalReward,
      finalEquity: equity,
      sharpe,
      maxDrawdown: maxDrawdown * 100,
      trades,
    },
    qTable,
    policyWeights,
  };
}

// Main training loop
export async function trainRL(
  symbol: string,
  interval: string,
  config: RLConfig,
  callbacks: TrainingCallbacks
): Promise<{ qTable: QTable; policyWeights: number[] }> {
  // Load K-line data (1D, last 252 trading days)
  let klines: KLineData[];
  try {
    klines = await fetchKlineData(symbol, 300, '1d');
    if (klines.length < 50) {
      throw new Error('Insufficient data');
    }
  } catch (e) {
    // Fallback: generate mock data
    const mockBase = 100;
    klines = [];
    let price = mockBase;
    const now = new Date();
    for (let i = 252; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      price = price * (1 + (Math.random() - 0.48) * 0.02);
      klines.push({
        date: d.toISOString().split('T')[0],
        open: price * 0.99,
        high: price * 1.01,
        low: price * 0.98,
        close: price,
        volume: Math.floor(Math.random() * 50000000 + 1000000),
      });
    }
  }

  // Compute indicator ranges for discretization
  const ranges = computeIndicatorRanges(klines, config.stateSpace);

  // Load existing Q-table or initialize
  let qTable = loadQTable(symbol, interval);
  let policyWeights = config.algorithm === 'policy-gradient'
    ? (JSON.parse(localStorage.getItem(`rl_policy_${symbol}_${interval}`) || '[0,0,0]') as number[])
    : [];

  const totalEpisodes = config.episodes;

  for (let ep = 0; ep < totalEpisodes; ep++) {
    if (callbacks.shouldStop()) break;

    const { result, qTable: newQTable, policyWeights: newWeights } = await runEpisode(
      klines,
      config,
      ranges,
      qTable,
      policyWeights,
      ep
    );

    qTable = newQTable;
    policyWeights = newWeights;

    callbacks.onEpisodeComplete(ep + 1, result);

    callbacks.onProgress({
      currentEpisode: ep + 1,
      totalEpisodes,
      currentReward: result.totalReward,
      epsilon: config.epsilon * (1 - ep / totalEpisodes),
      isRunning: true,
      isPaused: false,
    });

    // Persist Q-table every 10 episodes
    if ((ep + 1) % 10 === 0) {
      saveQTable(symbol, interval, qTable);
      if (config.algorithm === 'policy-gradient') {
        localStorage.setItem(`rl_policy_${symbol}_${interval}`, JSON.stringify(policyWeights));
      }
    }
  }

  // Final save
  saveQTable(symbol, interval, qTable);
  if (config.algorithm === 'policy-gradient') {
    localStorage.setItem(`rl_policy_${symbol}_${interval}`, JSON.stringify(policyWeights));
  }

  return { qTable, policyWeights };
}

// Generate strategy code from trained model
export function generateStrategyCode(
  algorithm: RLAlgorithm,
  qTable: QTable,
  policyWeights: number[],
  _stateSpace: RLStateSpace[]
): string {
  const topStates = Object.entries(qTable)
    .sort(([, a], [, b]) => Math.max(...b) - Math.max(...a))
    .slice(0, 5)
    .map(([state]) => state);

  if (algorithm === 'q-learning') {
    return `// Q-Learning Trained Strategy
// Top learned states:
${topStates.map(s => `//   ${s}`).join('\n')}

// Example rule:
// if (rsi < 30 && q_value_buy > q_value_sell) signal = BUY;
// else if (rsi > 70 && q_value_sell > q_value_buy) signal = SELL;
// else signal = HOLD;

// Apply to backtest:
const state = getRLState(indicators);
const qValues = qTable[state] || [0, 0, 0];
const action = argmax(qValues); // 0=HOLD, 1=BUY, 2=SELL
`;
  } else {
    return `// REINFORCE (Policy Gradient) Trained Strategy
// Policy weights: BUY=${policyWeights[1]?.toFixed(3) ?? 0}, SELL=${policyWeights[2]?.toFixed(3) ?? 0}, HOLD=${policyWeights[0]?.toFixed(3) ?? 0}

// Apply to backtest:
const probs = softmax(policyWeights);
const action = sampleAction(probs); // 0=HOLD, 1=BUY, 2=SELL
`;
  }
}
