/**
 * Evolutionary Algorithm (Genetic Algorithm) Core
 * For optimizing trading strategy parameters
 */

import type { OptimizeMetrics } from '../types';
import type { BacktestResult } from './indicators';

// ============== Type Definitions ==============

export interface EvolutionConfig {
  populationSize: number;
  generations: number;
  crossoverRate: number;
  mutationRate: number;
  elitismCount: number;
  tournamentSize: number;
  /** Min and max values for each gene in the chromosome */
  geneRanges: GeneRange[];
  /** 0 = minimize, 1 = maximize */
  optimizationDirection: 'maximize' | 'minimize';
  /** For multi-objective: weights [return, risk, sharpe] (sum to 1) */
  objectiveWeights?: number[];
}

export interface GeneRange {
  name: string;
  min: number;
  max: number;
  step: number;
  /** For special handling like RSI periods (must be integers) */
  integer?: boolean;
}

export interface Chromosome {
  genes: number[];
  fitness: number;
  metrics?: OptimizeMetrics;
}

export interface EvolutionState {
  generation: number;
  population: Chromosome[];
  bestChromosome: Chromosome;
  bestEver: Chromosome;
  history: { generation: number; bestFitness: number; avgFitness: number }[];
  /** Track diversity for adaptive mutation */
  diversityScore: number;
}

export interface FitnessParams {
  genes: number[];
  geneRanges: GeneRange[];
  backtestFn: (params: Record<string, number>, history: import('./indicators').OHLCV[], initialCash: number) => BacktestResult;
  history: import('./indicators').OHLCV[];
  initialCash: number;
  optimizationDirection: 'maximize' | 'minimize';
  objectiveWeights?: number[];
}

// ============== Core GA Functions ==============

/**
 * Initialize random population
 */
export function initializePopulation(config: EvolutionConfig): Chromosome[] {
  const population: Chromosome[] = [];
  for (let i = 0; i < config.populationSize; i++) {
    const genes = config.geneRanges.map(range => {
      const steps = Math.floor((range.max - range.min) / range.step) + 1;
      let gene = range.min + Math.floor(Math.random() * steps) * range.step;
      if (range.integer) {
        gene = Math.round(gene);
      }
      return gene;
    });
    population.push({ genes, fitness: 0 });
  }
  return population;
}

/**
 * Decode chromosome genes to parameter object
 */
export function decodeChromosome(genes: number[], geneRanges: GeneRange[]): Record<string, number> {
  const params: Record<string, number> = {};
  geneRanges.forEach((range, i) => {
    params[range.name] = range.integer ? Math.round(genes[i]) : genes[i];
  });
  return params;
}

/**
 * Encode params object back to chromosome genes
 */
export function encodeParams(params: Record<string, number>, geneRanges: GeneRange[]): number[] {
  return geneRanges.map(range => params[range.name] ?? range.min);
}

/**
 * Calculate fitness for a chromosome
 */
export function calculateFitness(chromosome: Chromosome, params: FitnessParams): number {
  const decodedParams = decodeChromosome(params.genes, params.geneRanges);
  const result = params.backtestFn(decodedParams, params.history, params.initialCash);
  
  // Store metrics for later reference
  chromosome.metrics = {
    total_return: result.total_return,
    annual_return: result.annual_return,
    max_drawdown: result.max_drawdown,
    sharpe_ratio: result.sharpe_ratio,
    win_rate: result.win_rate,
    total_trades: result.total_trades,
  };

  // Multi-objective fitness: weighted combination
  if (params.objectiveWeights) {
    const weights = params.objectiveWeights;
    // Normalize metrics to 0-1 range approximately
    const normReturn = Math.tanh(result.total_return / 100); // -1 to 1
    const normSharpe = Math.tanh(result.sharpe_ratio / 3); // assume max ~3 is good
    const normDrawdown = Math.tanh(-result.max_drawdown / 50); // negative drawdown is good
    
    chromosome.fitness = weights[0] * normReturn + weights[1] * normSharpe + weights[2] * normDrawdown;
  } else {
    // Single objective: use Sharpe ratio as default (risk-adjusted return)
    const { optimizationDirection } = params;
    const fitnessValue = result.sharpe_ratio || (result.total_return / (Math.abs(result.max_drawdown) + 1));
    
    chromosome.fitness = optimizationDirection === 'maximize' ? fitnessValue : -fitnessValue;
  }

  return chromosome.fitness;
}

