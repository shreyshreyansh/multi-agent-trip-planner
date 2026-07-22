import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.string().default('development'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta/models'),
  GEMINI_MODEL: z.string().default('gemini-3.6-flash'),
  AUDIT_LOG_PATH: z.string().default('data/audit-log.jsonl'),
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return envSchema.parse(env);
}
