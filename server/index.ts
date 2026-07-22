import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createModelProvider } from './provider/createModelProvider.js';
import { FileAuditRepository } from './repositories/auditRepository.js';
import { logger } from './utils/logger.js';

const config = loadConfig();
const app = createApp({
  auditRepository: new FileAuditRepository(config.AUDIT_LOG_PATH),
  modelProvider: createModelProvider(config),
});

const clientDistPath = join(process.cwd(), 'dist/client');
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (_request, response) => {
    response.sendFile(join(clientDistPath, 'index.html'));
  });
}

app.listen(config.PORT, () => {
  logger.info('server_started', {
    port: config.PORT,
    provider: config.GEMINI_API_KEY ? 'gemini' : 'fallback',
  });
});
