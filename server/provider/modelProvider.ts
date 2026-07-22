import type { AgentName, ProviderMode } from '../../shared/contracts.js';

export interface GenerateJsonInput<T> {
  agent: AgentName;
  systemPrompt: string;
  userPrompt: string;
  fallback: T;
}

export interface ModelProvider {
  readonly mode: ProviderMode;
  generateJson<T>(input: GenerateJsonInput<T>): Promise<T>;
}
