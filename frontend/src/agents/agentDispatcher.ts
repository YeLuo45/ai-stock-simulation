/**
 * Agent Dispatcher
 * Routes messages to the appropriate agent based on the `to` field via MessageBus
 */

import type { AgentMessage, AgentName } from './messages';
import { createAgentMessage } from './messages';
import { messageBus } from './MessageBus';
import { SelectorAgent } from './SelectorAgent';
import { BacktesterAgent } from './BacktesterAgent';
import { RiskControllerAgent } from './RiskControllerAgent';
import { ExecutorAgent } from './ExecutorAgent';
import { DataResearcherAgent } from './DataResearcherAgent';
import { BullDebaterAgent } from './BullDebaterAgent';
import { BearDebaterAgent } from './BearDebaterAgent';
import { JudgeAgent } from './JudgeAgent';
import { newsResearcherAgent } from './NewsResearcherAgent';

export type AgentProcessor = (message: AgentMessage) => Promise<AgentMessage>;

// Adapter for DataResearcherAgent (class-based)
const researchAdapter: AgentProcessor = async (msg: AgentMessage) => {
  const agent = DataResearcherAgent.getInstance();
  const payload = msg.payload as { stockCode: string; dataTypes?: string[] };
  const result = await agent.research(payload.stockCode, payload.dataTypes as any);
  return createAgentMessage('research', msg.from as AgentName, 'response', result, msg.traceId);
};

// Adapter for NewsResearcherAgent (class-based)
const newsAdapter: AgentProcessor = async (msg: AgentMessage) => {
  const payload = msg.payload as { stockCode: string; keyword?: string };
  const result = await newsResearcherAgent.research(payload.stockCode, payload.keyword);
  return createAgentMessage('news', msg.from as AgentName, 'response', result, msg.traceId);
};

const AGENT_PROCESSORS: Record<string, AgentProcessor> = {
  selector: async (msg: AgentMessage) => SelectorAgent.process(msg),
  backtester: async (msg: AgentMessage) => BacktesterAgent.process(msg),
  risk: async (msg: AgentMessage) => RiskControllerAgent.process(msg),
  executor: async (msg: AgentMessage) => ExecutorAgent.process(msg),
  research: researchAdapter,
  bull: async (msg: AgentMessage) => BullDebaterAgent.process(msg),
  bear: async (msg: AgentMessage) => BearDebaterAgent.process(msg),
  judge: async (msg: AgentMessage) => JudgeAgent.process(msg),
  news: newsAdapter,
  // Aliases for bull_debater/bear_debater
  bull_debater: async (msg: AgentMessage) => BullDebaterAgent.process(msg),
  bear_debater: async (msg: AgentMessage) => BearDebaterAgent.process(msg),
};

/**
 * Dispatch a message to the appropriate agent via MessageBus
 */
export async function dispatch(message: AgentMessage): Promise<AgentMessage> {
  // If broadcast, dispatch to all agents
  if (message.to === 'broadcast') {
    const agents: AgentName[] = ['selector', 'backtester', 'risk', 'executor', 'research', 'bull', 'bear', 'judge', 'news'];
    let lastResult: AgentMessage = message;
    for (const agent of agents) {
      const broadcastMsg = { ...message, to: agent } as AgentMessage;
      lastResult = await dispatch(broadcastMsg);
    }
    return lastResult;
  }

  const processor = AGENT_PROCESSORS[message.to as string];
  if (!processor) {
    const errorMsg = createAgentMessage(
      'supervisor',
      message.from as AgentName,
      'error',
      { error: `Unknown agent: ${message.to}` },
      message.traceId
    );
    messageBus.publish(errorMsg);
    return errorMsg as unknown as AgentMessage;
  }

  try {
    // Process the message
    const result = await processor(message);
    
    // Publish result back via MessageBus
    messageBus.publish(result);
    
    return result;
  } catch (error) {
    const errorMessage = createAgentMessage(
      'supervisor',
      message.from as AgentName,
      'error',
      { error: error instanceof Error ? error.message : 'Unknown error' },
      message.traceId
    );
    messageBus.publish(errorMessage);
    return errorMessage as unknown as AgentMessage;
  }
}

/**
 * Dispatch a message asynchronously via MessageBus
 */
export function dispatchAsync(message: AgentMessage): void {
  // Publish to MessageBus for async routing
  messageBus.publish(message);
  
  // Also process asynchronously
  dispatch(message).catch(err => {
    console.error('[AgentDispatcher] Async dispatch error:', err);
  });
}

/**
 * Register an agent with the dispatcher
 */
export function registerAgent(name: AgentName, processor: AgentProcessor): void {
  AGENT_PROCESSORS[name] = processor;
}

/**
 * Unregister an agent
 */
export function unregisterAgent(name: AgentName): void {
  delete AGENT_PROCESSORS[name];
}
