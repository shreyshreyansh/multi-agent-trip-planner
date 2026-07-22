import type { AuditMetrics, AuditRecord } from '../../shared/contracts.js';
import type { AuditRepository, CompletedAuditInput, FailedAuditInput } from './auditRepository.js';

export class InMemoryAuditRepository implements AuditRepository {
  private readonly records: AuditRecord[] = [];

  async recordCompleted(input: CompletedAuditInput): Promise<void> {
    this.records.push({
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  async recordFailed(input: FailedAuditInput): Promise<void> {
    this.records.push({
      id: input.id,
      prompt: input.prompt,
      agents: input.agents,
      providerMode: input.providerMode,
      status: 'failed',
      durationMs: input.durationMs,
      errorCode: input.errorCode,
      createdAt: new Date().toISOString(),
    });
  }

  async list(input: { limit: number }): Promise<AuditRecord[]> {
    return this.records.slice(-Math.min(input.limit, 100)).reverse();
  }

  async metrics(): Promise<AuditMetrics> {
    const totalDuration = this.records.reduce((sum, record) => sum + record.durationMs, 0);
    return {
      totalRequests: this.records.length,
      completedRequests: this.records.filter((record) => record.status === 'complete').length,
      failedRequests: this.records.filter((record) => record.status === 'failed').length,
      fallbackRequests: this.records.filter((record) => record.providerMode === 'fallback').length,
      averageDurationMs: this.records.length === 0 ? 0 : Math.round(totalDuration / this.records.length),
    };
  }
}
