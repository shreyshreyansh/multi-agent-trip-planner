import { describe, expect, it } from 'vitest';
import { createDeterministicModelProvider } from './provider/deterministicModelProvider.js';
import { TripOrchestrator } from './orchestrator.js';

describe('TripOrchestrator', () => {
  it('chains all three agents and exposes their contributions for an open-ended budgeted trip', async () => {
    const orchestrator = new TripOrchestrator(createDeterministicModelProvider());

    const result = await orchestrator.planTrip('five day trip somewhere warm in Europe for under 1500 pounds');

    expect(result.agents).toEqual(['destination', 'itinerary', 'budget']);
    expect(result.destination?.name).toBeTruthy();
    expect(result.itinerary).toHaveLength(5);
    expect(result.budget?.withinBudget).toBe(true);
    expect(result.trace.map((entry) => entry.agent)).toEqual(['destination', 'itinerary', 'budget', 'orchestrator']);
  });

  it('never silently exceeds a hard budget and proposes a cheaper alternative', async () => {
    const orchestrator = new TripOrchestrator(createDeterministicModelProvider());

    const result = await orchestrator.planTrip('plan a seven day luxury Iceland trip under 600 pounds');

    expect(result.agents).toContain('budget');
    expect(result.budget?.withinBudget).toBe(false);
    expect(result.budget?.cheaperAlternative?.toLowerCase()).toContain('shorten');
    expect(result.summary.toLowerCase()).toContain('over budget');
  });

  it('routes a destination-only query to the destination agent without inventing itinerary days', async () => {
    const orchestrator = new TripOrchestrator(createDeterministicModelProvider());

    const result = await orchestrator.planTrip('suggest warm beach destinations in Europe under 900 pounds');

    expect(result.agents).toEqual(['destination', 'budget']);
    expect(result.destination?.justification).toContain('warm');
    expect(result.itinerary).toHaveLength(0);
  });
});
