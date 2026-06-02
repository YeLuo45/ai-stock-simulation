import type { AgentWeight, Tool, ToolCategory } from './types';
import { toolRegistry } from './ToolRegistry';

interface CacheEntry {
  tools: Tool[];
  timestamp: number;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

class AgentToolDiscoveryService {
  private cache: Map<string, CacheEntry> = new Map();

  discoverTools(agentId: string, category?: ToolCategory): Tool[] {
    // Check cache first
    const cached = this.getCachedTools(agentId);
    if (cached.length > 0 && !category) {
      return cached;
    }

    // Discover tools from registry
    let tools: Tool[];
    if (category) {
      tools = toolRegistry.findTools(category);
    } else {
      tools = toolRegistry.listAllTools();
    }

    // Cache the result
    this.cache.set(agentId, {
      tools,
      timestamp: Date.now()
    });

    return tools;
  }

  getCachedTools(agentId: string): Tool[] {
    const entry = this.cache.get(agentId);
    if (!entry) return [];

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(agentId);
      return [];
    }

    return entry.tools;
  }

  clearCache(): void {
    this.cache.clear();
  }

  clearAgentCache(agentId: string): void {
    this.cache.delete(agentId);
  }

  getCacheSize(): number {
    return this.cache.size;
  }

  isCacheValid(agentId: string): boolean {
    const entry = this.cache.get(agentId);
    if (!entry) return false;
    return Date.now() - entry.timestamp <= CACHE_TTL;
  }
}

export const agentToolDiscoveryService = new AgentToolDiscoveryService();
export { AgentToolDiscoveryService };
export type { Tool, ToolCategory, AgentWeight };