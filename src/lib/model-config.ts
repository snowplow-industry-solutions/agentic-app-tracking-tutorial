import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';

/**
 * Model Configuration
 *
 * NOTE: Model IDs may change as providers release new versions.
 * To check available models:
 * - Anthropic: https://docs.anthropic.com/en/docs/models
 * - OpenAI: https://platform.openai.com/docs/models
 * - Google: https://ai.google.dev/models (or call ListModels API)
 *
 * Update the model IDs below based on your API access and available models.
 */

export type ModelProvider = 'anthropic' | 'openai' | 'google';

export interface ModelConfig {
  id: string;
  provider: ModelProvider;
  displayName: string;
  description?: string;
}

export const SUPPORTED_MODELS: readonly ModelConfig[] = [
  // Anthropic Claude
  {
    id: 'claude-sonnet-4-20250514',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4',
    description: 'Anthropic Claude Sonnet 4 - balanced performance',
  },
  {
    id: 'claude-sonnet-4-5-20250929',
    provider: 'anthropic',
    displayName: 'Claude Sonnet 4.5',
    description: 'Anthropic Claude Sonnet 4.5 - High performance',
  },
  // OpenAI GPT-5 Series
  {
    id: 'gpt-5',
    provider: 'openai',
    displayName: 'GPT-5',
    description: 'OpenAI GPT-5 - released Aug 2025',
  },
  {
    id: 'gpt-5.1',
    provider: 'openai',
    displayName: 'GPT-5.1',
    description: 'OpenAI GPT-5.1 - multimodal + personalities',
  },
  {
    id: 'gpt-5.2',
    provider: 'openai',
    displayName: 'GPT-5.2',
    description: 'OpenAI GPT-5.2 - instant/thinking modes',
  },

  // Google Gemini Series
  // Note: Model IDs may vary - check https://ai.google.dev/models for current list
  {
    id: 'gemini-3-pro-preview',
    provider: 'google',
    displayName: 'Gemini 3 Pro',
    description:
      'Google Gemini 3 Pro - advanced reasoning & agentic capabilities',
  },
  {
    id: 'gemini-3-flash-preview',
    provider: 'google',
    displayName: 'Gemini 3 Flash',
    description:
      'Google Gemini 3 Flash - high speed, low latency & complex tasks',
  },
] as const;

export const DEFAULT_MODEL_ID = 'claude-sonnet-4-5-20250929';

export const PROVIDER_ENV_VARS: Record<ModelProvider, string> = {
  anthropic: 'ANTHROPIC_API_KEY',
  openai: 'OPENAI_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
};

/**
 * Get the configuration for a model by its ID
 */
export function getModelConfig(modelId: string): ModelConfig {
  const config = SUPPORTED_MODELS.find((m) => m.id === modelId);
  if (!config) {
    throw new Error(`Unknown model: ${modelId}`);
  }
  return config;
}

/**
 * Get a model instance for use with the Vercel AI SDK
 */
export function getModelInstance(modelId: string) {
  const config = getModelConfig(modelId);

  switch (config.provider) {
    case 'anthropic':
      return anthropic(modelId);
    case 'openai':
      return openai(modelId);
    case 'google':
      return google(modelId);
    default:
      throw new Error(`Unknown provider for model: ${modelId}`);
  }
}

/**
 * Get models grouped by provider for UI display
 */
export function getModelsGroupedByProvider(): Record<
  ModelProvider,
  ModelConfig[]
> {
  return SUPPORTED_MODELS.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider].push(model);
      return acc;
    },
    {} as Record<ModelProvider, ModelConfig[]>,
  );
}

/**
 * Check if a model ID is valid
 */
export function isValidModelId(modelId: string): boolean {
  return SUPPORTED_MODELS.some((m) => m.id === modelId);
}
