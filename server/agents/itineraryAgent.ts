import type { DestinationRecommendation, ItineraryDay } from '../../shared/contracts.js';
import type { ModelProvider } from '../provider/modelProvider.js';
import type { TripConstraints } from '../requestParser.js';
import { generateWithFallback, type AgentResult } from './agentUtils.js';

export class ItineraryAgent {
  async build(
    constraints: TripConstraints,
    destination: DestinationRecommendation,
    provider: ModelProvider,
  ): Promise<AgentResult<ItineraryDay[]>> {
    const fallback = buildFallbackItinerary(constraints, destination);
    const result = await generateWithFallback({
      provider,
      agent: 'itinerary',
      constraints,
      fallback,
      systemPrompt: [
        'You are the Itinerary Agent for a trip planning system.',
        'Build realistic day-by-day plans for the selected destination.',
        'Keep sequencing and travel time realistic. Say when uncertain.',
        'Return only a JSON array of days matching this shape:',
        '{ "day": number, "title": string, "morning": string, "afternoon": string, "evening": string, "travelTimeNote": string, "uncertainty"?: string }[]',
        `Selected destination: ${destination.name}, ${destination.country}`,
      ].join('\n'),
    });

    return {
      value: normalizeDayCount(result.value, fallback, constraints.tripLengthDays ?? 0),
      degraded: result.degraded,
    };
  }
}

function buildFallbackItinerary(
  constraints: TripConstraints,
  destination: DestinationRecommendation,
): ItineraryDay[] {
  const days = constraints.tripLengthDays ?? 0;
  if (days <= 0) {
    return [];
  }

  return Array.from({ length: days }, (_, index) => {
    const day = index + 1;
    if (destination.name === 'Reykjavik') {
      return buildIcelandDay(day);
    }
    if (destination.name === 'Madeira') {
      return buildMadeiraDay(day);
    }
    if (destination.name === 'Valencia') {
      return buildValenciaDay(day);
    }
    return buildLisbonDay(day);
  });
}

function buildLisbonDay(day: number): ItineraryDay {
  const templates = [
    ['Arrival and Baixa', 'Arrive, check in, and walk Baixa.', 'Explore Chiado and viewpoints.', 'Dinner in Bairro Alto.'],
    ['Alfama and riverfront', 'Visit Alfama before crowds.', 'Tram or walk toward Praca do Comercio.', 'Fado dinner if available.'],
    ['Belem', 'Visit Jeronimos exterior and Belem Tower area.', 'LX Factory or MAAT depending on energy.', 'Seafood dinner near Cais do Sodre.'],
    ['Sintra light day', 'Early train to Sintra.', 'Pick one palace, not three.', 'Return to Lisbon for a low-key evening.'],
    ['Markets and final walk', 'Time Out Market or local cafe start.', 'Tile Museum or park time.', 'Pack and airport transfer.'],
  ];
  return dayFromTemplate(day, templates[(day - 1) % templates.length], 'Keep each day clustered; most transfers are 20-45 minutes.');
}

function buildValenciaDay(day: number): ItineraryDay {
  const templates = [
    ['Old town and arrival', 'Settle in near the old town.', 'Cathedral, market, and shaded plazas.', 'Tapas in Ruzafa.'],
    ['Beach day', 'Bus or tram to Malvarrosa beach.', 'Long lunch by the water.', 'Sunset walk at the marina.'],
    ['City of Arts and Sciences', 'Visit the complex early.', 'Turia Gardens by bike.', 'Paella dinner.'],
  ];
  return dayFromTemplate(day, templates[(day - 1) % templates.length], 'The beach and old town are separate zones; avoid bouncing between them.');
}

function buildMadeiraDay(day: number): ItineraryDay {
  const templates = [
    ['Funchal base', 'Explore Funchal market and old town.', 'Cable car or botanical garden.', 'Dinner near the marina.'],
    ['Coastal viewpoints', 'Short transfer to Cabo Girao.', 'Camara de Lobos lunch.', 'Return before dark on mountain roads.'],
    ['Levada walk', 'Choose one maintained levada route.', 'Cafe stop and rest.', 'Simple dinner near the hotel.'],
  ];
  return dayFromTemplate(day, templates[(day - 1) % templates.length], 'Mountain roads slow transfers; keep one major outing per day.');
}

function buildIcelandDay(day: number): ItineraryDay {
  const templates = [
    ['Reykjavik arrival', 'Arrive and recover from travel.', 'Walk central Reykjavik.', 'Early dinner; prices are high.'],
    ['Golden Circle', 'Thingvellir, Geysir, and Gullfoss.', 'One geothermal stop if time allows.', 'Return to Reykjavik.'],
    ['South Coast', 'Waterfalls and black sand beach.', 'Long driving day with weather dependency.', 'Simple hotel dinner.'],
  ];
  return dayFromTemplate(day, templates[(day - 1) % templates.length], 'Driving time and weather are uncertain; keep slack in the day.');
}

function dayFromTemplate(day: number, template: string[] | undefined, travelTimeNote: string): ItineraryDay {
  const [title, morning, afternoon, evening] = template ?? ['Flexible day', 'Slow start.', 'One local activity.', 'Low-key dinner.'];
  return { day, title, morning, afternoon, evening, travelTimeNote };
}

function normalizeDayCount(candidate: ItineraryDay[], fallback: ItineraryDay[], expectedDays: number): ItineraryDay[] {
  if (expectedDays <= 0) {
    return [];
  }
  if (!Array.isArray(candidate) || candidate.length !== expectedDays) {
    return fallback;
  }
  return candidate.map((day, index) => ({ ...day, day: index + 1 }));
}
