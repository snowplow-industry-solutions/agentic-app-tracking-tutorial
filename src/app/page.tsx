'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
// TODO: v0.1-client-tracking — Import and initialize Snowplow browser tracker here
// import { initClientTracker, trackMessageSent, trackMessageReceived } from '@/lib/tracking/client';
import { DemoScenarios } from './components/DemoScenarios';
import { ToolCallIndicator } from './components/ToolCallIndicator';
import { ModelSelector } from './components/ModelSelector';
import { DEFAULT_MODEL_ID, type ModelProvider } from '@/lib/model-config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function generateSessionId(): string {
  if (typeof window === 'undefined') return '';

  let sessionId = localStorage.getItem('travel_agent_session_id');
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem('travel_agent_session_id', sessionId);
  }
  return sessionId;
}

type ToolCallState = 'call' | 'result' | 'error';

type ChatMessage = UIMessage;
type ChatMessagePart =
  ChatMessage['parts'] extends Array<infer Part> ? Part : never;

type ToolUIPartLike = {
  type?: string;
  toolCallId?: string;
  toolName?: string;
  state?: string;
  input?: unknown;
  rawInput?: unknown;
  output?: unknown;
  errorText?: string;
};

type ToolUIPartWithType = ToolUIPartLike & { type: string };

interface ToolCallInfo {
  id?: string;
  toolName: string;
  category: 'business' | 'self_tracking';
  state: ToolCallState;
  args?: unknown;
  result?: unknown;
}

const isTextPart = (
  part: ChatMessagePart,
): part is Extract<ChatMessagePart, { type: 'text'; text: string }> =>
  part.type === 'text';

const isToolPart = (part: ChatMessagePart | undefined): boolean => {
  if (!part) {
    return false;
  }
  const maybeTool = part as ToolUIPartLike;
  if (typeof maybeTool.type !== 'string') {
    return false;
  }
  return (
    maybeTool.type === 'dynamic-tool' || maybeTool.type.startsWith('tool-')
  );
};

const getToolCategory = (toolName: string): 'business' | 'self_tracking' =>
  toolName.startsWith('track_') ? 'self_tracking' : 'business';

const deriveToolName = (part: ToolUIPartWithType): string =>
  part.type === 'dynamic-tool'
    ? (part.toolName ?? 'dynamic_tool')
    : part.type.replace(/^tool-/, '');

const mapToolState = (state?: string): ToolCallState => {
  if (state === 'output-available') return 'result';
  if (state === 'output-error') return 'error';
  return 'call';
};

