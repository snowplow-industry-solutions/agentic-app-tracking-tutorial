import {
  newTracker,
  buildSelfDescribingEvent,
  type Tracker,
} from '@snowplow/node-tracker';

// ---------------------------------------------------------------------------
// Tracker initialization
// ---------------------------------------------------------------------------

let serverTracker: Tracker | null = null;

/**
 * Initialize the Snowplow node tracker.
 * Uses server-side env vars (not NEXT_PUBLIC_*) so they are never
 * exposed to the browser bundle.
 */
const initServerTracker = (): Tracker | null => {
  if (serverTracker) return serverTracker;

  const collectorUrl = process.env.SNOWPLOW_COLLECTOR_URL;
  const appId = process.env.SNOWPLOW_APP_ID;

  if (!collectorUrl || !appId) {
    console.warn(
      'Snowplow server tracker not initialized: missing SNOWPLOW_COLLECTOR_URL or SNOWPLOW_APP_ID',
    );
    return null;
  }

  serverTracker = newTracker(
    {
      namespace: 'travel-agent-server',
      appId: appId,
      encodeBase64: false,
    },
    {
      endpoint: collectorUrl,
      protocol: 'http',
      eventMethod: 'post',
      bufferSize: 1,
    },
  );

  return serverTracker;
};

// ---------------------------------------------------------------------------
// Context entity builders
// ---------------------------------------------------------------------------

export interface AgentContextData {
  invocation_id: string;
  session_id: string;
  user_id?: string | null;
  agent_type: string;
  model_name: string;
  model_provider: string;
  application_version?: string | null;
  conversation_messages_count?: number | null;
  current_step_number?: number | null;
}

const buildAgentContext = (data: AgentContextData) => ({
  schema: 'iglu:com.snowplow.agent.tracking/agent_context/jsonschema/1-0-0' as const,
  data: data as unknown as Record<string, unknown>,
});

export interface ToolContextData {
  tool_name: string;
  tool_category: 'business' | 'self_tracking';
  tool_call_id: string;
  tool_description?: string | null;
}

const buildToolContext = (data: ToolContextData) => ({
  schema: 'iglu:com.snowplow.agent.tracking/tool_context/jsonschema/1-0-0' as const,
  data: data as unknown as Record<string, unknown>,
});

export interface IntentExtractionData {
  origin?: string | null;
  destination?: string | null;
  date?: string | null;
  return_date?: string | null;
  passengers?: number | null;
  budget_min?: number | null;
  budget_max?: number | null;
  currency?: string | null;
  preferences?: string[] | null;
}

const buildIntentExtraction = (data: IntentExtractionData) => ({
  schema: 'iglu:com.snowplow.demo.travel/intent_extraction/jsonschema/1-0-0' as const,
  data: data as unknown as Record<string, unknown>,
});

export interface ToolParamsData {
  origin?: string | null;
  destination?: string | null;
  date?: string | null;
  return_date?: string | null;
  passengers?: number | null;
  cabin_class?: string | null;
  sort_by?: string | null;
  max_results?: number | null;
  flight_id?: string | null;
  airline?: string | null;
  flight_number?: string | null;
  passenger_name?: string | null;
  payment_method?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  user_id?: string | null;
}

const buildToolParams = (data: ToolParamsData) => ({
  schema: 'iglu:com.snowplow.demo.travel/tool_params/jsonschema/1-0-0' as const,
  data: data as unknown as Record<string, unknown>,
});

export interface ToolResultsData {
  flights_found?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  price_currency?: string | null;
  booking_id?: string | null;
  confirmation_code?: string | null;
  booking_status?: string | null;
  conflicts_found?: number | null;
  available_dates_count?: number | null;
}

const buildToolResults = (data: ToolResultsData) => ({
  schema: 'iglu:com.snowplow.demo.travel/tool_results/jsonschema/1-0-0' as const,
  data: data as unknown as Record<string, unknown>,
});

// ---------------------------------------------------------------------------
// Event: agent invocation
// ---------------------------------------------------------------------------

export interface AgentInvocationParams {
  invocationId: string;
  sessionId: string;
  userId?: string | null;
  userMessagePreview?: string | null;
  agentType?: string;
  modelName: string;
  modelProvider: string;
  conversationMessagesCount?: number;
}

export const trackAgentInvocation = (params: AgentInvocationParams) => {
  const t = initServerTracker();
  if (!t) return;

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/agent_invocation/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          session_id: params.sessionId,
          user_message_preview: params.userMessagePreview ?? null,
          invoked_at: new Date().toISOString(),
        },
      },
    }),
    [
      buildAgentContext({
        invocation_id: params.invocationId,
        session_id: params.sessionId,
        agent_type: params.agentType || 'travel_assistant',
        model_name: params.modelName,
        model_provider: params.modelProvider,
        user_id: params.userId ?? null,
        conversation_messages_count: params.conversationMessagesCount ?? null,
      }),
    ],
  );
};

