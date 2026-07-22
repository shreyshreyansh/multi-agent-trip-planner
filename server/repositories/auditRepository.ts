import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { AgentName, AuditMetrics, AuditRecord, ProviderMode, RequestStatus } from '../../shared/contracts.js';

export interface CompletedAuditInput {
  id: string;
  prompt: string;
  agents: AgentName[];
  providerMode: ProviderMode;
  status: 'complete';
  durationMs: number;
}

export interface FailedAuditInput {
  id: string;
  prompt: string;
  agents: AgentName[];
  providerMode: ProviderMode;
  errorCode: string;
  durationMs: number;
}

export interface AuditRepository {
  recordCompleted(input: CompletedAuditInput): Promise<void>;
  recordFailed(input: FailedAuditInput): Promise<void>;
  list(input: { limit: number }): Promise<AuditRecord[]>;
  metrics(): Promise<AuditMetrics>;
}

export class FileAuditRepository implements AuditRepository {
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async recordCompleted(input: CompletedAuditInput): Promise<void> {
    await this.appendRecord({
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  async recordFailed(input: FailedAuditInput): Promise<void> {
    await this.appendRecord({
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
    const boundedLimit = Math.min(Math.max(input.limit, 1), 100);
    const records = await this.readRecords();
    return records.slice(-boundedLimit).reverse();
  }

  async metrics(): Promise<AuditMetrics> {
    const records = await this.readRecords();
    const totalDuration = records.reduce((sum, record) => sum + record.durationMs, 0);
    return {
      totalRequests: records.length,
      completedRequests: countByStatus(records, 'complete'),
      failedRequests: countByStatus(records, 'failed'),
      fallbackRequests: records.filter((record) => record.providerMode === 'fallback').length,
      averageDurationMs: records.length === 0 ? 0 : Math.round(totalDuration / records.length),
    };
  }

  private async appendRecord(record: AuditRecord): Promise<void> {
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const existing = await this.readRawFile();
      const next = `${existing}${existing.endsWith('\n') || existing.length === 0 ? '' : '\n'}${JSON.stringify(record)}\n`;
      await writeFile(this.filePath, next, 'utf8');
    });
    await this.writeQueue;
  }

  private async readRecords(): Promise<AuditRecord[]> {
    const raw = await this.readRawFile();
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseRecord)
      .filter((record): record is AuditRecord => record !== null);
  }

  private async readRawFile(): Promise<string> {
    try {
      return await readFile(this.filePath, 'utf8');
    } catch (error: unknown) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }
}

function parseRecord(line: string): AuditRecord | null {
  try {
    const parsed = JSON.parse(line) as Partial<AuditRecord>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.prompt === 'string' &&
      Array.isArray(parsed.agents) &&
      isProviderMode(parsed.providerMode) &&
      isRequestStatus(parsed.status) &&
      typeof parsed.durationMs === 'number' &&
      typeof parsed.createdAt === 'string'
    ) {
      return {
        id: parsed.id,
        prompt: parsed.prompt,
        agents: parsed.agents.filter(isAgentName),
        providerMode: parsed.providerMode,
        status: parsed.status,
        durationMs: parsed.durationMs,
        createdAt: parsed.createdAt,
        errorCode: typeof parsed.errorCode === 'string' ? parsed.errorCode : undefined,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function isAgentName(value: unknown): value is AgentName {
  return value === 'destination' || value === 'itinerary' || value === 'budget';
}

function isProviderMode(value: unknown): value is ProviderMode {
  return value === 'gemini' || value === 'fallback';
}

function isRequestStatus(value: unknown): value is RequestStatus {
  return value === 'complete' || value === 'failed';
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}

function countByStatus(records: AuditRecord[], status: RequestStatus): number {
  return records.filter((record) => record.status === status).length;
}
