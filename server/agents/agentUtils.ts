import type { AgentName } from '../../shared/contracts.js';
import type { TripConstraints } from '../requestParser.js';
import { logger } from '../utils/logger.js';
import type { ModelProvider } from '../provider/modelProvider.js';

export interface AgentResult<T> {
  value: T;
  degraded: boolean;
}

export async function generateWithFallback<T>(input: {
  provider: ModelProvider;
  agent: AgentName;
  constraints: TripConstraints;
  systemPrompt: string;
  fallback: T;
}): Promise<AgentResult<T>> {
  if (input.provider.mode === 'fallback') {
    return { value: input.fallback, degraded: false };
  }

  try {
    const value = await input.provider.generateJson<T>({
      agent: input.agent,
      systemPrompt: input.systemPrompt,
      userPrompt: input.constraints.prompt,
      fallback: input.fallback,
    });
    return { value, degraded: false };
  } catch (error: unknown) {
    logger.warn('agent_provider_fallback', {
      agent: input.agent,
      reason: error instanceof Error ? error.name : 'unknown',
    });
    return { value: input.fallback, degraded: true };
  }
}
