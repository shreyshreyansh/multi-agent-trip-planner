// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.js';

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('submits a trip request and renders agent transparency plus audit history', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/api/metrics')) {
        return jsonResponse({ totalRequests: 1, completedRequests: 1, failedRequests: 0, fallbackRequests: 0, averageDurationMs: 42 });
      }
      if (url.endsWith('/api/audit?limit=8')) {
        return jsonResponse({
          records: [
            {
              id: 'audit-1',
              prompt: 'five day warm Europe trip',
              agents: ['destination', 'itinerary', 'budget'],
              providerMode: 'fallback',
              status: 'complete',
              durationMs: 42,
              createdAt: '2026-07-22T10:00:00.000Z',
            },
          ],
        });
      }
      if (url.endsWith('/api/trips/plan')) {
        return jsonResponse({
          requestId: 'plan-1',
          status: 'complete',
          providerMode: 'fallback',
          agents: ['destination', 'itinerary', 'budget'],
          summary: 'Lisbon fits the request.',
          destination: {
            name: 'Lisbon',
            country: 'Portugal',
            justification: 'Warm and budget-aware.',
            estimatedDailyCost: 95,
            constraintFit: ['warm climate'],
            cautions: [],
          },
          itinerary: [],
          budget: {
            currency: 'GBP',
            budgetAmount: 1500,
            estimatedTotal: 1000,
            withinBudget: true,
            lineItems: [{ label: 'Travel', amount: 200 }],
          },
          trace: [
            { agent: 'destination', status: 'complete', action: 'Selected destination context', notes: 'Warm.' },
            { agent: 'budget', status: 'complete', action: 'Estimated trip cost', notes: 'Within budget.' },
          ],
          createdAt: '2026-07-22T10:00:00.000Z',
        });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<App />);

    fireEvent.change(screen.getByLabelText(/trip request/i), {
      target: { value: 'five day warm Europe trip under 1500 pounds' },
    });
    fireEvent.click(screen.getByRole('button', { name: /plan trip/i }));

    await waitFor(() => expect(screen.getByText('Lisbon fits the request.')).toBeInTheDocument());
    expect(screen.getAllByText(/Destination Agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Budget Agent/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/five day warm Europe trip/i).length).toBeGreaterThan(0);
  });
});

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
