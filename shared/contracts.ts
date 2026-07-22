export type AgentName = 'destination' | 'itinerary' | 'budget';
export type TraceAgentName = AgentName | 'orchestrator';
export type ProviderMode = 'gemini' | 'fallback';
export type RequestStatus = 'complete' | 'failed';

export interface TripPlanRequest {
  prompt: string;
}

export interface DestinationRecommendation {
  name: string;
  country: string;
  justification: string;
  estimatedDailyCost: number;
  constraintFit: string[];
  cautions: string[];
}

export interface ItineraryDay {
  day: number;
  title: string;
  morning: string;
  afternoon: string;
  evening: string;
  travelTimeNote: string;
  uncertainty?: string;
}

export interface BudgetLineItem {
  label: string;
  amount: number;
}

export interface BudgetEstimate {
  currency: string;
  budgetAmount?: number;
  estimatedTotal: number;
  withinBudget: boolean;
  lineItems: BudgetLineItem[];
  warning?: string;
  cheaperAlternative?: string;
}

export interface AgentTraceEntry {
  agent: TraceAgentName;
  status: 'complete' | 'degraded';
  action: string;
  notes: string;
}

export interface TripPlanResponse {
  requestId: string;
  status: 'complete';
  providerMode: ProviderMode;
  agents: AgentName[];
  summary: string;
  destination?: DestinationRecommendation;
  itinerary: ItineraryDay[];
  budget?: BudgetEstimate;
  trace: AgentTraceEntry[];
  createdAt: string;
}

export interface AuditRecord {
  id: string;
  prompt: string;
  agents: AgentName[];
  providerMode: ProviderMode;
  status: RequestStatus;
  durationMs: number;
  createdAt: string;
  errorCode?: string;
}

export interface AuditMetrics {
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  fallbackRequests: number;
  averageDurationMs: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