// ---------------------------------------------------------------------------
// Event: agent step
// ---------------------------------------------------------------------------

export interface AgentStepParams {
  invocationId: string;
  sessionId: string;
  stepNumber: number;
  stepType: 'initial' | 'continue' | 'tool-result';
  inputTokens: number;
  outputTokens: number;
  finishReason?: 'stop' | 'length' | 'tool_calls' | 'content_filter' | null;
  toolCallsCount: number;
  textLength?: number;
  stepDurationMs?: number;
  modelName: string;
  modelProvider: string;
  conversationMessagesCount?: number;
}

export const trackAgentStep = (params: AgentStepParams) => {
  const t = initServerTracker();
  if (!t) return;

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/agent_step/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          step_number: params.stepNumber,
          step_type: params.stepType,
          input_tokens: params.inputTokens,
          output_tokens: params.outputTokens,
          finish_reason: params.finishReason ?? null,
          tool_calls_count: params.toolCallsCount,
          text_length: params.textLength ?? null,
          step_duration_ms: params.stepDurationMs ?? null,
          stepped_at: new Date().toISOString(),
        },
      },
    }),
    [
      buildAgentContext({
        invocation_id: params.invocationId,
        session_id: params.sessionId,
        agent_type: 'travel_assistant',
        model_name: params.modelName,
        model_provider: params.modelProvider,
        conversation_messages_count: params.conversationMessagesCount ?? null,
        current_step_number: params.stepNumber,
      }),
    ],
  );
};

// ---------------------------------------------------------------------------
// Event: tool execution
// ---------------------------------------------------------------------------

export interface ToolExecutionParams {
  invocationId: string;
  sessionId: string;
  stepNumber?: number | null;
  toolCallId: string;
  toolName: string;
  toolCategory: 'business' | 'self_tracking';
  toolDescription?: string;
  executionDurationMs: number;
  success: boolean;
  errorType?: string | null;
  errorMessage?: string | null;
  toolParams?: ToolParamsData;
  toolResults?: ToolResultsData;
  modelName: string;
  modelProvider: string;
  currentStepNumber?: number;
}

export const trackToolExecution = (params: ToolExecutionParams) => {
  const t = initServerTracker();
  if (!t) return;

  const contexts: Array<{ schema: string; data: Record<string, unknown> }> = [
    buildToolContext({
      tool_name: params.toolName,
      tool_category: params.toolCategory,
      tool_call_id: params.toolCallId,
      tool_description: params.toolDescription ?? null,
    }),
    buildAgentContext({
      invocation_id: params.invocationId,
      session_id: params.sessionId,
      agent_type: 'travel_assistant',
      model_name: params.modelName,
      model_provider: params.modelProvider,
      current_step_number: params.currentStepNumber ?? null,
    }),
  ];

  if (params.toolParams) {
    contexts.push(buildToolParams(params.toolParams));
  }

  if (params.toolResults) {
    contexts.push(buildToolResults(params.toolResults));
  }

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/tool_execution/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          step_number: params.stepNumber ?? null,
          execution_duration_ms: params.executionDurationMs,
          success: params.success,
          error_type: params.errorType ?? null,
          error_message: params.errorMessage ?? null,
          executed_at: new Date().toISOString(),
        },
      },
    }),
    contexts,
  );
};

// ---------------------------------------------------------------------------
// Event: agent completion
// ---------------------------------------------------------------------------

export interface AgentCompletionParams {
  invocationId: string;
  sessionId: string;
  totalSteps: number;
  totalDurationMs: number;
  totalTokens: number;
  toolsCalled: number;
  businessToolsCalled?: number;
  selfTrackingToolsCalled?: number;
  finishReason: 'stop' | 'length' | 'error' | 'max_steps';
  success: boolean;
  finalResponseLength?: number;
  modelName: string;
  modelProvider: string;
}

export const trackAgentCompletion = (params: AgentCompletionParams) => {
  const t = initServerTracker();
  if (!t) return;

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/agent_completion/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          total_steps: params.totalSteps,
          total_duration_ms: params.totalDurationMs,
          total_tokens: params.totalTokens,
          tools_called: params.toolsCalled,
          business_tools_called: params.businessToolsCalled ?? null,
          self_tracking_tools_called: params.selfTrackingToolsCalled ?? null,
          finish_reason: params.finishReason,
          success: params.success,
          final_response_length: params.finalResponseLength ?? null,
          completed_at: new Date().toISOString(),
        },
      },
    }),
    [
      buildAgentContext({
        invocation_id: params.invocationId,
        session_id: params.sessionId,
        agent_type: 'travel_assistant',
        model_name: params.modelName,
        model_provider: params.modelProvider,
      }),
    ],
  );
};

