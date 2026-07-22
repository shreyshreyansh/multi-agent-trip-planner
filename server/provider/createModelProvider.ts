import type { AppConfig } from '../config.js';
import { createDeterministicModelProvider } from './deterministicModelProvider.js';
import { GeminiModelProvider } from './geminiModelProvider.js';
import type { ModelProvider } from './modelProvider.js';

export function createModelProvider(config: AppConfig): ModelProvider {
  if (!config.GEMINI_API_KEY) {
    return createDeterministicModelProvider();
  }

  return new GeminiModelProvider(config);
}
