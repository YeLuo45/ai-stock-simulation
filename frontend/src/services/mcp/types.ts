export type ToolCategory = 'market_data' | 'analysis' | 'execution' | 'risk_control';
export type ToolInputSchema = Record<string, unknown>;
export type ToolOutputSchema = Record<string, unknown>;

export interface Tool {
  name: string;
  description: string;
  category: ToolCategory;
  inputSchema: ToolInputSchema;
  outputSchema: ToolOutputSchema;
  execute(input: ToolInputSchema): Promise<ToolOutputSchema>;
}

export interface EvolutionRecord {
  agentId: string;
  timestamp: number;
  success: boolean;
  returnRate: number;
  weightSnapshot: number;
}

export interface AgentWeight {
  agentId: string;
  weight: number;
  winRate: number;
  avgReturn: number;
  errorCount: number;
  totalDecisions: number;
}