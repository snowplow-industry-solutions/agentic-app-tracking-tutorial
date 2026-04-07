'use client';

import { useCallback, useEffect, useSyncExternalStore, useState } from 'react';
import {
  SUPPORTED_MODELS,
  DEFAULT_MODEL_ID,
  getModelsGroupedByProvider,
  type ModelConfig,
  type ModelProvider,
} from '@/lib/model-config';

const STORAGE_KEY = 'travel_agent_selected_model';

// Custom hook for localStorage with SSR support
function useLocalStorageModel() {
  const subscribe = useCallback((callback: () => void) => {
    window.addEventListener('storage', callback);
    return () => window.removeEventListener('storage', callback);
  }, []);

  const getSnapshot = useCallback(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_MODELS.some((m) => m.id === stored)) {
      return stored;
    }
    return DEFAULT_MODEL_ID;
  }, []);

  // Server snapshot always returns default to avoid hydration mismatch
  const getServerSnapshot = useCallback(() => DEFAULT_MODEL_ID, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// Provider display configuration
const PROVIDER_CONFIG: Record<
  ModelProvider,
  { displayName: string; color: string; bgColor: string }
> = {
  anthropic: {
    displayName: 'Anthropic',
    color: 'text-orange-700',
    bgColor: 'bg-orange-100',
  },
  openai: {
    displayName: 'OpenAI',
    color: 'text-green-700',
    bgColor: 'bg-green-100',
  },
  google: {
    displayName: 'Google',
    color: 'text-blue-700',
    bgColor: 'bg-blue-100',
  },
};

interface ModelSelectorProps {
  onModelChange: (modelId: string, modelProvider: ModelProvider) => void;
  disabled?: boolean;
}

export function ModelSelector({
  onModelChange,
  disabled = false,
}: ModelSelectorProps) {
  // Use useSyncExternalStore for SSR-safe localStorage access
  const selectedModelId = useLocalStorageModel();
  const [isOpen, setIsOpen] = useState(false);

  // Track hydration state using useSyncExternalStore pattern
  const hasMounted = useSyncExternalStore(
    () => () => {}, // No-op subscribe (value never changes after mount)
    () => true, // Client: always true after hydration
    () => false, // Server: always false during SSR
  );

  // Notify parent when model changes (including initial mount)
  useEffect(() => {
    const config = SUPPORTED_MODELS.find((m) => m.id === selectedModelId);
    if (config) {
      onModelChange(config.id, config.provider);
    }
  }, [selectedModelId, onModelChange]);

  const handleSelect = (model: ModelConfig) => {
    localStorage.setItem(STORAGE_KEY, model.id);
    // Dispatch storage event to trigger useSyncExternalStore update
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    onModelChange(model.id, model.provider);
    setIsOpen(false);
  };

  const selectedModel = SUPPORTED_MODELS.find((m) => m.id === selectedModelId);
  const groupedModels = getModelsGroupedByProvider();

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled || !hasMounted}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border
          ${disabled ? 'bg-gray-100 cursor-not-allowed opacity-60' : 'bg-white hover:bg-gray-50 cursor-pointer'}
          border-gray-300 shadow-sm transition-colors min-w-[200px]
        `}
      >
        {!hasMounted ? (
          /* Loading skeleton - shown during SSR and initial hydration */
          <>
            <span className="h-5 w-16 bg-gray-200 rounded animate-pulse" />
            <span className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          </>
        ) : selectedModel ? (
          <>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${PROVIDER_CONFIG[selectedModel.provider].bgColor} ${PROVIDER_CONFIG[selectedModel.provider].color}`}
            >
              {PROVIDER_CONFIG[selectedModel.provider].displayName}
            </span>
            <span className="text-sm font-medium text-gray-700">
              {selectedModel.displayName}
            </span>
          </>
        ) : null}
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && !disabled && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute z-20 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden">
            {(Object.keys(groupedModels) as ModelProvider[]).map((provider) => (
              <div key={provider}>
                <div
                  className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider ${PROVIDER_CONFIG[provider].bgColor} ${PROVIDER_CONFIG[provider].color}`}
                >
                  {PROVIDER_CONFIG[provider].displayName}
                </div>
                {groupedModels[provider].map((model) => (
                  <button
                    key={model.id}
                    onClick={() => handleSelect(model)}
                    className={`
                      w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors
                      ${model.id === selectedModelId ? 'bg-blue-50' : ''}
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {model.displayName}
                        </div>
                        {model.description && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {model.description}
                          </div>
                        )}
                      </div>
                      {model.id === selectedModelId && (
                        <svg
                          className="w-5 h-5 text-blue-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
