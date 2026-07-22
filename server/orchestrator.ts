import { randomUUID } from 'node:crypto';
import type {
  AgentName,
  AgentTraceEntry,
  BudgetEstimate,
  DestinationRecommendation,
  ItineraryDay,
  ProviderMode,
  TripPlanResponse,
} from '../shared/contracts.js';
import type { ModelProvider } from './provider/modelProvider.js';
import { parseTripRequest } from './requestParser.js';
import { BudgetAgent } from './agents/budgetAgent.js';
import { DestinationAgent } from './agents/destinationAgent.js';
import { ItineraryAgent } from './agents/itineraryAgent.js';

export class TripOrchestrator {
  private readonly destinationAgent = new DestinationAgent();
  private readonly itineraryAgent = new ItineraryAgent();
  private readonly budgetAgent = new BudgetAgent();

  constructor(private readonly modelProvider: ModelProvider) {}

  async planTrip(prompt: string, requestId = randomUUID()): Promise<TripPlanResponse> {
    const constraints = parseTripRequest(prompt);
    const agents: AgentName[] = [];
    const trace: AgentTraceEntry[] = [];
    let providerMode: ProviderMode = this.modelProvider.mode;

    let destination: DestinationRecommendation | undefined;
    if (constraints.wantsDestination || constraints.destinationHint) {
      const result = await this.destinationAgent.recommend(constraints, this.modelProvider);
      destination = result.value;
      agents.push('destination');
      trace.push({
        agent: 'destination',
        status: result.degraded ? 'degraded' : 'complete',
        action: 'Selected destination context',
        notes: destination.justification,
      });
      if (result.degraded) {
        providerMode = 'fallback';
      }
    }

    let itinerary: ItineraryDay[] = [];
    if (constraints.wantsItinerary && destination) {
      const result = await this.itineraryAgent.build(constraints, destination, this.modelProvider);
      itinerary = result.value;
      agents.push('itinerary');
      trace.push({
        agent: 'itinerary',
        status: result.degraded ? 'degraded' : 'complete',
        action: `Built ${itinerary.length} day itinerary`,
        notes: itinerary[0]?.travelTimeNote ?? 'No itinerary was needed for this request.',
      });
      if (result.degraded) {
        providerMode = 'fallback';
      }
    }

    let budget: BudgetEstimate | undefined;
    if (constraints.wantsBudget) {
      const result = await this.budgetAgent.estimate(constraints, destination, itinerary, this.modelProvider);
      budget = result.value;
      agents.push('budget');
      trace.push({
        agent: 'budget',
        status: result.degraded ? 'degraded' : 'complete',
        action: 'Estimated trip cost',
        notes: budget.withinBudget ? 'Estimate stays within the stated budget.' : budget.warning ?? 'Estimate exceeds budget.',
      });
      if (result.degraded) {
        providerMode = 'fallback';
      }
    }

    trace.push({
      agent: 'orchestrator',
      status: providerMode === 'fallback' && this.modelProvider.mode === 'gemini' ? 'degraded' : 'complete',
      action: 'Synthesized final answer',
      notes: 'Combined agent outputs into one response and retained contribution trace.',
    });

    return {
      requestId,
      status: 'complete',
      providerMode,
      agents,
      summary: buildSummary(destination, itinerary, budget),
      destination,
      itinerary,
      budget,
      trace,
      createdAt: new Date().toISOString(),
    };
  }
}

function buildSummary(
  destination: DestinationRecommendation | undefined,
  itinerary: ItineraryDay[],
  budget: BudgetEstimate | undefined,
): string {
  const destinationText = destination ? `${destination.name}, ${destination.country}` : 'the requested destination';
  const itineraryText = itinerary.length > 0 ? `${itinerary.length} planned days` : 'destination guidance only';

  if (budget && !budget.withinBudget) {
    return `${destinationText} is over budget at about ${budget.currency} ${budget.estimatedTotal}. ${budget.cheaperAlternative}`;
  }

  if (budget) {
    return `${destinationText} fits the request with ${itineraryText} and an estimated total of ${budget.currency} ${budget.estimatedTotal}.`;
  }

  return `${destinationText} is the strongest match, with ${itineraryText}.`;
}
