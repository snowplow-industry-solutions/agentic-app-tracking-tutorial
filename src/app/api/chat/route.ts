import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from 'ai';
import {
  createSearchFlightsTool,
  createBookFlightTool,
  createCheckCalendarTool,
} from '@/lib/tools/business-tools';
import {
  trackAgentInvocation,
  trackAgentStep,
  trackAgentCompletion,
} from '@/lib/tracking/server';
import {
  getModelInstance,
  getModelConfig,
  isValidModelId,
  DEFAULT_MODEL_ID,
  type ModelProvider,
  PROVIDER_ENV_VARS,
} from '@/lib/model-config';

export interface RequestContext {
  invocationId: string;
  sessionId: string;
  stepNumber: number;
  invocationStartTime: number;
  totalToolsCalled: number;
  businessToolsCalled: number;
  selfTrackingToolsCalled: number;
  modelName: string;
  modelProvider: ModelProvider;
}

function mapFinishReasonForStep(
  reason: string | undefined,
): 'stop' | 'length' | 'tool_calls' | 'content_filter' | null {
  if (!reason) return null;
  switch (reason) {
    case 'stop':
      return 'stop';
    case 'length':
      return 'length';
    case 'tool-calls':
      return 'tool_calls';
    case 'content-filter':
      return 'content_filter';
    default:
      return null;
  }
}

type ModelReadyMessage = Omit<UIMessage, 'id'>;

function normalizeMessageForModel(
  message: unknown,
): ModelReadyMessage | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const uiMessage = message as UIMessage & { content?: string };

  if (Array.isArray(uiMessage.parts)) {
    const { id: _omit, ...rest } = uiMessage;
    void _omit;
    return rest;
  }

  if (typeof uiMessage.content === 'string') {
    const { id: _omit, content, ...rest } = uiMessage;
    void _omit;
    return {
      ...rest,
      parts: [{ type: 'text', text: content }],
    } as ModelReadyMessage;
  }

  return undefined;
}

function extractMessagePreview(message: unknown): string {
  if (!message || typeof message !== 'object') return '';

  const candidate = message as {
    content?: string;
    parts?: Array<{ type?: string; text?: string }>;
  };

  if (
    typeof candidate.content === 'string' &&
    candidate.content.trim().length > 0
  ) {
    return candidate.content;
  }

  if (Array.isArray(candidate.parts)) {
    return candidate.parts
      .filter((part) => part?.type === 'text' && typeof part.text === 'string')
      .map((part) => part.text)
      .join(' ');
  }

  return '';
}