// ---------------------------------------------------------------------------
// Event: user intent detected (self-tracking)
// ---------------------------------------------------------------------------

export interface UserIntentDetectedParams {
  invocationId: string;
  sessionId: string;
  intentId: string;
  intentCategory:
    | 'search_flights'
    | 'book_flight'
    | 'modify_booking'
    | 'cancel_booking'
    | 'get_recommendations'
    | 'ask_question';
  confidence: number;
  intentExtraction?: IntentExtractionData;
  reasoning?: string | null;
  toolCallId: string;
  executionDurationMs: number;
  modelName: string;
  modelProvider: string;
}

export const trackUserIntentDetected = (params: UserIntentDetectedParams) => {
  const t = initServerTracker();
  if (!t) return;

  const contexts: Array<{ schema: string; data: Record<string, unknown> }> = [
    buildToolContext({
      tool_name: 'track_user_intent',
      tool_category: 'self_tracking',
      tool_call_id: params.toolCallId,
    }),
    buildAgentContext({
      invocation_id: params.invocationId,
      session_id: params.sessionId,
      agent_type: 'travel_assistant',
      model_name: params.modelName,
      model_provider: params.modelProvider,
    }),
  ];

  if (params.intentExtraction) {
    contexts.push(buildIntentExtraction(params.intentExtraction));
  }

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/user_intent_detected/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          intent_id: params.intentId,
          intent_category: params.intentCategory,
          confidence: params.confidence,
          reasoning: params.reasoning ?? null,
          detected_at: new Date().toISOString(),
        },
      },
    }),
    contexts,
  );
};

// ---------------------------------------------------------------------------
// Event: agent decision logged (self-tracking)
// ---------------------------------------------------------------------------

export interface AgentDecisionLoggedParams {
  invocationId: string;
  sessionId: string;
  decisionId: string;
  decisionType:
    | 'tool_selection'
    | 'parameter_reasoning'
    | 'result_interpretation'
    | 'clarification_needed'
    | 'constraint_handling';
  reasoning: string;
  considerations?: string[];
  toolCallId: string;
  executionDurationMs: number;
  modelName: string;
  modelProvider: string;
}

export const trackAgentDecisionLogged = (params: AgentDecisionLoggedParams) => {
  const t = initServerTracker();
  if (!t) return;

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/agent_decision_logged/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          decision_id: params.decisionId,
          decision_type: params.decisionType,
          reasoning: params.reasoning,
          considerations: params.considerations ?? null,
          logged_at: new Date().toISOString(),
        },
      },
    }),
    [
      buildToolContext({
        tool_name: 'track_agent_decision',
        tool_category: 'self_tracking',
        tool_call_id: params.toolCallId,
      }),
      buildAgentContext({
        invocation_id: params.invocationId,
        session_id: params.sessionId,
        agent_type: 'travel_assistant',
        model_name: params.modelName,
        model_provider: params.modelProvider,
      }),
    ],
  );
};

// ---------------------------------------------------------------------------
// Event: constraint violation (self-tracking)
// ---------------------------------------------------------------------------

export interface ConstraintViolationParams {
  invocationId: string;
  sessionId: string;
  violationId: string;
  constraintType:
    | 'budget'
    | 'dates'
    | 'availability'
    | 'route'
    | 'preferences'
    | 'other';
  userRequirement: string;
  reasonNotMet: string;
  alternativesConsidered?: string[];
  recommendation?: string | null;
  toolCallId: string;
  executionDurationMs: number;
  modelName: string;
  modelProvider: string;
}

export const trackConstraintViolation = (params: ConstraintViolationParams) => {
  const t = initServerTracker();
  if (!t) return;

  t.track(
    buildSelfDescribingEvent({
      event: {
        schema: 'iglu:com.snowplow.agent.tracking/constraint_violation/jsonschema/1-0-0',
        data: {
          invocation_id: params.invocationId,
          violation_id: params.violationId,
          constraint_type: params.constraintType,
          user_requirement: params.userRequirement,
          reason_not_met: params.reasonNotMet,
          alternatives_considered: params.alternativesConsidered ?? null,
          recommendation: params.recommendation ?? null,
          violated_at: new Date().toISOString(),
        },
      },
    }),
    [
      buildToolContext({
        tool_name: 'track_constraint_violation',
        tool_category: 'self_tracking',
        tool_call_id: params.toolCallId,
      }),
      buildAgentContext({
        invocation_id: params.invocationId,
        session_id: params.sessionId,
        agent_type: 'travel_assistant',
        model_name: params.modelName,
        model_provider: params.modelProvider,
      }),
    ],
  );
};