/**
 * Tournament selection
 */
export function tournamentSelection(population: Chromosome[], tournamentSize: number): Chromosome {
  const indices = new Set<number>();
  while (indices.size < tournamentSize) {
    indices.add(Math.floor(Math.random() * population.length));
  }
  
  let best: Chromosome | null = null;
  for (const idx of indices) {
    if (!best || population[idx].fitness > best.fitness) {
      best = { ...population[idx], genes: [...population[idx].genes] };
    }
  }
  return best!;
}

/**
 * Single-point crossover
 */
export function singlePointCrossover(
  parent1: Chromosome,
  parent2: Chromosome,
  crossoverRate: number
): [Chromosome, Chromosome] {
  const child1: Chromosome = { genes: [...parent1.genes], fitness: 0 };
  const child2: Chromosome = { genes: [...parent2.genes], fitness: 0 };

  if (Math.random() < crossoverRate) {
    const point = Math.floor(Math.random() * parent1.genes.length) + 1;
    for (let i = point; i < parent1.genes.length; i++) {
      child1.genes[i] = parent2.genes[i];
      child2.genes[i] = parent1.genes[i];
    }
  }

  return [child1, child2];
}

/**
 * Uniform crossover
 */
export function uniformCrossover(
  parent1: Chromosome,
  parent2: Chromosome,
  crossoverRate: number
): [Chromosome, Chromosome] {
  const child1: Chromosome = { genes: [...parent1.genes], fitness: 0 };
  const child2: Chromosome = { genes: [...parent2.genes], fitness: 0 };

  if (Math.random() < crossoverRate) {
    for (let i = 0; i < parent1.genes.length; i++) {
      if (Math.random() < 0.5) {
        child1.genes[i] = parent2.genes[i];
        child2.genes[i] = parent1.genes[i];
      }
    }
  }

  return [child1, child2];
}

/**
 * Gaussian mutation
 */
export function gaussianMutation(
  chromosome: Chromosome,
  mutationRate: number,
  geneRanges: GeneRange[],
  mutationStrength = 0.1
): Chromosome {
  const mutated = { ...chromosome, genes: [...chromosome.genes] };
  
  for (let i = 0; i < mutated.genes.length; i++) {
    if (Math.random() < mutationRate) {
      const range = geneRanges[i];
      const span = range.max - range.min;
      const delta = (Math.random() - 0.5) * 2 * span * mutationStrength;
      let newGene = mutated.genes[i] + delta;
      
      // Clamp to valid range
      newGene = Math.max(range.min, Math.min(range.max, newGene));
      
      // Snap to step
      if (range.step > 0) {
        newGene = range.min + Math.round((newGene - range.min) / range.step) * range.step;
      }
      
      if (range.integer) {
        newGene = Math.round(newGene);
      }
      
      mutated.genes[i] = newGene;
    }
  }
  
  return mutated;
}

/**
 * Boundary mutation (simpler, respects step constraints)
 */
export function boundaryMutation(
  chromosome: Chromosome,
  mutationRate: number,
  geneRanges: GeneRange[]
): Chromosome {
  const mutated = { ...chromosome, genes: [...chromosome.genes] };
  
  for (let i = 0; i < mutated.genes.length; i++) {
    if (Math.random() < mutationRate) {
      const range = geneRanges[i];
      const steps = Math.floor((range.max - range.min) / range.step) + 1;
      const randomStep = Math.floor(Math.random() * steps);
      let newGene = range.min + randomStep * range.step;
      
      if (range.integer) {
        newGene = Math.round(newGene);
      }
      
      mutated.genes[i] = newGene;
    }
  }
  
  return mutated;
}

/**
 * Calculate population diversity (average Hamming distance for discrete genes)
 */
