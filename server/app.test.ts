import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { InMemoryAuditRepository } from './repositories/inMemoryAuditRepository.js';
import { createDeterministicModelProvider } from './provider/deterministicModelProvider.js';

describe('API app', () => {
  it('plans a trip and writes an audit record', async () => {
    const auditRepository = new InMemoryAuditRepository();
    const app = createApp({
      auditRepository,
      modelProvider: createDeterministicModelProvider(),
    });

    const response = await request(app)
      .post('/api/trips/plan')
      .send({ prompt: 'five day trip somewhere warm in Europe for under 1500 pounds' })
      .expect(200);

    expect(response.body.status).toBe('complete');
    expect(response.body.agents).toEqual(['destination', 'itinerary', 'budget']);

    const audit = await auditRepository.list({ limit: 10 });
    expect(audit).toHaveLength(1);
    expect(audit[0]?.prompt).toContain('five day trip');
  });

  it('rejects empty prompts with a safe validation error', async () => {
    const app = createApp({
      auditRepository: new InMemoryAuditRepository(),
      modelProvider: createDeterministicModelProvider(),
    });

    const response = await request(app).post('/api/trips/plan').send({ prompt: '' }).expect(400);

    expect(response.body.error.code).toBe('INVALID_REQUEST');
  });
});
