import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { AgentName, AuditMetrics, AuditRecord, TripPlanResponse } from '../shared/contracts.js';
import { fetchAudit, fetchMetrics, planTrip } from './lib/api.js';
import './styles.css';

const initialPrompt = 'five day trip somewhere warm in Europe for under 1500 pounds';
const agentLabels: Record<AgentName, string> = {
  destination: 'Destination Agent',
  itinerary: 'Itinerary Agent',
  budget: 'Budget Agent',
};
const defaultAgents: AgentName[] = ['destination', 'itinerary', 'budget'];

export default function App(): JSX.Element {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [plan, setPlan] = useState<TripPlanResponse | null>(null);
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>([]);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    void refreshAuditData();
  }, []);

  const activeAgents = useMemo(() => plan?.agents ?? defaultAgents, [plan]);

  async function refreshAuditData(): Promise<void> {
    const [nextMetrics, nextAudit] = await Promise.all([fetchMetrics(), fetchAudit()]);
    setMetrics(nextMetrics);
    setAuditRecords(nextAudit);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const nextPlan = await planTrip(prompt);
      setPlan(nextPlan);
      await refreshAuditData();
    } catch (error: unknown) {
      setErrorMessage(error instanceof Error ? error.message : 'The trip planner could not complete the request.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace" aria-labelledby="workspace-title">
        <div className="workspace__header">
          <div>
            <p className="eyebrow">Cross-collaborative AI platform take-home</p>
            <h1 id="workspace-title">Multi-Agent Trip Planner</h1>
          </div>
          <ProviderBadge providerMode={plan?.providerMode} />
        </div>

        <form className="planner-form" onSubmit={(event) => void handleSubmit(event)}>
          <label htmlFor="trip-request">Trip request</label>
          <textarea
            id="trip-request"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            rows={5}
            maxLength={1200}
          />
          <div className="form-actions">
            <button type="submit" disabled={isLoading || prompt.trim().length < 8}>
              {isLoading ? 'Planning...' : 'Plan trip'}
            </button>
            <span aria-live="polite">{isLoading ? 'Agents are coordinating the answer.' : `${prompt.length}/1200`}</span>
          </div>
        </form>

        {errorMessage ? (
          <div className="error-panel" role="alert">
            {errorMessage}
          </div>
        ) : null}

        <AgentActivity agents={activeAgents} isLoading={isLoading} plan={plan} />
        <PlanResult plan={plan} />
      </section>

      <aside className="audit-panel" aria-label="Audit and metrics">
        <MetricsPanel metrics={metrics} />
        <AuditList records={auditRecords} />
      </aside>
    </main>
  );
}

function ProviderBadge({ providerMode }: { providerMode?: string }): JSX.Element {
  const label = providerMode === 'gemini' ? 'Gemini active' : providerMode === 'fallback' ? 'Fallback mode' : 'Ready';
  return <span className={`provider-badge provider-badge--${providerMode ?? 'ready'}`}>{label}</span>;
}

function AgentActivity({
  agents,
  isLoading,
  plan,
}: {
  agents: AgentName[];
  isLoading: boolean;
  plan: TripPlanResponse | null;
}): JSX.Element {
  return (
    <section className="agent-strip" aria-label="Agent activity">
      {agents.map((agent) => (
        <div className="agent-chip" key={agent}>
          <span className={`agent-dot ${isLoading ? 'agent-dot--running' : 'agent-dot--complete'}`} />
          <span>{agentLabels[agent]}</span>
        </div>
      ))}
      {plan?.trace.map((entry) => (
        <div className="trace-row" key={`${entry.agent}-${entry.action}`}>
          <strong>{entry.agent === 'orchestrator' ? 'Orchestrator' : agentLabels[entry.agent]}</strong>
          <span>{entry.action}</span>
        </div>
      ))}
    </section>
  );
}

function PlanResult({ plan }: { plan: TripPlanResponse | null }): JSX.Element {
  if (!plan) {
    return (
      <section className="empty-result" aria-label="Result preview">
        <h2>Awaiting request</h2>
        <p>Submit a natural-language trip request to see the orchestrated answer and contribution trace.</p>
      </section>
    );
  }

  return (
    <section className="result-grid" aria-label="Trip plan result">
      <article className="result-card result-card--wide">
        <h2>{plan.summary}</h2>
        {plan.destination ? (
          <div className="destination-detail">
            <h3>
              {plan.destination.name}, {plan.destination.country}
            </h3>
            <p>{plan.destination.justification}</p>
            <div className="tag-row">
              {plan.destination.constraintFit.map((fit) => (
                <span key={fit}>{fit}</span>
              ))}
            </div>
          </div>
        ) : null}
      </article>

      {plan.budget ? (
        <article className={`result-card budget-card ${plan.budget.withinBudget ? 'budget-card--ok' : 'budget-card--warn'}`}>
          <h3>Budget check</h3>
          <p className="budget-total">
            {plan.budget.currency} {plan.budget.estimatedTotal}
          </p>
          <p>{plan.budget.withinBudget ? 'Within the stated budget.' : plan.budget.warning}</p>
          {plan.budget.cheaperAlternative ? <p>{plan.budget.cheaperAlternative}</p> : null}
          <ul>
            {plan.budget.lineItems.map((item) => (
              <li key={item.label}>
                <span>{item.label}</span>
                <strong>
                  {plan.budget?.currency} {item.amount}
                </strong>
              </li>
            ))}
          </ul>
        </article>
      ) : null}

      {plan.itinerary.length > 0 ? (
        <article className="result-card result-card--wide">
          <h3>Day-by-day plan</h3>
          <div className="itinerary-list">
            {plan.itinerary.map((day) => (
              <section key={day.day} className="itinerary-day">
                <h4>
                  Day {day.day}: {day.title}
                </h4>
                <p>{day.morning}</p>
                <p>{day.afternoon}</p>
                <p>{day.evening}</p>
                <small>{day.travelTimeNote}</small>
              </section>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}

function MetricsPanel({ metrics }: { metrics: AuditMetrics | null }): JSX.Element {
  const items = [
    ['Total', metrics?.totalRequests ?? 0],
    ['Complete', metrics?.completedRequests ?? 0],
    ['Fallback', metrics?.fallbackRequests ?? 0],
    ['Avg ms', metrics?.averageDurationMs ?? 0],
  ];

  return (
    <section className="metrics-panel">
      <h2>Metrics</h2>
      <div className="metric-grid">
        {items.map(([label, value]) => (
          <div className="metric" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function AuditList({ records }: { records: AuditRecord[] }): JSX.Element {
  return (
    <section className="audit-list">
      <h2>Audit trail</h2>
      {records.length === 0 ? <p>No requests yet.</p> : null}
      {records.map((record) => (
        <article className="audit-item" key={record.id}>
          <div>
            <strong>{record.prompt}</strong>
            <span>{new Date(record.createdAt).toLocaleString()}</span>
          </div>
          <div className="audit-meta">
            <span>{record.status}</span>
            <span>{record.providerMode}</span>
            <span>{record.agents.map((agent) => agentLabels[agent]).join(', ')}</span>
          </div>
        </article>
      ))}
    </section>
  );
}