export function calculateDiversity(population: Chromosome[]): number {
  if (population.length < 2) return 0;
  
  let totalDist = 0;
  let count = 0;
  for (let i = 0; i < population.length; i++) {
    for (let j = i + 1; j < population.length; j++) {
      let dist = 0;
      for (let k = 0; k < population[i].genes.length; k++) {
        if (population[i].genes[k] !== population[j].genes[k]) dist++;
      }
      totalDist += dist / population[i].genes.length;
      count++;
    }
  }
  
  return count > 0 ? totalDist / count : 0;
}

/**
 * Select elite individuals (preserved unchanged)
 */
export function selectElites(population: Chromosome[], elitismCount: number): Chromosome[] {
  const sorted = [...population].sort((a, b) => b.fitness - a.fitness);
  return sorted.slice(0, elitismCount).map(c => ({ ...c, genes: [...c.genes] }));
}

/**
 * Main evolution loop - runs one generation
 */
export function evolveGeneration(
  population: Chromosome[],
  config: EvolutionConfig,
  fitnessParams: FitnessParams
): Chromosome[] {
  const newPopulation: Chromosome[] = [];
  
  // Elitism - keep best individuals
  const elites = selectElites(population, config.elitismCount);
  newPopulation.push(...elites);
  
  // Generate rest of population through crossover and mutation
  while (newPopulation.length < config.populationSize) {
    // Selection
    const parent1 = tournamentSelection(population, config.tournamentSize);
    const parent2 = tournamentSelection(population, config.tournamentSize);
    
    // Crossover
    const [child1, child2] = singlePointCrossover(parent1, parent2, config.crossoverRate);
    
    // Mutation (adaptive mutation rate based on diversity)
    const mutationRate = config.mutationRate;
    const mutated1 = boundaryMutation(child1, mutationRate, config.geneRanges);
    const mutated2 = boundaryMutation(child2, mutationRate, config.geneRanges);
    
    // Calculate fitness
    const params1 = { ...fitnessParams, genes: mutated1.genes };
    const params2 = { ...fitnessParams, genes: mutated2.genes };
    calculateFitness(mutated1, params1);
    calculateFitness(mutated2, params2);
    
    newPopulation.push(mutated1);
    if (newPopulation.length < config.populationSize) {
      newPopulation.push(mutated2);
    }
  }
  
  return newPopulation;
}

/**
 * Run complete evolutionary algorithm
 */
export function runEvolution(
  config: EvolutionConfig,
  fitnessParams: Omit<FitnessParams, 'genes'>,
  onProgress?: (state: EvolutionState) => void,
  abortSignal?: { aborted: boolean }
): EvolutionState {
  // Initialize population
  let population = initializePopulation(config);
  
  // Evaluate initial population
  for (const chromosome of population) {
    const params = { ...fitnessParams, genes: chromosome.genes };
    calculateFitness(chromosome, params);
  }
  
  // Find best
  population.sort((a, b) => b.fitness - a.fitness);
  let bestEver = { ...population[0], genes: [...population[0].genes] };
  const history: EvolutionState['history'] = [];
  
  const initialDiversity = calculateDiversity(population);
  
  const initialState: EvolutionState = {
    generation: 0,
    population,
    bestChromosome: population[0],
    bestEver,
    history: [],
    diversityScore: initialDiversity,
  };
  
  if (onProgress) onProgress(initialState);
  
  for (let gen = 0; gen < config.generations; gen++) {
    if (abortSignal?.aborted) break;
    
    // Evolve one generation
    const fp: FitnessParams = { ...fitnessParams, genes: [] as unknown as number[] };
    population = evolveGeneration(population, config, fp);
    
    // Get best of this generation
    population.sort((a, b) => b.fitness - a.fitness);
    const bestChromosome = population[0];
    
    // Update best ever
    if (bestChromosome.fitness > bestEver.fitness) {
      bestEver = { ...bestChromosome, genes: [...bestChromosome.genes] };
    }
    
    const avgFitness = population.reduce((sum, c) => sum + c.fitness, 0) / population.length;
    const diversity = calculateDiversity(population);
    
    const state: EvolutionState = {
      generation: gen + 1,
      population,
      bestChromosome,
      bestEver,
      history: [...history, { generation: gen + 1, bestFitness: bestChromosome.fitness, avgFitness }],
      diversityScore: diversity,
    };
    
    if (onProgress) onProgress(state);
  }
  
  return {
    generation: config.generations,
    population,
    bestChromosome: population[0],
    bestEver,
    history,
    diversityScore: calculateDiversity(population),
  };
}

