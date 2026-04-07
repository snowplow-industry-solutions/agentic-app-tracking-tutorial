'use client';

import { useState } from 'react';

interface ToolCallIndicatorProps {
  toolName: string;
  toolCategory: 'business' | 'self_tracking';
  state: 'call' | 'result' | 'error';
  result?: unknown;
  args?: unknown;
}

export function ToolCallIndicator({
  toolName,
  toolCategory,
  state,
  result,
  args,
}: ToolCallIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isBusiness = toolCategory === 'business';
  const icon = isBusiness ? '🔧' : '🧠';
  const bgColor = isBusiness
    ? 'bg-blue-50 border-blue-200'
    : 'bg-purple-50 border-purple-200';
  const textColor = isBusiness ? 'text-blue-700' : 'text-purple-700';

  const stateIndicator =
    state === 'result' ? '✓' : state === 'error' ? '✗' : '⏳';

  const stateColor =
    state === 'result'
      ? 'text-green-600'
      : state === 'error'
        ? 'text-red-600'
        : 'text-gray-600';

  return (
    <div className={`border rounded-lg p-3 ${bgColor} ${textColor}`}>
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-lg">{icon}</span>
        <span className="font-medium">{toolName.replace(/_/g, ' ')}</span>
        <span className={`ml-auto ${stateColor}`}>{stateIndicator}</span>
        {state !== 'call' && result !== undefined && (
          <button className="text-xs hover:underline ml-2">
            {isExpanded ? '▲' : '▼'}
          </button>
        )}
      </div>

      {isExpanded && result !== undefined && (
        <div className="mt-3 pt-3 border-t border-gray-300 text-sm">
          <div className="space-y-2">
            {args !== undefined && (
              <div>
                <div className="font-semibold mb-1">Input:</div>
                <pre className="bg-white p-2 rounded text-xs overflow-x-auto">
                  {JSON.stringify(args, null, 2)}
                </pre>
              </div>
            )}

            <div>
              <div className="font-semibold mb-1">Output:</div>
              <div className="bg-white p-2 rounded text-xs">
                {typeof result === 'object' && result !== null ? (
                  <pre className="overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                ) : (
                  <span>{String(result)}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
