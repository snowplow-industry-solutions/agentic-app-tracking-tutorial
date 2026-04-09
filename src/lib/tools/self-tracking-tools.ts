import { z } from 'zod';
import { tool } from 'ai';
import {
  trackUserIntentDetected,
  trackAgentDecisionLogged,
  trackConstraintViolation,
} from '../tracking/server';
import type { RequestContext } from '@/app/api/chat/route';

// --- track_user_intent tool ---

const trackUserIntentInputSchema = z.object({
  intent_category: z
    .enum([
      'search_flights',
      'book_flight',
      'modify_booking',
      'cancel_booking',
      'get_recommendations',
      'ask_question',
    ])
    .describe('Category of user intent'),
  confidence: z.number().min(0).max(1).describe('Confidence level (0-1)'),
  origin: z.string().nullish().describe('Origin city or airport'),
  destination: z.string().nullish().describe('Destination city or airport'),
  date: z.string().nullish().describe('Travel date'),
  return_date: z.string().nullish().describe('Return date'),
  passengers: z.number().nullish().describe('Number of passengers'),
  budget_min: z.number().nullish().describe('Minimum budget'),
  budget_max: z.number().nullish().describe('Maximum budget'),
  currency: z.string().nullish().describe('Budget currency'),
  preferences: z
    .array(z.string())
    .nullish()
    .describe('Travel preferences'),
  reasoning: z
    .string()
    .optional()
    .describe('Your reasoning for this interpretation'),
});

export function createTrackUserIntentTool(ctx: RequestContext) {
  return tool({
    description:
      'Log your interpretation of the user intent. Call this FIRST when you receive a user message.',
    inputSchema: trackUserIntentInputSchema,
    execute: async (params) => {
      const startTime = Date.now();
      const toolCallId = crypto.randomUUID();
      const intentId = crypto.randomUUID();
      ctx.totalToolsCalled++;
      ctx.selfTrackingToolsCalled++;

      trackUserIntentDetected({
        invocationId: ctx.invocationId,
        sessionId: ctx.sessionId,
        intentId,
        intentCategory: params.intent_category,
        confidence: params.confidence,
        intentExtraction: {
          origin: params.origin ?? null,
          destination: params.destination ?? null,
          date: params.date ?? null,
          return_date: params.return_date ?? null,
          passengers: params.passengers ?? null,
          budget_min: params.budget_min ?? null,
          budget_max: params.budget_max ?? null,
          currency: params.currency ?? null,
          preferences: params.preferences ?? null,
        },
        reasoning: params.reasoning || null,
        toolCallId,
        executionDurationMs: Date.now() - startTime,
        modelName: ctx.modelName,
        modelProvider: ctx.modelProvider,
      });

      return { tracked: true, intent_id: intentId };
    },
  });
}

// --- track_agent_decision tool ---

const trackAgentDecisionInputSchema = z.object({
  decision_type: z
    .enum([
      'tool_selection',
      'parameter_reasoning',
      'result_interpretation',
      'clarification_needed',
      'constraint_handling',
    ])
    .describe('Type of decision'),
  reasoning: z
    .string()
    .describe('Natural language explanation of your decision'),
  considerations: z
    .array(z.string())
    .optional()
    .describe('Key factors, options, or trade-offs you considered'),
});

export function createTrackAgentDecisionTool(ctx: RequestContext) {
  return tool({
    description:
      'Log a decision you are about to make. Call this BEFORE executing business tools.',
    inputSchema: trackAgentDecisionInputSchema,
    execute: async (params) => {
      const startTime = Date.now();
      const toolCallId = crypto.randomUUID();
      const decisionId = crypto.randomUUID();
      ctx.totalToolsCalled++;
      ctx.selfTrackingToolsCalled++;

      trackAgentDecisionLogged({
        invocationId: ctx.invocationId,
        sessionId: ctx.sessionId,
        decisionId,
        decisionType: params.decision_type,
        reasoning: params.reasoning,
        considerations: params.considerations,
        toolCallId,
        executionDurationMs: Date.now() - startTime,
        modelName: ctx.modelName,
        modelProvider: ctx.modelProvider,
      });

      return { tracked: true, decision_id: decisionId };
    },
  });
}

// --- track_constraint_violation tool ---

const trackConstraintViolationInputSchema = z.object({
  constraint_type: z
    .enum(['budget', 'dates', 'availability', 'route', 'preferences', 'other'])
    .describe('Type of constraint that was violated'),
  user_requirement: z.string().describe('What the user requested'),
  reason_not_met: z.string().describe('Why it cannot be fulfilled'),
  alternatives_considered: z
    .array(z.string())
    .optional()
    .describe('Alternative options you considered'),
  recommendation: z
    .string()
    .optional()
    .describe('Your recommended alternative'),
});

export function createTrackConstraintViolationTool(ctx: RequestContext) {
  return tool({
    description:
      'Log when a user requirement cannot be met. Call this when you detect a constraint violation.',
    inputSchema: trackConstraintViolationInputSchema,
    execute: async (params) => {
      const startTime = Date.now();
      const toolCallId = crypto.randomUUID();
      const violationId = crypto.randomUUID();
      ctx.totalToolsCalled++;
      ctx.selfTrackingToolsCalled++;

      trackConstraintViolation({
        invocationId: ctx.invocationId,
        sessionId: ctx.sessionId,
        violationId,
        constraintType: params.constraint_type,
        userRequirement: params.user_requirement,
        reasonNotMet: params.reason_not_met,
        alternativesConsidered: params.alternatives_considered,
        recommendation: params.recommendation || null,
        toolCallId,
        executionDurationMs: Date.now() - startTime,
        modelName: ctx.modelName,
        modelProvider: ctx.modelProvider,
      });

      return { tracked: true, violation_id: violationId };
    },
  });
}
