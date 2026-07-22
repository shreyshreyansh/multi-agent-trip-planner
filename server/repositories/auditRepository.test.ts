import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileAuditRepository } from './auditRepository.js';

describe('FileAuditRepository', () => {
  let tempDir: string;
  let repository: FileAuditRepository;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'trip-audit-'));
    repository = new FileAuditRepository(join(tempDir, 'audit.jsonl'));
  });

  afterEach(async () => {
    await rm(tempDir, { force: true, recursive: true });
  });

  it('persists completed request records and returns the newest entries first', async () => {
    await repository.recordCompleted({
      id: 'first',
      prompt: 'warm weekend',
      agents: ['destination'],
      providerMode: 'fallback',
      status: 'complete',
      durationMs: 10,
    });
    await repository.recordCompleted({
      id: 'second',
      prompt: 'five days in Lisbon',
      agents: ['destination', 'itinerary', 'budget'],
      providerMode: 'gemini',
      status: 'complete',
      durationMs: 20,
    });

    const records = await repository.list({ limit: 1 });

    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe('second');
    expect(records[0]?.agents).toEqual(['destination', 'itinerary', 'budget']);
  });

  it('derives bounded metrics from persisted records', async () => {
    await repository.recordCompleted({
      id: 'success',
      prompt: 'Lisbon',
      agents: ['destination'],
      providerMode: 'gemini',
      status: 'complete',
      durationMs: 50,
    });
    await repository.recordFailed({
      id: 'failure',
      prompt: 'broken',
      agents: ['destination'],
      providerMode: 'fallback',
      errorCode: 'MODEL_TIMEOUT',
      durationMs: 150,
    });

    const metrics = await repository.metrics();

    expect(metrics.totalRequests).toBe(2);
    expect(metrics.completedRequests).toBe(1);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.fallbackRequests).toBe(1);
    expect(metrics.averageDurationMs).toBe(100);
  });
});
