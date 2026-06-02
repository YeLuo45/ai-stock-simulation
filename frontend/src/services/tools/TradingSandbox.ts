/**
 * Trading Sandbox V2
 * Isolated execution environment for backtesting
 */

import type { SandboxConfig, SandboxExecutionResult } from './types';

export class TradingSandbox {
  private config: SandboxConfig;
  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = {
      maxExecutionTime: config.maxExecutionTime ?? 60000,
      allowedDomains: config.allowedDomains ?? ['localhost', '127.0.0.1'],
      enableNetwork: config.enableNetwork ?? false,
      enableFileSystem: config.enableFileSystem ?? false,
      memoryLimit: config.memoryLimit ?? 128,
    };
  }

  async execute(code: string, context?: Record<string, unknown>): Promise<SandboxExecutionResult> {
    const start = performance.now();
    try {
      const validation = this.validateCode(code);
      if (!validation.valid) return { success: false, error: validation.error, executionTime: performance.now() - start };
      const result = this.executeInSandbox(code, context);
      return { success: true, result, executionTime: performance.now() - start };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Execution failed', executionTime: performance.now() - start };
    }
  }

  private validateCode(code: string): { valid: boolean; error?: string } {
    const dangerous = [/fetch\s*\(/, /import\s*\(/, /eval\s*\(/, /Function\s*\(/, /document\s*\./, /window\s*\./, /localStorage/, /sessionStorage/, /require\s*\(/, /process\.env/];
    for (const p of dangerous) {
      if (p.test(code)) return { valid: false, error: `Blocked: ${p.toString()}` };
    }
    return { valid: true };
  }

  private executeInSandbox(code: string, context?: Record<string, unknown>): unknown {
    const sandboxedContext = {
      Math: { abs: Math.abs, max: Math.max, min: Math.min, floor: Math.floor, ceil: Math.ceil, round: Math.round, sqrt: Math.sqrt, pow: Math.pow, random: Math.random, PI: Math.PI, E: Math.E },
      Array: { isArray: Array.isArray, from: Array.from, of: Array.of },
      Object: { keys: Object.keys, values: Object.values, entries: Object.entries, assign: Object.assign },
      JSON: { parse: JSON.parse, stringify: JSON.stringify },
      parseInt, parseFloat, isNaN, isFinite,
      Date: { now: Date.now, parse: Date.parse },
      ...context,
    };
    const keys = Object.keys(sandboxedContext);
    const values = Object.values(sandboxedContext);
    try {
      const fn = new Function(...keys, '"use strict"; ' + code);
      return fn(...values);
    } catch (error) {
      throw new Error('Sandbox error: ' + (error instanceof Error ? error.message : 'Unknown'));
    }
  }

  validateDomain(domain: string): boolean {
    return this.config.allowedDomains.some(d => domain === d || domain.endsWith('.' + d));
  }

  updateConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): SandboxConfig {
    return { ...this.config };
  }
}

export const tradingSandbox = new TradingSandbox();
