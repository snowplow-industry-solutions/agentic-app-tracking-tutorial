'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface TrackingEvent {
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

interface TrackingEventsResponse {
  events: TrackingEvent[];
  counts: {
    good: number;
    bad: number;
    total: number;
  };
}

interface LiveTrackingPanelProps {
  sessionId: string;
}

const POLL_INTERVAL_MS = 2000;

export function LiveTrackingPanel({ sessionId }: LiveTrackingPanelProps) {
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TrackingEvent | null>(
    null,
  );
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [counts, setCounts] = useState({ good: 0, bad: 0, total: 0 });

  // Track seen event IDs to prevent duplicates
  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const eventsContainerRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    try {
      const response = await fetch('/api/tracking/events');

      if (!response.ok) {
        const errorData = await response.json();
        setErrorMessage(
          errorData.hint || errorData.error || 'Connection error',
        );
        setIsConnected(false);
        return;
      }

      const data: TrackingEventsResponse = await response.json();
      setIsConnected(true);
      setErrorMessage(null);
      setCounts(data.counts);

      // Filter out events we've already seen
      const newEvents = data.events.filter(
        (event) => !seenEventIdsRef.current.has(event.id),
      );

      if (newEvents.length > 0) {
        // Add new event IDs to seen set
        newEvents.forEach((event) => seenEventIdsRef.current.add(event.id));

        // Merge new events with existing, sorted by timestamp (newest last for display)
        setEvents((prev) => {
          const merged = [...prev, ...newEvents];
          // Sort by timestamp ascending (oldest first) for chronological display
          merged.sort(
            (a, b) =>
              new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
          );
          return merged;
        });

        // Auto-scroll to bottom when new events arrive
        setTimeout(() => {
          eventsContainerRef.current?.scrollTo({
            top: eventsContainerRef.current.scrollHeight,
            behavior: 'smooth',
          });
        }, 100);
      }
    } catch {
      setIsConnected(false);
      setErrorMessage('Cannot connect to Snowplow Micro');
    }
  }, []);

  // Start polling when panel is visible
  useEffect(() => {
    if (!isVisible) return;

    // Fetch immediately when opened, then set up polling interval
    // Using setTimeout(0) to avoid calling setState synchronously in effect body
    const immediateTimeout = setTimeout(fetchEvents, 0);
    const intervalId = setInterval(fetchEvents, POLL_INTERVAL_MS);

    return () => {
      clearTimeout(immediateTimeout);
      clearInterval(intervalId);
    };
  }, [isVisible, fetchEvents]);

  const handleClearEvents = () => {
    setEvents([]);
    seenEventIdsRef.current.clear();
  };

  const getEventIcon = (type: string, isError?: boolean) => {
    if (isError) return '❌';
    if (type.includes('invocation')) return '🚀';
    if (type.includes('step')) return '🔵';
    if (type.includes('tool')) return '🔧';
    if (type.includes('completion')) return '✅';
    if (type.includes('intent')) return '🎯';
    if (type.includes('decision')) return '🤔';
    if (type.includes('violation') || type.includes('constraint')) return '⚠️';
    if (type.includes('message_sent') || type.includes('user_sends'))
      return '📤';
    if (type.includes('message_received') || type.includes('agent_responds'))
      return '📥';
    if (type.includes('flight')) return '✈️';
    if (type.includes('page_view')) return '👁️';
    return '📊';
  };

  const getEventLabel = (type: string) => {
    return type.replace(/_/g, ' ').replace(/^./, (str) => str.toUpperCase());
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  };

  const getSourceBadge = (source: 'client' | 'server') => {
    return source === 'client' ? (
      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">
        client
      </span>
    ) : (
      <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
        server
      </span>
    );
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed top-4 right-4 px-4 py-2 bg-slate-800 text-white rounded-lg shadow-lg hover:bg-slate-700 z-50"
      >
        📊 View Tracking
      </button>
    );
  }

  return (
    <>
      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-96 bg-white shadow-2xl border-l border-gray-200 overflow-hidden flex flex-col z-40">
        <div className="bg-slate-800 text-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">📊 Live Snowplow Tracking</h2>
            <button
              onClick={() => setIsVisible(false)}
              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-sm transition-colors"
            >
              ✕ Close
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <p className="text-sm text-slate-300">Real-time event stream</p>
            <div className="flex items-center gap-2">
              <div
                className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="text-xs text-slate-300">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="p-3 bg-yellow-50 border-b border-yellow-200 text-yellow-800 text-sm">
            <p className="font-medium">Connection Issue</p>
            <p className="text-xs mt-1">{errorMessage}</p>
          </div>
        )}

        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <span className="text-gray-700 font-medium">Session:</span>
              <div className="font-mono text-xs text-gray-800 truncate">
                {sessionId?.slice(0, 8) || 'N/A'}...
              </div>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Good:</span>
              <div className="font-semibold text-green-700">{counts.good}</div>
            </div>
            <div>
              <span className="text-gray-700 font-medium">Bad:</span>
              <div className="font-semibold text-red-700">{counts.bad}</div>
            </div>
          </div>
        </div>

        <div
          ref={eventsContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-2"
        >
          {events.length === 0 && (
            <div className="text-center text-gray-600 mt-10">
              <p className="font-medium">No events tracked yet</p>
              <p className="text-sm mt-2 text-gray-500">
                Events will appear here as you interact with the chat
              </p>
              {!isConnected && (
                <p className="text-xs mt-4 text-yellow-700">
                  Ensure Snowplow Micro is running on port 9090
                </p>
              )}
            </div>
          )}

          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => setSelectedEvent(event)}
              className={`p-3 rounded-lg cursor-pointer border transition-colors ${
                event.isError
                  ? 'bg-red-50 hover:bg-red-100 border-red-200'
                  : 'bg-gray-50 hover:bg-gray-100 border-gray-200'
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-lg">
                  {getEventIcon(event.type, event.isError)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-gray-900 truncate">
                      {getEventLabel(event.type)}
                    </span>
                    {getSourceBadge(event.source)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {formatTime(event.timestamp)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-2">
          <div className="flex gap-2">
            <button
              onClick={fetchEvents}
              className="flex-1 px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 text-sm"
            >
              🔄 Refresh
            </button>
            <button
              onClick={handleClearEvents}
              className="flex-1 px-4 py-2 bg-slate-500 text-white rounded hover:bg-slate-400 text-sm"
            >
              🗑️ Clear
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center">
            Polling every {POLL_INTERVAL_MS / 1000}s
          </p>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedEvent(null)}
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    {getEventIcon(selectedEvent.type, selectedEvent.isError)}
                    {getEventLabel(selectedEvent.type)}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-700">
                      {formatTime(selectedEvent.timestamp)}
                    </span>
                    {getSourceBadge(selectedEvent.source)}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-gray-600 hover:text-gray-800 text-xl"
                >
                  ✕
                </button>
              </div>

              {selectedEvent.isError && selectedEvent.errorMessages && (
                <div className="mb-4 p-3 bg-red-50 rounded-lg border border-red-200">
                  <h4 className="font-semibold text-red-700 mb-1">Errors:</h4>
                  <ul className="text-sm text-red-600 list-disc list-inside">
                    {selectedEvent.errorMessages.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="space-y-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    Event ID:
                  </h4>
                  <code className="text-xs text-gray-800 bg-gray-200 px-2 py-1 rounded break-all">
                    {selectedEvent.id}
                  </code>
                </div>

                {selectedEvent.data &&
                  Object.keys(selectedEvent.data).length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Event Data:
                      </h4>
                      <pre className="text-xs overflow-x-auto bg-gray-800 text-green-400 p-3 rounded">
                        {JSON.stringify(selectedEvent.data, null, 2)}
                      </pre>
                    </div>
                  )}

                {selectedEvent.contexts &&
                  selectedEvent.contexts.length > 0 && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <h4 className="font-semibold text-gray-900 mb-2">
                        Contexts ({selectedEvent.contexts.length}):
                      </h4>
                      {selectedEvent.contexts.map((ctx, i) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <p className="text-xs text-gray-700 mb-1 truncate">
                            {ctx.schema.split('/').slice(-3, -1).join('/')}
                          </p>
                          <pre className="text-xs overflow-x-auto bg-gray-800 text-blue-400 p-3 rounded">
                            {JSON.stringify(ctx.data, null, 2)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
