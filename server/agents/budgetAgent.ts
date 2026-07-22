import type { BudgetEstimate, BudgetLineItem, DestinationRecommendation, ItineraryDay } from '../../shared/contracts.js';
import type { ModelProvider } from '../provider/modelProvider.js';
import type { TripConstraints } from '../requestParser.js';
import { generateWithFallback, type AgentResult } from './agentUtils.js';

export class BudgetAgent {
  async estimate(
    constraints: TripConstraints,
    destination: DestinationRecommendation | undefined,
    itinerary: ItineraryDay[],
    provider: ModelProvider,
  ): Promise<AgentResult<BudgetEstimate>> {
    const fallback = buildFallbackBudget(constraints, destination, itinerary);
    const result = await generateWithFallback({
      provider,
      agent: 'budget',
      constraints,
      fallback,
      systemPrompt: [
        'You are the Budget Agent for a trip planning system.',
        'Estimate total cost and never silently exceed the user budget.',
        'If the estimate is over budget, flag the overage and propose a cheaper alternative.',
        'Return JSON matching this shape:',
        '{ "currency": string, "budgetAmount"?: number, "estimatedTotal": number, "withinBudget": boolean, "lineItems": { "label": string, "amount": number }[], "warning"?: string, "cheaperAlternative"?: string }',
      ].join('\n'),
    });

    return {
      value: enforceBudgetHonesty(result.value, fallback, constraints),
      degraded: result.degraded,
    };
  }
}

function buildFallbackBudget(
  constraints: TripConstraints,
  destination: DestinationRecommendation | undefined,
  itinerary: ItineraryDay[],
): BudgetEstimate {
  const days = itinerary.length || constraints.tripLengthDays || 3;
  const accommodationPerDay = constraints.style === 'luxury' ? 220 : constraints.style === 'budget' ? 65 : 105;
  const destinationDailyCost = destination?.estimatedDailyCost ?? accommodationPerDay;
  const flightCost = destination?.name === 'Reykjavik' ? 360 : destination?.name === 'Madeira' ? 260 : 190;
  const activitiesPerDay = constraints.style === 'luxury' ? 85 : 38;
  const lineItems: BudgetLineItem[] = [
    { label: 'Return travel estimate', amount: flightCost },
    { label: `${days} nights accommodation and local transport`, amount: Math.round(days * destinationDailyCost) },
    { label: 'Food and activities buffer', amount: Math.round(days * activitiesPerDay) },
  ];
  const estimatedTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
  const withinBudget = constraints.budgetAmount ? estimatedTotal <= constraints.budgetAmount : true;
  const overage = constraints.budgetAmount ? estimatedTotal - constraints.budgetAmount : 0;

  return {
    currency: constraints.currency,
    budgetAmount: constraints.budgetAmount,
    estimatedTotal,
    withinBudget,
    lineItems,
    warning: withinBudget
      ? undefined
      : `Estimated total is ${constraints.currency} ${overage} over the stated budget.`,
    cheaperAlternative: withinBudget
      ? undefined
      : 'Shorten the trip, switch to a self-catering stay, or choose Madeira/Valencia instead of a high-cost destination.',
  };
}

function enforceBudgetHonesty(
  candidate: BudgetEstimate,
  fallback: BudgetEstimate,
  constraints: TripConstraints,
): BudgetEstimate {
  if (!constraints.budgetAmount) {
    return { ...candidate, withinBudget: true };
  }

  const estimatedTotal = Number.isFinite(candidate.estimatedTotal) ? candidate.estimatedTotal : fallback.estimatedTotal;
  const withinBudget = estimatedTotal <= constraints.budgetAmount;

  if (withinBudget) {
    return {
      ...candidate,
      currency: candidate.currency || constraints.currency,
      budgetAmount: constraints.budgetAmount,
      estimatedTotal,
      withinBudget,
    };
  }

  return {
    ...candidate,
    currency: candidate.currency || constraints.currency,
    budgetAmount: constraints.budgetAmount,
    estimatedTotal,
    withinBudget: false,
    warning:
      candidate.warning ??
      `Estimated total is ${constraints.currency} ${estimatedTotal - constraints.budgetAmount} over the stated budget.`,
    cheaperAlternative:
      candidate.cheaperAlternative ??
      fallback.cheaperAlternative ??
      'Shorten the trip or choose a lower-cost destination before booking.',
  };
}
