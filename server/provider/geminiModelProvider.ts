import type { AppConfig } from '../config.js';
import { ModelProviderError } from '../utils/errors.js';
import type { GenerateJsonInput, ModelProvider } from './modelProvider.js';

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

export class GeminiModelProvider implements ModelProvider {
  readonly mode = 'gemini' as const;

  constructor(
    private readonly config: Pick<AppConfig, 'GEMINI_API_KEY' | 'GEMINI_API_BASE_URL' | 'GEMINI_MODEL'>,
    private readonly timeoutMs = 12000,
  ) {}

  async generateJson<T>(input: GenerateJsonInput<T>): Promise<T> {
    if (!this.config.GEMINI_API_KEY) {
      throw new ModelProviderError('MISSING_GEMINI_API_KEY', 'Gemini API key is not configured.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(
        `${this.config.GEMINI_API_BASE_URL}/${this.config.GEMINI_MODEL}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.GEMINI_API_KEY,
          },
          body: JSON.stringify({
            contents: [
              {
                role: 'user',
                parts: [
                  {
                    text: [
                      input.systemPrompt,
                      'Return only valid JSON. Do not include markdown fences.',
                      `User request: ${input.userPrompt}`,
                    ].join('\n\n'),
                  },
                ],
              },
            ],
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new ModelProviderError('GEMINI_REQUEST_FAILED', `Gemini request failed with ${response.status}.`);
      }

      const payload = (await response.json()) as GeminiResponse;
      const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim();
      if (!text) {
        throw new ModelProviderError('GEMINI_EMPTY_RESPONSE', 'Gemini returned no text.');
      }

      return parseJson<T>(text);
    } catch (error: unknown) {
      if (error instanceof ModelProviderError) {
        throw error;
      }
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ModelProviderError('GEMINI_TIMEOUT', 'Gemini request timed out.');
      }
      throw new ModelProviderError('GEMINI_UNEXPECTED_ERROR', 'Gemini request failed unexpectedly.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

function parseJson<T>(text: string): T {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new ModelProviderError('GEMINI_INVALID_JSON', 'Gemini returned invalid JSON.');
  }
}
