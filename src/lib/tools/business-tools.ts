// TODO: v0.3-agentic-tracking — Add self-tracking-tools.ts alongside this file
// (track_user_intent, track_agent_decision, track_constraint_violation)

import { z } from 'zod';
import { tool } from 'ai';
import type { Booking, PassengerDetails, CalendarCheckResult } from '../types';
import { searchFlights } from '../external/flights-api';
import { trackToolExecution } from '../tracking/server';
import type { RequestContext } from '@/app/api/chat/route';

// Get current date for schema descriptions
const getCurrentDateString = () => new Date().toISOString().split('T')[0];

// --- search_flights tool ---

const searchFlightsSchema = z.object({
  origin: z
    .string()
    .describe('Origin city or airport code (e.g., "London" or "LHR")'),
  destination: z.string().describe('Destination city or airport code'),
  date: z
    .string()
    .describe(
      `Departure date in YYYY-MM-DD format. TODAY is ${getCurrentDateString()}. All dates must be today or in the future.`,
    ),
  return_date: z.string().optional().describe('Return date for round-trip'),
  passengers: z.number().default(1).describe('Number of passengers'),
  cabin_class: z
    .enum(['economy', 'premium_economy', 'business', 'first'])
    .default('economy'),
  sort_by: z
    .enum(['price', 'duration', 'departure_time', 'arrival_time'])
    .default('price'),
  max_results: z
    .number()
    .default(10)
    .describe('Maximum number of results to return'),
});

export function createSearchFlightsTool(ctx: RequestContext) {
  return tool({
    description: 'Search for flights between two cities on a specific date',
    inputSchema: searchFlightsSchema,
    execute: async (params) => {
      const startTime = Date.now();
      const toolCallId = crypto.randomUUID();
      ctx.totalToolsCalled++;
      ctx.businessToolsCalled++;

      try {
        const results = await searchFlights(params);
        const duration = Date.now() - startTime;

        trackToolExecution({
          invocationId: ctx.invocationId,
          sessionId: ctx.sessionId,
          stepNumber: ctx.stepNumber,
          toolCallId,
          toolName: 'search_flights',
          toolCategory: 'business',
          executionDurationMs: duration,
          success: true,
          toolParams: {
            origin: params.origin,
            destination: params.destination,
            date: params.date,
            return_date: params.return_date ?? null,
            passengers: params.passengers,
            cabin_class: params.cabin_class,
            sort_by: params.sort_by,
            max_results: params.max_results,
          },
          toolResults: {
            flights_found: results.flights.length,
            price_min:
              results.flights.length > 0
                ? Math.min(...results.flights.map((f) => f.price.amount))
                : null,
            price_max:
              results.flights.length > 0
                ? Math.max(...results.flights.map((f) => f.price.amount))
                : null,
            price_currency: results.flights[0]?.price.currency ?? null,
          },
          modelName: ctx.modelName,
          modelProvider: ctx.modelProvider,
          currentStepNumber: ctx.stepNumber,
        });

        return results;
      } catch (error) {
        const duration = Date.now() - startTime;

        trackToolExecution({
          invocationId: ctx.invocationId,
          sessionId: ctx.sessionId,
          stepNumber: ctx.stepNumber,
          toolCallId,
          toolName: 'search_flights',
          toolCategory: 'business',
          executionDurationMs: duration,
          success: false,
          errorType: 'execution_error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          toolParams: {
            origin: params.origin,
            destination: params.destination,
            date: params.date,
            return_date: params.return_date ?? null,
            passengers: params.passengers,
            cabin_class: params.cabin_class,
            sort_by: params.sort_by,
            max_results: params.max_results,
          },
          modelName: ctx.modelName,
          modelProvider: ctx.modelProvider,
          currentStepNumber: ctx.stepNumber,
        });

        throw error;
      }
    },
  });
}

// --- book_flight tool ---

