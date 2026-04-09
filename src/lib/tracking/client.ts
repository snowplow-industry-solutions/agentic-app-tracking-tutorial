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
// Deterministic nanoid → UUID mapping (UUIDv5)
// ---------------------------------------------------------------------------

// App-specific namespace. Stable across sessions so the same AI SDK message.id
// always resolves to the same UUID — required by the message_context and
// message_received schemas (format: uuid) while preserving correlation back
// to the AI SDK's message identifier.
const TRACKING_UUID_NAMESPACE = 'b7f3e4d2-8c1a-4f5e-9a2b-6d7c8e9f0a1b';

const hexToBytes = (hex: string): Uint8Array => {
  const clean = hex.replace(/-/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return bytes;
};

const bytesToUuid = (bytes: Uint8Array): string => {
  const hex = Array.from(bytes.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

export const nanoidToUuid = async (input: string): Promise<string> => {
  const namespace = hexToBytes(TRACKING_UUID_NAMESPACE);
  const name = new TextEncoder().encode(input);
  const combined = new Uint8Array(namespace.length + name.length);
  combined.set(namespace, 0);
  combined.set(name, namespace.length);

  const hashBuffer = await crypto.subtle.digest('SHA-1', combined);
  const uuid = new Uint8Array(hashBuffer).slice(0, 16);
  uuid[6] = (uuid[6] & 0x0f) | 0x50; // version 5
  uuid[8] = (uuid[8] & 0x3f) | 0x80; // RFC 4122 variant
  return bytesToUuid(uuid);
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
