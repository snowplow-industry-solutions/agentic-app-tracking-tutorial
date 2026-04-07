import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from 'ai';
import {
  searchFlightsTool,
  bookFlightTool,
  checkCalendarTool,
} from '@/lib/tools/business-tools';
import {
  getModelInstance,
  getModelConfig,
  isValidModelId,
  DEFAULT_MODEL_ID,
  PROVIDER_ENV_VARS,
} from '@/lib/model-config';

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

export async function POST(req: Request) {
  try {
    const { messages: incomingMessages, modelId } = await req.json();
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

    // TODO: v0.2-server-tracking — Add request-scoped tracking context here
    // (invocation ID, session ID, step counter, tool counters)

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
        search_flights: searchFlightsTool,
        book_flight: bookFlightTool,
        check_calendar: checkCalendarTool,
        // TODO: v0.3-agentic-tracking — Register self-tracking tools here
      },
      onStepFinish: async () => {
        // TODO: v0.2-server-tracking — Track each agent step (tokens, tool calls, finish reason)
      },
      onFinish: async () => {
        // TODO: v0.2-server-tracking — Track agent completion (total duration, tokens, tools called)
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