const flightSchema = z.object({
  id: z.string().describe('Unique identifier of the flight to book'),
  airline: z.string().describe('Airline name'),
  flight_number: z.string().describe('Flight number'),
  departure: z.object({
    airport: z.string().describe('Departure airport'),
    time: z.string().describe('Departure time'),
  }),
  arrival: z.object({
    airport: z.string().describe('Arrival airport'),
    time: z.string().describe('Arrival time'),
  }),
  duration_minutes: z.number().describe('Flight duration in minutes'),
  stops: z.number().describe('Number of stops'),
  price: z.object({
    amount: z.number().describe('Price amount'),
    currency: z.string().describe('Price currency'),
  }),
  cabin_class: z.string().describe('Cabin class'),
  seats_available: z.number().describe('Number of seats available'),
});

const bookFlightSchema = z.object({
  flight: flightSchema,
  passenger: z.object({
    first_name: z.string().describe('Passenger first name'),
    last_name: z.string().describe('Passenger last name'),
    email: z.string().email().describe('Passenger email address'),
    phone: z.string().optional().describe('Passenger phone number'),
    date_of_birth: z.string().describe('Date of birth in YYYY-MM-DD format'),
  }),
  payment_method: z
    .enum(['card', 'points', 'hold'])
    .default('hold')
    .describe('Payment method - use "hold" for demo'),
});

