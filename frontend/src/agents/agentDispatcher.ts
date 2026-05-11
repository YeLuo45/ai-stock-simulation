/**
 * Agent Dispatcher
 * Routes messages to the appropriate agent based on the `to` field
 */

import type { AgentMessage, AgentName } from './messages';
import { createAgentMessage } from './messages';
import { SelectorAgent } from './SelectorAgent';
import { BacktesterAgent } from './BacktesterAgent';
import { RiskControllerAgent } from './RiskControllerAgent';
import { ExecutorAgent } from './ExecutorAgent';

export type AgentProcessor = (message: AgentMessage) => Promise<AgentMessage>;

const AGENT_PROCESSORS: Record<AgentName, AgentProcessor> = {
  selector: async (msg: AgentMessage) => SelectorAgent.process(msg),
  backtester: async (msg: AgentMessage) => BacktesterAgent.process(msg),
  risk: async (msg: AgentMessage) => RiskControllerAgent.process(msg),
  executor: async (msg: AgentMessage) => ExecutorAgent.process(msg),
};

export function dispatch(message: AgentMessage): Promise<AgentMessage> {
  if (message.to === 'broadcast') {
    const agents: AgentName[] = ['selector', 'backtester', 'risk', 'executor'];
    let lastResult: AgentMessage = message;
    for (const agent of agents) {
      lastResult = dispatch({ ...message, to: agent }) as Promise<AgentMessage> as AgentMessage;
    }
    return Promise.resolve(lastResult);
  }

  const processor = AGENT_PROCESSORS[message.to];
  if (!processor) {
    return Promise.resolve(
      createAgentMessage(
        'supervisor',
        message.from as AgentName,
        'error',
        { error: `Unknown agent: ${message.to}` },
        message.traceId
      )
    );
  }

  return processor(message);
}

export function dispatchAsync(message: AgentMessage): Promise<AgentMessage> {
  return dispatch(message);
}
