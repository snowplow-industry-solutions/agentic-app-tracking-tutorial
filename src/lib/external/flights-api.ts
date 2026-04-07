import type { Flight, FlightSearchParams, FlightSearchResult } from '../types';

// Mock flight data generator with realistic airlines and routes
const AIRLINES = [
  { code: 'BA', name: 'British Airways' },
  { code: 'AF', name: 'Air France' },
  { code: 'LH', name: 'Lufthansa' },
  { code: 'KL', name: 'KLM' },
  { code: 'IB', name: 'Iberia' },
  { code: 'VS', name: 'Virgin Atlantic' },
  { code: 'EZY', name: 'easyJet' },
  { code: 'RYR', name: 'Ryanair' },
];

const AIRPORTS: Record<
  string,
  { code: string; city: string; terminals: string[] }
> = {
  London: { code: 'LHR', city: 'London', terminals: ['2', '3', '5'] },
  LHR: { code: 'LHR', city: 'London', terminals: ['2', '3', '5'] },
  Paris: { code: 'CDG', city: 'Paris', terminals: ['1', '2A', '2C'] },
  CDG: { code: 'CDG', city: 'Paris', terminals: ['1', '2A', '2C'] },
  'New York': { code: 'JFK', city: 'New York', terminals: ['1', '4', '8'] },
  JFK: { code: 'JFK', city: 'New York', terminals: ['1', '4', '8'] },
  Tokyo: { code: 'NRT', city: 'Tokyo', terminals: ['1', '2'] },
  NRT: { code: 'NRT', city: 'Tokyo', terminals: ['1', '2'] },
  Amsterdam: { code: 'AMS', city: 'Amsterdam', terminals: ['1', '2', '3'] },
  AMS: { code: 'AMS', city: 'Amsterdam', terminals: ['1', '2', '3'] },
  Frankfurt: { code: 'FRA', city: 'Frankfurt', terminals: ['1', '2'] },
  FRA: { code: 'FRA', city: 'Frankfurt', terminals: ['1', '2'] },
  Madrid: { code: 'MAD', city: 'Madrid', terminals: ['1', '2', '4'] },
  MAD: { code: 'MAD', city: 'Madrid', terminals: ['1', '2', '4'] },
  Barcelona: { code: 'BCN', city: 'Barcelona', terminals: ['1', '2'] },
  BCN: { code: 'BCN', city: 'Barcelona', terminals: ['1', '2'] },
  Munich: { code: 'MUC', city: 'Munich', terminals: ['1', '2'] },
  MUC: { code: 'MUC', city: 'Munich', terminals: ['1', '2'] },
};

// Price multipliers based on cabin class
const CABIN_MULTIPLIERS = {
  economy: 1,
  premium_economy: 1.5,
  business: 3,
  first: 5,
};

// Base prices between cities (in GBP for economy)
const BASE_PRICES: Record<string, number> = {
  'LHR-CDG': 89,
  'LHR-JFK': 450,
  'LHR-NRT': 850,
  'LHR-AMS': 75,
  'LHR-FRA': 95,
  'LHR-MAD': 120,
  'LHR-BCN': 110,
  'CDG-JFK': 420,
  'CDG-NRT': 900,
  'AMS-JFK': 440,
  'FRA-JFK': 460,
  default: 250,
};

function getAirportInfo(location: string) {
  const normalized = location.trim();
  const airport = AIRPORTS[normalized];
  if (airport) return airport;

  // Default fallback
  return { code: 'XXX', city: normalized, terminals: ['1'] };
}

function getBasePrice(originCode: string, destCode: string): number {
  const key1 = `${originCode}-${destCode}`;
  const key2 = `${destCode}-${originCode}`;
  return BASE_PRICES[key1] || BASE_PRICES[key2] || BASE_PRICES['default'];
}

function generateFlightNumber(airline: { code: string; name: string }): string {
  const flightNum = Math.floor(Math.random() * 900) + 100;
  return `${airline.code}${flightNum}`;
}