export function createBookFlightTool(ctx: RequestContext) {
  return tool({
    description: 'Book a specific flight for a passenger',
    inputSchema: bookFlightSchema,
    execute: async (params): Promise<Booking> => {
      const startTime = Date.now();
      const toolCallId = crypto.randomUUID();
      ctx.totalToolsCalled++;
      ctx.businessToolsCalled++;

      try {
        // Simulate booking delay
        await new Promise((resolve) =>
          setTimeout(resolve, 200 + Math.random() * 300),
        );

        const confirmationCode = `${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const bookingId = crypto.randomUUID();

        if (!params.flight?.price) {
          throw new Error('Flight price is required');
        }

        const result: Booking = {
          confirmation_code: confirmationCode,
          booking_id: bookingId,
          status: 'confirmed',
          flight_details: {
            id: params.flight.id,
            airline: params.flight.airline,
            flight_number: params.flight.flight_number,
            departure: {
              airport: params.flight.departure.airport,
              time: params.flight.departure.time,
            },
            arrival: {
              airport: params.flight.arrival.airport,
              time: params.flight.arrival.time,
            },
            duration_minutes: params.flight.duration_minutes,
            stops: params.flight.stops,
            price: params.flight.price,
            cabin_class: params.flight.cabin_class,
            seats_available: params.flight.seats_available,
          },
          passenger_details: params.passenger as PassengerDetails,
          total_price: {
            amount: params.flight.price.amount,
            currency: params.flight.price.currency,
          },
          booked_at: new Date().toISOString(),
        };

        const duration = Date.now() - startTime;

        trackToolExecution({
          invocationId: ctx.invocationId,
          sessionId: ctx.sessionId,
          stepNumber: ctx.stepNumber,
          toolCallId,
          toolName: 'book_flight',
          toolCategory: 'business',
          executionDurationMs: duration,
          success: true,
          toolParams: {
            flight_id: params.flight.id,
            airline: params.flight.airline,
            flight_number: params.flight.flight_number,
            passenger_name: `${params.passenger.first_name} ${params.passenger.last_name}`,
            payment_method: params.payment_method,
          },
          toolResults: {
            booking_id: bookingId,
            confirmation_code: confirmationCode,
            booking_status: 'confirmed',
          },
          modelName: ctx.modelName,
          modelProvider: ctx.modelProvider,
          currentStepNumber: ctx.stepNumber,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        trackToolExecution({
          invocationId: ctx.invocationId,
          sessionId: ctx.sessionId,
          stepNumber: ctx.stepNumber,
          toolCallId,
          toolName: 'book_flight',
          toolCategory: 'business',
          executionDurationMs: duration,
          success: false,
          errorType: 'execution_error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          toolParams: {
            flight_id: params.flight.id,
            airline: params.flight.airline,
            flight_number: params.flight.flight_number,
            passenger_name: `${params.passenger.first_name} ${params.passenger.last_name}`,
            payment_method: params.payment_method,
          },
          modelName: ctx.modelName,
          modelProvider: ctx.modelProvider,
          currentStepNumber: ctx.stepNumber,
        });

        throw error;
      }
    },
  });
}

// --- check_calendar tool ---

const checkCalendarSchema = z.object({
  start_date: z.string().describe('Start date in YYYY-MM-DD format'),
  end_date: z.string().describe('End date in YYYY-MM-DD format'),
  user_id: z
    .string()
    .optional()
    .describe('User ID, defaults to current session user'),
});

export function createCheckCalendarTool(ctx: RequestContext) {
  return tool({
    description: 'Check calendar for conflicts on specific dates',
    inputSchema: checkCalendarSchema,
    execute: async (params): Promise<CalendarCheckResult> => {
      const startTime = Date.now();
      const toolCallId = crypto.randomUUID();
      ctx.totalToolsCalled++;
      ctx.businessToolsCalled++;

      try {
        // Simulate API delay
        await new Promise((resolve) =>
          setTimeout(resolve, 100 + Math.random() * 200),
        );

        // Generate mock calendar conflicts
        const hasConflicts = Math.random() > 0.6;
        const conflicts = [];

        if (hasConflicts) {
          const numConflicts = Math.floor(Math.random() * 3) + 1;
          const severities: Array<'high' | 'medium' | 'low'> = [
            'high',
            'medium',
            'low',
          ];
          const eventTitles = [
            'Team Meeting',
            'Client Presentation',
            'Project Deadline',
            'Doctor Appointment',
            'Family Event',
            'Conference Call',
          ];

          for (let i = 0; i < numConflicts; i++) {
            conflicts.push({
              date: params.start_date,
              time: `${9 + Math.floor(Math.random() * 8)}:00`,
              title:
                eventTitles[Math.floor(Math.random() * eventTitles.length)],
              conflict_severity:
                severities[Math.floor(Math.random() * severities.length)],
            });
          }
        }

        // Generate available dates
        const startDate = new Date(params.start_date);
        const endDate = new Date(params.end_date);
        const available: string[] = [];

        for (
          let d = new Date(startDate);
          d <= endDate;
          d.setDate(d.getDate() + 1)
        ) {
          if (Math.random() > 0.3) {
            available.push(d.toISOString().split('T')[0]);
          }
        }

        const result: CalendarCheckResult = {
          conflicts,
          available_dates: available,
          checked_at: new Date().toISOString(),
        };

        const duration = Date.now() - startTime;

        trackToolExecution({
          invocationId: ctx.invocationId,
          sessionId: ctx.sessionId,
          stepNumber: ctx.stepNumber,
          toolCallId,
          toolName: 'check_calendar',
          toolCategory: 'business',
          executionDurationMs: duration,
          success: true,
          toolParams: {
            start_date: params.start_date,
            end_date: params.end_date,
            user_id: params.user_id ?? null,
          },
          toolResults: {
            conflicts_found: conflicts.length,
            available_dates_count: available.length,
          },
          modelName: ctx.modelName,
          modelProvider: ctx.modelProvider,
          currentStepNumber: ctx.stepNumber,
        });

        return result;
      } catch (error) {
        const duration = Date.now() - startTime;

        trackToolExecution({
          invocationId: ctx.invocationId,
          sessionId: ctx.sessionId,
          stepNumber: ctx.stepNumber,
          toolCallId,
          toolName: 'check_calendar',
          toolCategory: 'business',
          executionDurationMs: duration,
          success: false,
          errorType: 'execution_error',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          toolParams: {
            start_date: params.start_date,
            end_date: params.end_date,
            user_id: params.user_id ?? null,
          },
          modelName: ctx.modelName,
          modelProvider: ctx.modelProvider,
          currentStepNumber: ctx.stepNumber,
        });

        throw error;
      }
    },
  });
}
