export interface TripConstraints {
  prompt: string;
  normalizedPrompt: string;
  tripLengthDays?: number;
  budgetAmount?: number;
  currency: string;
  region?: string;
  climate?: 'warm' | 'cold' | 'mixed';
  destinationHint?: string;
  interests: string[];
  style: 'budget' | 'standard' | 'luxury';
  wantsDestination: boolean;
  wantsItinerary: boolean;
  wantsBudget: boolean;
}

const numberWords = new Map<string, number>([
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
]);

export function parseTripRequest(prompt: string): TripConstraints {
  const normalizedPrompt = prompt.toLowerCase().replace(/\s+/g, ' ').trim();
  const tripLengthDays = extractTripLength(normalizedPrompt);
  const budget = extractBudget(normalizedPrompt);
  const destinationHint = extractDestinationHint(normalizedPrompt);

  const wantsDestination =
    /\b(suggest|somewhere|destination|where|warm|beach|europe)\b/.test(normalizedPrompt) || !destinationHint;
  const wantsItinerary = /\b(plan|itinerary|day by day|days?|weekend)\b/.test(normalizedPrompt) && Boolean(tripLengthDays);
  const wantsBudget = Boolean(budget.amount) || wantsItinerary;

  return {
    prompt,
    normalizedPrompt,
    tripLengthDays,
    budgetAmount: budget.amount,
    currency: budget.currency,
    region: /\beurope\b/.test(normalizedPrompt) ? 'Europe' : undefined,
    climate: /\bwarm|sun|beach|mild\b/.test(normalizedPrompt)
      ? 'warm'
      : /\bcold|snow|winter|iceland\b/.test(normalizedPrompt)
        ? 'cold'
        : undefined,
    destinationHint,
    interests: extractInterests(normalizedPrompt),
    style: /\bluxury|five star|5-star\b/.test(normalizedPrompt)
      ? 'luxury'
      : /\bbudget|cheap|low cost|affordable\b/.test(normalizedPrompt)
        ? 'budget'
        : 'standard',
    wantsDestination,
    wantsItinerary,
    wantsBudget,
  };
}

function extractTripLength(prompt: string): number | undefined {
  const numericMatch = prompt.match(/\b(\d{1,2})\s*(?:day|days|night|nights)\b/);
  if (numericMatch?.[1]) {
    return Number(numericMatch[1]);
  }

  for (const [word, value] of numberWords) {
    if (new RegExp(`\\b${word}\\s+(?:day|days|night|nights)\\b`).test(prompt)) {
      return value;
    }
  }

  if (/\bweekend\b/.test(prompt)) {
    return 3;
  }

  return undefined;
}

function extractBudget(prompt: string): { amount?: number; currency: string } {
  const symbolMatch = prompt.match(/(?:under|below|less than|budget of|for)?\s*([£€$])\s?(\d{2,6})/);
  if (symbolMatch?.[1] && symbolMatch[2]) {
    return { amount: Number(symbolMatch[2]), currency: currencyFromSymbol(symbolMatch[1]) };
  }

  const wordMatch = prompt.match(/(?:under|below|less than|budget of|for)\s+(\d{2,6})\s*(pounds?|gbp|euros?|eur|dollars?|usd)/);
  if (wordMatch?.[1] && wordMatch[2]) {
    return { amount: Number(wordMatch[1]), currency: currencyFromWord(wordMatch[2]) };
  }

  return { currency: 'GBP' };
}

function currencyFromSymbol(symbol: string): string {
  if (symbol === '€') {
    return 'EUR';
  }
  if (symbol === '$') {
    return 'USD';
  }
  return 'GBP';
}

function currencyFromWord(word: string): string {
  if (/euro|eur/.test(word)) {
    return 'EUR';
  }
  if (/dollar|usd/.test(word)) {
    return 'USD';
  }
  return 'GBP';
}

function extractDestinationHint(prompt: string): string | undefined {
  const knownDestinations = ['iceland', 'lisbon', 'madeira', 'valencia', 'barcelona', 'porto', 'athens', 'reykjavik'];
  return knownDestinations.find((destination) => prompt.includes(destination));
}

function extractInterests(prompt: string): string[] {
  const interests: string[] = [];
  if (/\bbeach|coast|sea\b/.test(prompt)) {
    interests.push('beaches');
  }
  if (/\bfood|wine|restaurant\b/.test(prompt)) {
    interests.push('food');
  }
  if (/\bhistory|museum|culture\b/.test(prompt)) {
    interests.push('culture');
  }
  if (/\bhike|nature|outdoor\b/.test(prompt)) {
    interests.push('nature');
  }
  return interests.length > 0 ? interests : ['local food', 'walkable neighborhoods'];
}