// ============== Strategy-specific GA Configuration ==============

/**
 * Default GA config for MA crossover strategy optimization
 */
export function getMACrossoverGAConfig(): EvolutionConfig {
  return {
    populationSize: 50,
    generations: 100,
    crossoverRate: 0.8,
    mutationRate: 0.15,
    elitismCount: 2,
    tournamentSize: 3,
    geneRanges: [
      { name: 'ma_short', min: 3, max: 30, step: 1, integer: true },
      { name: 'ma_long', min: 20, max: 120, step: 5, integer: true },
      { name: 'stop_loss', min: 0.01, max: 0.1, step: 0.005 },
      { name: 'take_profit', min: 0.02, max: 0.3, step: 0.01 },
      { name: 'position_size', min: 0.5, max: 1.0, step: 0.1 },
    ],
    optimizationDirection: 'maximize',
    objectiveWeights: [0.4, 0.3, 0.3], // return, sharpe, low drawdown
  };
}

/**
 * Default GA config for RSI strategy optimization
 */
export function getRSIGAConfig(): EvolutionConfig {
  return {
    populationSize: 50,
    generations: 100,
    crossoverRate: 0.8,
    mutationRate: 0.15,
    elitismCount: 2,
    tournamentSize: 3,
    geneRanges: [
      { name: 'rsi_period', min: 7, max: 21, step: 1, integer: true },
      { name: 'oversold', min: 20, max: 40, step: 5, integer: true },
      { name: 'overbought', min: 60, max: 80, step: 5, integer: true },
      { name: 'stop_loss', min: 0.01, max: 0.1, step: 0.005 },
      { name: 'take_profit', min: 0.02, max: 0.3, step: 0.01 },
    ],
    optimizationDirection: 'maximize',
    objectiveWeights: [0.4, 0.3, 0.3],
  };
}

/**
 * Default GA config for MACD strategy optimization
 */
export function getMACDGAConfig(): EvolutionConfig {
  return {
    populationSize: 50,
    generations: 100,
    crossoverRate: 0.8,
    mutationRate: 0.15,
    elitismCount: 2,
    tournamentSize: 3,
    geneRanges: [
      { name: 'macd_fast', min: 8, max: 16, step: 1, integer: true },
      { name: 'macd_slow', min: 20, max: 32, step: 1, integer: true },
      { name: 'macd_signal', min: 6, max: 12, step: 1, integer: true },
      { name: 'hist_threshold', min: 0, max: 0.5, step: 0.05 },
      { name: 'stop_loss', min: 0.01, max: 0.1, step: 0.005 },
      { name: 'take_profit', min: 0.02, max: 0.3, step: 0.01 },
    ],
    optimizationDirection: 'maximize',
    objectiveWeights: [0.4, 0.3, 0.3],
  };
}

// ============== Hybrid with Grid Search ==============

/**
 * Hybrid approach: pre-seed population with grid search samples
 */
export function initializePopulationHybrid(
  config: EvolutionConfig,
  gridSamples: number[][]
): Chromosome[] {
  const population: Chromosome[] = [];
  
  // Add grid search samples
  for (const sample of gridSamples) {
    population.push({ genes: sample, fitness: 0 });
  }
  
  // Fill remaining with random individuals
  while (population.length < config.populationSize) {
    const genes = config.geneRanges.map(range => {
      const steps = Math.floor((range.max - range.min) / range.step) + 1;
      let gene = range.min + Math.floor(Math.random() * steps) * range.step;
      if (range.integer) {
        gene = Math.round(gene);
      }
      return gene;
    });
    population.push({ genes, fitness: 0 });
  }
  
  return population;
}