export async function POST(req: Request) {
  try {
    const { messages: incomingMessages, sessionId, modelId } = await req.json();
    const messages = Array.isArray(incomingMessages) ? incomingMessages : [];
    const modelReadyMessages = messages
      .map((message: unknown) => normalizeMessageForModel(message))
      .filter((message): message is ModelReadyMessage => Boolean(message));
    const modelMessages = await convertToModelMessages(modelReadyMessages);

    // Validate and get model configuration
    const selectedModelId =
      modelId && isValidModelId(modelId) ? modelId : DEFAULT_MODEL_ID;
    const modelConfig = getModelConfig(selectedModelId);

    // Check that the API key for the selected provider is configured
    const envVar = PROVIDER_ENV_VARS[modelConfig.provider];
    if (!process.env[envVar]) {
      return new Response(
        JSON.stringify({
          error: `Missing or incorrect API key for ${modelConfig.provider}. Check your .env.local file.`,
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    const model = getModelInstance(selectedModelId);

    // Request-scoped tracking context
    const requestContext: RequestContext = {
      invocationId: crypto.randomUUID(),
      sessionId: sessionId || crypto.randomUUID(),
      stepNumber: 1,
      invocationStartTime: Date.now(),
      totalToolsCalled: 0,
      businessToolsCalled: 0,
      selfTrackingToolsCalled: 0,
      modelName: modelConfig.id,
      modelProvider: modelConfig.provider,
    };

    const recentMessage = messages[messages.length - 1];
    const userMessagePreview = extractMessagePreview(recentMessage);

    // Track agent invocation at start of request
    trackAgentInvocation({
      invocationId: requestContext.invocationId,
      sessionId: requestContext.sessionId,
      userMessagePreview: userMessagePreview.substring(0, 500),
      agentType: 'travel_assistant',
      modelName: requestContext.modelName,
      modelProvider: requestContext.modelProvider,
      conversationMessagesCount: messages.length,
    });

    const result = streamText({
      model: model,
      messages: modelMessages,
      stopWhen: stepCountIs(10),
      system: `You are a helpful travel assistant. You specialize in flight bookings and have access to tools to search flights, book flights, and check calendar availability.

      **CRITICAL DATE INFORMATION:**
      TODAY'S DATE: ${new Date().toISOString().split('T')[0]} (YYYY-MM-DD)
      CURRENT YEAR: ${new Date().getFullYear()}

      When users mention dates like "tomorrow", "next week", "Christmas", etc., you MUST calculate dates based on TODAY (${new Date().toISOString().split('T')[0]}). For example:
      - "tomorrow" = ${new Date(Date.now() + 86400000).toISOString().split('T')[0]}
      - "Christmas" in the current context = ${new Date().getFullYear()}-12-25 (or ${new Date().getFullYear() + 1}-12-25 if Christmas has already passed this year)
      - All flight dates MUST be in the future (on or after ${new Date().toISOString().split('T')[0]})

      IMPORTANT: Always provide a brief text response to the user BEFORE or ALONG WITH your tool calls. Never call tools without explaining what you're doing to the user.

AVAILABLE TOOLS:
- search_flights: Find available flights between cities
- book_flight: Create bookings (requires passenger details)
- check_calendar: Verify date availability

${/* TODO: v0.3-agentic-tracking — Add self-tracking protocol here */ ''}
Be friendly, concise, and transparent about your reasoning.`,
      tools: {
        search_flights: createSearchFlightsTool(requestContext),
        book_flight: createBookFlightTool(requestContext),
        check_calendar: createCheckCalendarTool(requestContext),
        // TODO: v0.3-agentic-tracking — Register self-tracking tools here
      },
      onStepFinish: async ({ text, toolCalls, usage, finishReason }) => {
        const stepType =
          requestContext.stepNumber === 1
            ? 'initial'
            : toolCalls.length > 0
              ? 'continue'
              : 'tool-result';
        trackAgentStep({
          invocationId: requestContext.invocationId,
          sessionId: requestContext.sessionId,
          stepNumber: requestContext.stepNumber,
          stepType,
          inputTokens: usage.inputTokens ?? 0,
          outputTokens: usage.outputTokens ?? 0,
          finishReason: mapFinishReasonForStep(finishReason),
          toolCallsCount: toolCalls.length,
          textLength: text.length,
          modelName: requestContext.modelName,
          modelProvider: requestContext.modelProvider,
          conversationMessagesCount: messages.length,
        });

        requestContext.stepNumber++;
      },
      onFinish: async ({ text, finishReason, totalUsage }) => {
        const totalDuration = Date.now() - requestContext.invocationStartTime;
        const totalTokens =
          totalUsage.totalTokens ??
          (totalUsage.inputTokens ?? 0) + (totalUsage.outputTokens ?? 0);

        const finishReasonMapped =
          finishReason === 'error'
            ? 'error'
            : finishReason === 'content-filter'
              ? 'error'
              : finishReason === 'length'
                ? 'length'
                : 'stop';

        const wasSuccessful =
          finishReason !== 'error' && finishReason !== 'content-filter';

        trackAgentCompletion({
          invocationId: requestContext.invocationId,
          sessionId: requestContext.sessionId,
          totalSteps: requestContext.stepNumber,
          totalDurationMs: totalDuration,
          totalTokens,
          toolsCalled: requestContext.totalToolsCalled,
          businessToolsCalled: requestContext.businessToolsCalled,
          selfTrackingToolsCalled: requestContext.selfTrackingToolsCalled,
          finishReason: finishReasonMapped,
          success: wasSuccessful,
          finalResponseLength: text.length,
          modelName: requestContext.modelName,
          modelProvider: requestContext.modelProvider,
        });
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    // Catch 401 errors from the API as fallback for keys that are present but invalid
    if (
      error instanceof Error &&
      (error.message.includes('401') || error.message.includes('Unauthorized'))
    ) {
      return new Response(
        JSON.stringify({
          error:
            'Missing or incorrect API key for the selected provider. Check your .env.local file.',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        error: 'Failed to process request',
        message: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
