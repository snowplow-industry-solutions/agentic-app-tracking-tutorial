'use client';

import {
  newTracker,
  trackPageView,
  trackSelfDescribingEvent,
} from '@snowplow/browser-tracker';

// ---------------------------------------------------------------------------
// Tracker initialization
// ---------------------------------------------------------------------------

let trackerInitialized = false;

/**
 * Initialize the Snowplow browser tracker.
 * Call once on app mount (e.g. in a useEffect).
 */
export const initClientTracker = () => {
  if (trackerInitialized) return;

  const collectorUrl = process.env.NEXT_PUBLIC_SNOWPLOW_COLLECTOR_URL;
  const appId = process.env.NEXT_PUBLIC_SNOWPLOW_APP_ID;

  if (!collectorUrl || !appId) {
    console.warn(
      'Snowplow browser tracker not initialized: missing NEXT_PUBLIC_SNOWPLOW_COLLECTOR_URL or NEXT_PUBLIC_SNOWPLOW_APP_ID',
    );
    return;
  }

  newTracker('sp', collectorUrl, {
    appId,
    contexts: {
      webPage: true,
      session: true,
    },
    anonymousTracking: false,
    stateStorageStrategy: 'localStorage',
  });

  trackerInitialized = true;
  trackPageView();
};

// ---------------------------------------------------------------------------
// Context entity builders
// ---------------------------------------------------------------------------

export interface MessageContextData {
  message_id: string;
  message_role: 'user' | 'assistant';
  message_length: number;
  message_preview: string | null;
  message_index: number;
  conversation_turn: number | null;
}

const buildMessageContext = (data: MessageContextData) => ({
  schema: 'iglu:com.snowplow.agent.tracking/message_context/jsonschema/1-0-0' as const,
  data: data as unknown as Record<string, unknown>,
});

// ---------------------------------------------------------------------------
// Event: message sent
// ---------------------------------------------------------------------------

export interface MessageSentParams {
  sessionId: string;
  messageId: string;
  message: string;
  messageIndex: number;
  conversationTurn?: number;
}

export const trackMessageSent = (params: MessageSentParams) => {
  trackSelfDescribingEvent({
    event: {
      schema: 'iglu:com.snowplow.agent.tracking/message_sent/jsonschema/1-0-0',
      data: {
        session_id: params.sessionId,
        sent_at: new Date().toISOString(),
      },
    },
    context: [
      buildMessageContext({
        message_id: params.messageId,
        message_role: 'user',
        message_length: params.message.length,
        message_preview: params.message.substring(0, 100),
        message_index: params.messageIndex,
        conversation_turn: params.conversationTurn ?? null,
      }),
    ],
  });
};

// ---------------------------------------------------------------------------
// Event: message received
// ---------------------------------------------------------------------------

export interface MessageReceivedParams {
  sessionId: string;
  invocationId: string;
  messageId: string;
  responseText: string;
  tokensUsed?: number | null;
  toolCallsCount: number;
  responseTimeMs: number;
  messageIndex: number;
  conversationTurn?: number;
  modelName: string;
  modelProvider: 'anthropic' | 'openai' | 'google';
}

export const trackMessageReceived = (params: MessageReceivedParams) => {
  trackSelfDescribingEvent({
    event: {
      schema: 'iglu:com.snowplow.agent.tracking/message_received/jsonschema/1-0-0',
      data: {
        session_id: params.sessionId,
        invocation_id: params.invocationId,
        tokens_used: params.tokensUsed ?? null,
        response_time_ms: params.responseTimeMs,
        tool_calls_count: params.toolCallsCount,
        received_at: new Date().toISOString(),
      },
    },
    context: [
      buildMessageContext({
        message_id: params.messageId,
        message_role: 'assistant',
        message_length: params.responseText.length,
        message_preview: params.responseText.substring(0, 100),
        message_index: params.messageIndex,
        conversation_turn: params.conversationTurn ?? null,
      }),
    ],
  });
};