export default function Home() {
  const [sessionId] = useState(() => generateSessionId());
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Model selection state
  const [selectedModelId, setSelectedModelId] = useState(DEFAULT_MODEL_ID);

  const handleModelChange = useCallback(
    (modelId: string, _modelProvider: ModelProvider) => {
      setSelectedModelId(modelId);
    },
    [],
  );

  // TODO: v0.1-client-tracking — Initialize browser tracker on mount
  // useEffect(() => { initClientTracker(); }, []);

  const chatTransport = useMemo(
    () =>
      new DefaultChatTransport({
        api: '/api/chat',
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat<UIMessage>({
    transport: chatTransport,
    // TODO: v0.1-client-tracking — Add onFinish callback to track message received
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!input.trim()) return;

    // TODO: v0.1-client-tracking — Track message sent event here

    sendMessage(
      {
        role: 'user',
        parts: [{ type: 'text', text: input }],
      },
      { body: { sessionId, modelId: selectedModelId } },
    );
    setInput('');
  };

  const handleScenarioSelect = (message: string) => {
    // TODO: v0.1-client-tracking — Track message sent event here

    sendMessage(
      {
        role: 'user',
        parts: [{ type: 'text', text: message }],
      },
      { body: { sessionId, modelId: selectedModelId } },
    );
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100">
      {/* TODO: v0.1-client-tracking — Enable LiveTrackingPanel here */}
      {/* <LiveTrackingPanel sessionId={sessionId} /> */}
      <div className="max-w-4xl mx-auto p-4">
        <header className="mb-3 text-center py-[18px]">
          <h1 className="text-4xl font-bold text-gray-800 flex items-center justify-center gap-3">
            <span className="text-4xl">✈️</span>
            Snowplow Travel Assistant
          </h1>
          <p className="text-gray-600 mt-2">
            AI-powered flight booking with comprehensive tracking
          </p>
          <div className="mt-4 flex justify-center">
            <ModelSelector
              onModelChange={handleModelChange}
              disabled={isLoading}
            />
          </div>
        </header>

        <DemoScenarios onSelectScenario={handleScenarioSelect} />

        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Messages Area */}
          <div className="h-[600px] overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 mt-20">
                <p className="text-lg mb-4">
                  Welcome! How can I help you with your travel plans today?
                </p>
                <p className="text-sm">
                  Try: &ldquo;Find cheap flights from London to Paris
                  tomorrow&rdquo;
                </p>
              </div>
            )}

            {messages.map((message) => {
              return (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <div className="space-y-3">
                      {message.parts?.map((part, idx) => {
                        if (part.type === 'text') {
                          return (
                            <div key={idx} className="markdown-content">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  ul: ({ ...props }) => (
                                    <ul
                                      className="list-disc pl-4 mb-2"
                                      {...props}
                                    />
                                  ),
                                  ol: ({ ...props }) => (
                                    <ol
                                      className="list-decimal pl-4 mb-2"
                                      {...props}
                                    />
                                  ),
                                  li: ({ ...props }) => (
                                    <li className="mb-1" {...props} />
                                  ),
                                  p: ({ ...props }) => (
                                    <p className="mb-2 last:mb-0" {...props} />
                                  ),
                                  a: ({ ...props }) => (
                                    <a
                                      className="text-blue-600 hover:underline"
                                      {...props}
                                    />
                                  ),
                                  code: ({ ...props }) => (
                                    <code
                                      className="bg-gray-200 rounded px-1 py-0.5 text-sm font-mono"
                                      {...props}
                                    />
                                  ),
                                  pre: ({ ...props }) => (
                                    <pre
                                      className="bg-gray-800 text-white rounded p-2 mb-2 overflow-x-auto"
                                      {...props}
                                    />
                                  ),
                                  h1: ({ ...props }) => (
                                    <h1
                                      className="text-xl font-bold mb-2"
                                      {...props}
                                    />
                                  ),
                                  h2: ({ ...props }) => (
                                    <h2
                                      className="text-lg font-bold mb-2"
                                      {...props}
                                    />
                                  ),
                                  h3: ({ ...props }) => (
                                    <h3
                                      className="text-md font-bold mb-2"
                                      {...props}
                                    />
                                  ),
                                  blockquote: ({ ...props }) => (
                                    <blockquote
                                      className="border-l-4 border-gray-300 pl-4 italic mb-2"
                                      {...props}
                                    />
                                  ),
                                  table: ({ ...props }) => (
                                    <div className="overflow-x-auto mb-2">
                                      <table
                                        className="min-w-full divide-y divide-gray-300"
                                        {...props}
                                      />
                                    </div>
                                  ),
                                  th: ({ ...props }) => (
                                    <th
                                      className="px-3 py-2 bg-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                                      {...props}
                                    />
                                  ),
                                  td: ({ ...props }) => (
                                    <td
                                      className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 border-t border-gray-200"
                                      {...props}
                                    />
                                  ),
                                }}
                              >
                                {part.text}
                              </ReactMarkdown>
                            </div>
                          );
                        }

                        if (isToolPart(part)) {
                          const toolPart = part as ToolUIPartWithType;
                          const toolName = deriveToolName(toolPart);
                          const state = mapToolState(toolPart.state);
                          const toolCall = {
                            id: toolPart.toolCallId,
                            toolName,
                            category: getToolCategory(toolName),
                            state,
                            args: toolPart.input ?? toolPart.rawInput,
                            result:
                              state === 'error'
                                ? (toolPart.errorText ?? toolPart.output)
                                : toolPart.output,
                          } satisfies ToolCallInfo;

                          return (
                            <ToolCallIndicator
                              key={toolCall.id ?? `${message.id}-tool-${idx}`}
                              toolName={toolCall.toolName}
                              toolCategory={toolCall.category}
                              state={toolCall.state}
                              result={toolCall.result}
                              args={toolCall.args}
                            />
                          );
                        }

                        return null;
                      })}
                    </div>
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="animate-pulse">Thinking...</div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <form
            onSubmit={onSubmit}
            className="border-t border-gray-200 p-4 bg-gray-50"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        <footer className="mt-4 text-center text-sm text-gray-600">
          <p>Demo application showcasing Snowplow tracking across all layers</p>
        </footer>
      </div>
    </div>
  );
}
