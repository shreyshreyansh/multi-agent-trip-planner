import type { DestinationRecommendation } from '../../shared/contracts.js';
import type { ModelProvider } from '../provider/modelProvider.js';
import type { TripConstraints } from '../requestParser.js';
import { generateWithFallback, type AgentResult } from './agentUtils.js';

export class DestinationAgent {
  async recommend(
    constraints: TripConstraints,
    provider: ModelProvider,
  ): Promise<AgentResult<DestinationRecommendation>> {
    const fallback = buildFallbackDestination(constraints);
    const result = await generateWithFallback({
      provider,
      agent: 'destination',
      constraints,
      fallback,
      systemPrompt: [
        'You are the Destination Agent for a trip planning system.',
        'Recommend one destination that fits the user constraints.',
        'Never recommend a destination that violates a hard budget, climate, region, or explicit preference.',
        'Return JSON matching this TypeScript shape:',
        '{ "name": string, "country": string, "justification": string, "estimatedDailyCost": number, "constraintFit": string[], "cautions": string[] }',
      ].join('\n'),
    });

    return {
      value: enforceHardConstraints(result.value, fallback, constraints),
      degraded: result.degraded,
    };
  }
}

function buildFallbackDestination(constraints: TripConstraints): DestinationRecommendation {
  if (constraints.destinationHint === 'iceland') {
    const budgetTooLowForLuxury = constraints.style === 'luxury' && Number(constraints.budgetAmount ?? 0) < 1400;
    if (budgetTooLowForLuxury) {
      return {
        name: 'Madeira',
        country: 'Portugal',
        justification:
          'Madeira keeps the island scenery brief while fitting a lower budget better than a luxury Iceland trip.',
        estimatedDailyCost: 105,
        constraintFit: ['island scenery', 'shorter flights from the UK', 'lower accommodation costs'],
        cautions: ['This changes the requested Iceland destination because the stated luxury budget is too low.'],
      };
    }

    return {
      name: 'Reykjavik',
      country: 'Iceland',
      justification: 'Reykjavik fits the explicit Iceland preference and gives access to day trips without hotel moves.',
      estimatedDailyCost: constraints.style === 'luxury' ? 260 : 155,
      constraintFit: ['explicit Iceland preference', 'nature access', 'realistic day trips'],
      cautions: ['Iceland is expensive; budget pressure should be checked carefully.'],
    };
  }

  if (constraints.interests.includes('beaches') && Number(constraints.budgetAmount ?? 0) <= 900) {
    return {
      name: 'Valencia',
      country: 'Spain',
      justification: 'Valencia is warm, coastal, walkable, and usually cheaper than island beach destinations.',
      estimatedDailyCost: 82,
      constraintFit: ['warm climate', 'beach access', 'Europe', 'budget-aware'],
      cautions: ['Peak summer accommodation can push costs up.'],
    };
  }

  return {
    name: constraints.destinationHint === 'porto' ? 'Porto' : 'Lisbon',
    country: 'Portugal',
    justification: 'Lisbon fits a warm European trip with strong food, culture, and transit options under a midrange budget.',
    estimatedDailyCost: 95,
    constraintFit: ['warm climate', 'Europe', 'food and culture', 'budget band'],
    cautions: ['Book central accommodation early to avoid late price spikes.'],
  };
}

function enforceHardConstraints(
  candidate: DestinationRecommendation,
  fallback: DestinationRecommendation,
  constraints: TripConstraints,
): DestinationRecommendation {
  if (constraints.region === 'Europe' && !['Portugal', 'Spain', 'Iceland', 'Greece'].includes(candidate.country)) {
    return fallback;
  }

  if (constraints.budgetAmount && constraints.tripLengthDays) {
    const roughTripCost = candidate.estimatedDailyCost * constraints.tripLengthDays + 220;
    if (roughTripCost > constraints.budgetAmount * 1.1) {
      return fallback;
    }
  }

  return candidate;
}
