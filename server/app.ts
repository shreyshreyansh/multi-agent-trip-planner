import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler, type RequestHandler } from 'express';
import cors from 'cors';
import { z } from 'zod';
import type { ApiErrorBody } from '../shared/contracts.js';
import { TripOrchestrator } from './orchestrator.js';
import type { ModelProvider } from './provider/modelProvider.js';
import type { AuditRepository } from './repositories/auditRepository.js';
import { AppError } from './utils/errors.js';
import { logger } from './utils/logger.js';

export interface AppDependencies {
  auditRepository: AuditRepository;
  modelProvider: ModelProvider;
}

const planRequestSchema = z
  .object({
    prompt: z.string().trim().min(8).max(1200),
  })
  .strict();

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export function createApp(dependencies: AppDependencies): express.Express {
  const app = express();
  const orchestrator = new TripOrchestrator(dependencies.modelProvider);

  app.use(cors());
  app.use(express.json({ limit: '32kb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true });
  });

  app.post('/api/trips/plan', asyncHandler(async (request, response) => {
    const parsed = planRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError('INVALID_REQUEST', 'Enter a trip request with at least 8 characters.', 400);
    }

    const requestId = randomUUID();
    const startedAt = Date.now();

    try {
      const plan = await orchestrator.planTrip(parsed.data.prompt, requestId);
      await dependencies.auditRepository.recordCompleted({
        id: requestId,
        prompt: parsed.data.prompt,
        agents: plan.agents,
        providerMode: plan.providerMode,
        status: 'complete',
        durationMs: Date.now() - startedAt,
      });
      response.json(plan);
    } catch (error: unknown) {
      await dependencies.auditRepository.recordFailed({
        id: requestId,
        prompt: parsed.data.prompt,
        agents: [],
        providerMode: dependencies.modelProvider.mode,
        errorCode: error instanceof AppError ? error.code : 'TRIP_PLAN_FAILED',
        durationMs: Date.now() - startedAt,
      });
      throw error;
    }
  }));

  app.get('/api/audit', asyncHandler(async (request, response) => {
    const query = auditQuerySchema.parse(request.query);
    response.json({ records: await dependencies.auditRepository.list({ limit: query.limit }) });
  }));

  app.get('/api/metrics', asyncHandler(async (_request, response) => {
    response.json(await dependencies.auditRepository.metrics());
  }));

  app.use(errorHandler);

  return app;
}

function asyncHandler(handler: RequestHandler): RequestHandler {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}

const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof AppError) {
    response.status(error.statusCode).json(toErrorBody(error.code, error.message));
    return;
  }

  if (error instanceof z.ZodError) {
    response.status(400).json(toErrorBody('INVALID_REQUEST', 'Request parameters are invalid.'));
    return;
  }

  logger.error('unhandled_request_error', {
    reason: error instanceof Error ? error.name : 'unknown',
  });
  response.status(500).json(toErrorBody('INTERNAL_ERROR', 'The trip planner could not complete the request.'));
};

function toErrorBody(code: string, message: string): ApiErrorBody {
  return { error: { code, message } };
}
