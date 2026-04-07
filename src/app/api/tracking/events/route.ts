import { NextResponse } from 'next/server';

// Snowplow Micro API response types
interface SnowplowMicroEvent {
  event: {
    event_id: string;
    collector_tstamp: string;
    event: string;
    app_id: string;
    platform: string;
    unstruct_event?: {
      data?: {
        schema?: string;
        data?: Record<string, unknown>;
      };
    };
    contexts?: {
      data?: Array<{
        schema: string;
        data: Record<string, unknown>;
      }>;
    };
    derived_contexts?: {
      data?: Array<{
        schema: string;
        data: Record<string, unknown>;
      }>;
    };
    domain_userid?: string;
    network_userid?: string;
    user_id?: string;
    page_url?: string;
    page_title?: string;
    se_category?: string;
    se_action?: string;
    se_label?: string;
    se_property?: string;
    se_value?: number;
  };
  eventType: string;
  schema?: string;
  contexts?: string[];
}

interface SnowplowMicroBadEvent {
  collectorPayload?: {
    body?: string;
    querystring?: string;
  };
  errors: Array<{
    message: string;
    location?: string[];
  }>;
}

// Transformed event type for the frontend
export interface TrackingEvent {
  id: string;
  type: string;
  timestamp: string;
  source: 'client' | 'server';
  appId: string;
  data?: Record<string, unknown>;
  contexts?: Array<{
    schema: string;
    data: Record<string, unknown>;
  }>;
  isError?: boolean;
  errorMessages?: string[];
}

const SNOWPLOW_MICRO_URL =
  process.env.SNOWPLOW_MICRO_URL || 'http://localhost:9090';

/**
 * Extract event type from schema string
 * e.g., "iglu:com.snowplow.agent.tracking/agent_invocation/jsonschema/1-0-0" -> "agent_invocation"
 */
function extractEventTypeFromSchema(schema: string): string {
  const match = schema.match(/\/([^/]+)\/jsonschema\//);
  return match ? match[1] : 'unknown';
}

/**
 * Transform a Snowplow Micro good event to our simplified TrackingEvent format
 */
function transformGoodEvent(microEvent: SnowplowMicroEvent): TrackingEvent {
  const event = microEvent.event;

  // Determine event type - prefer schema-based name for self-describing events
  let eventType = microEvent.eventType;
  if (microEvent.schema) {
    eventType = extractEventTypeFromSchema(microEvent.schema);
  } else if (event.unstruct_event?.data?.schema) {
    eventType = extractEventTypeFromSchema(event.unstruct_event.data.schema);
  }

  // Determine source based on platform or context
  const source: 'client' | 'server' =
    event.platform === 'web' ? 'client' : 'server';

  // Extract event-specific data
  let data: Record<string, unknown> = {};

  // For self-describing events, extract the custom data
  if (event.unstruct_event?.data?.data) {
    data = event.unstruct_event.data.data as Record<string, unknown>;
  }

  // For structured events, include the se_* fields
  if (event.event === 'struct') {
    data = {
      category: event.se_category,
      action: event.se_action,
      label: event.se_label,
      property: event.se_property,
      value: event.se_value,
    };
  }

  // Combine all contexts
  const allContexts: Array<{ schema: string; data: Record<string, unknown> }> =
    [];

  if (event.contexts?.data) {
    allContexts.push(...event.contexts.data);
  }
  if (event.derived_contexts?.data) {
    allContexts.push(...event.derived_contexts.data);
  }

  return {
    id: event.event_id,
    type: eventType,
    timestamp: event.collector_tstamp,
    source,
    appId: event.app_id || 'unknown',
    data,
    contexts: allContexts.length > 0 ? allContexts : undefined,
  };
}

/**
 * Transform a Snowplow Micro bad event to our TrackingEvent format
 */
function transformBadEvent(
  badEvent: SnowplowMicroBadEvent,
  index: number,
): TrackingEvent {
  return {
    id: `bad-event-${Date.now()}-${index}`,
    type: 'validation_error',
    timestamp: new Date().toISOString(),
    source: 'server',
    appId: 'unknown',
    isError: true,
    errorMessages: badEvent.errors.map((e) => e.message),
    data: {
      errors: badEvent.errors,
      payload: badEvent.collectorPayload,
    },
  };
}

export async function GET() {
  try {
    // Fetch both good and bad events in parallel
    const [goodResponse, badResponse] = await Promise.all([
      fetch(`${SNOWPLOW_MICRO_URL}/micro/good`, {
        cache: 'no-store',
      }),
      fetch(`${SNOWPLOW_MICRO_URL}/micro/bad`, {
        cache: 'no-store',
      }),
    ]);

    if (!goodResponse.ok || !badResponse.ok) {
      return NextResponse.json(
        {
          error: 'Failed to fetch events from Snowplow Micro',
          details: {
            goodStatus: goodResponse.status,
            badStatus: badResponse.status,
          },
        },
        { status: 502 },
      );
    }

    const [goodEvents, badEvents]: [
      SnowplowMicroEvent[],
      SnowplowMicroBadEvent[],
    ] = await Promise.all([goodResponse.json(), badResponse.json()]);

    // Transform events
    const transformedGood = goodEvents.map(transformGoodEvent);
    const transformedBad = badEvents.map(transformBadEvent);

    // Combine and sort by timestamp (newest first for display)
    const allEvents = [...transformedGood, ...transformedBad].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return NextResponse.json({
      events: allEvents,
      counts: {
        good: goodEvents.length,
        bad: badEvents.length,
        total: allEvents.length,
      },
    });
  } catch (error) {
    // Snowplow Micro might not be running
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: 'Could not connect to Snowplow Micro',
        message: errorMessage,
        hint: 'Make sure Snowplow Micro is running on port 9090. Run: npm run start:dev',
      },
      { status: 503 },
    );
  }
}