function generateDepartureTime(baseDate: string): string {
  const date = new Date(baseDate);
  const hours = Math.floor(Math.random() * 18) + 6; // 6 AM to 11 PM
  const minutes = Math.floor(Math.random() * 4) * 15; // 0, 15, 30, or 45
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

function addMinutes(isoString: string, minutes: number): string {
  const date = new Date(isoString);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

function generateFlight(
  origin: ReturnType<typeof getAirportInfo>,
  destination: ReturnType<typeof getAirportInfo>,
  date: string,
  cabinClass: string,
  basePrice: number,
): Flight {
  const airline = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
  const flightNumber = generateFlightNumber(airline);
  const departureTime = generateDepartureTime(date);

  // Calculate duration based on route (simplified)
  const isLongHaul = basePrice > 400;
  const baseDuration = isLongHaul
    ? 480 + Math.random() * 240
    : 75 + Math.random() * 120;
  const duration = Math.floor(baseDuration);

  const arrivalTime = addMinutes(departureTime, duration);

  // Determine stops (mostly direct)
  const stops = Math.random() > 0.8 ? 1 : 0;

  // Add some price variation
  const priceVariation = 0.85 + Math.random() * 0.3; // +/-15%
  const multiplier =
    CABIN_MULTIPLIERS[cabinClass as keyof typeof CABIN_MULTIPLIERS] || 1;
  const finalPrice = Math.round(basePrice * multiplier * priceVariation);

  const seatsAvailable = Math.floor(Math.random() * 15) + 1;

  return {
    id: `${flightNumber}-${date}`,
    airline: airline.name,
    flight_number: flightNumber,
    departure: {
      airport: origin.code,
      time: departureTime,
      terminal:
        origin.terminals[Math.floor(Math.random() * origin.terminals.length)],
    },
    arrival: {
      airport: destination.code,
      time: arrivalTime,
      terminal:
        destination.terminals[
          Math.floor(Math.random() * destination.terminals.length)
        ],
    },
    duration_minutes: duration,
    stops,
    price: {
      amount: finalPrice,
      currency: 'GBP',
    },
    cabin_class: cabinClass,
    seats_available: seatsAvailable,
  };
}

export async function searchFlights(
  params: FlightSearchParams,
): Promise<FlightSearchResult> {
  const startTime = Date.now();

  // Simulate API latency (150-400ms)
  const delay = 150 + Math.random() * 250;
  await new Promise((resolve) => setTimeout(resolve, delay));

  const origin = getAirportInfo(params.origin);
  const destination = getAirportInfo(params.destination);
  const cabinClass = params.cabin_class || 'economy';
  const maxResults = params.max_results || 10;
  const sortBy = params.sort_by || 'price';

  // Get base price for route
  const basePrice = getBasePrice(origin.code, destination.code);

  // Generate flights
  const numFlights = Math.min(maxResults, 5 + Math.floor(Math.random() * 8));
  const flights: Flight[] = [];

  for (let i = 0; i < numFlights; i++) {
    flights.push(
      generateFlight(origin, destination, params.date, cabinClass, basePrice),
    );
  }

  // Sort flights
  switch (sortBy) {
    case 'price':
      flights.sort((a, b) => a.price.amount - b.price.amount);
      break;
    case 'duration':
      flights.sort((a, b) => a.duration_minutes - b.duration_minutes);
      break;
    case 'departure_time':
      flights.sort(
        (a, b) =>
          new Date(a.departure.time).getTime() -
          new Date(b.departure.time).getTime(),
      );
      break;
    case 'arrival_time':
      flights.sort(
        (a, b) =>
          new Date(a.arrival.time).getTime() -
          new Date(b.arrival.time).getTime(),
      );
      break;
  }

  const searchDuration = Date.now() - startTime;

  return {
    flights,
    search_metadata: {
      searched_at: new Date().toISOString(),
      total_results: flights.length,
      search_duration_ms: searchDuration,
    },
  };
}
