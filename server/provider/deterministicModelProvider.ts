import type { ModelProvider } from './modelProvider.js';

export function createDeterministicModelProvider(): ModelProvider {
  return {
    mode: 'fallback',
    async generateJson<T>({ fallback }: { fallback: T }): Promise<T> {
      return fallback;
    },
  };
}
