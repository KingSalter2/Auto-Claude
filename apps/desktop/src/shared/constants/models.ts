/**
 * Model and agent profile constants
 * Claude models, thinking levels, memory backends, and agent profiles
 */

import type { AgentProfile, PhaseModelConfig, FeatureModelConfig, FeatureThinkingConfig } from '../types/settings';
import type { BuiltinProvider } from '../types/provider-account';

// ============================================
// Available Models
// ============================================

export const AVAILABLE_MODELS = [
  { value: 'opus', label: 'Claude Opus 4.6' },
  { value: 'opus-1m', label: 'Claude Opus 4.6 (1M)' },
  { value: 'opus-4.5', label: 'Claude Opus 4.5' },
  { value: 'sonnet', label: 'Claude Sonnet 4.5' },
  { value: 'haiku', label: 'Claude Haiku 4.5' }
] as const;

// ============================================
// Multi-Provider Model Catalog
// ============================================

export interface ModelOption {
  value: string;
  label: string;
  provider: BuiltinProvider;
  description?: string;
  capabilities?: {
    thinking: boolean;
    tools: boolean;
    vision: boolean;
    contextWindow: number;
  };
}

export const ALL_AVAILABLE_MODELS: ModelOption[] = [
  // Anthropic
  { value: 'opus', label: 'Claude Opus 4.6', provider: 'anthropic', description: 'Most capable', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 200000 } },
  { value: 'opus-1m', label: 'Claude Opus 4.6 (1M)', provider: 'anthropic', description: '1M context', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 1000000 } },
  { value: 'opus-4.5', label: 'Claude Opus 4.5', provider: 'anthropic', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 200000 } },
  { value: 'sonnet', label: 'Claude Sonnet 4.5', provider: 'anthropic', description: 'Balanced', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 200000 } },
  { value: 'haiku', label: 'Claude Haiku 4.5', provider: 'anthropic', description: 'Fast', capabilities: { thinking: false, tools: true, vision: true, contextWindow: 200000 } },
  // OpenAI
  { value: 'gpt-4.1', label: 'GPT-4.1', provider: 'openai', description: 'Latest flagship', capabilities: { thinking: false, tools: true, vision: true, contextWindow: 1047576 } },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', provider: 'openai', description: 'Fast & affordable', capabilities: { thinking: false, tools: true, vision: true, contextWindow: 1047576 } },
  { value: 'gpt-4o', label: 'GPT-4o', provider: 'openai', description: 'Multimodal', capabilities: { thinking: false, tools: true, vision: true, contextWindow: 128000 } },
  { value: 'gpt-5.3', label: 'GPT-5.3', provider: 'openai', description: 'Most capable', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 1047576 } },
  { value: 'o3', label: 'o3', provider: 'openai', description: 'Reasoning', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 200000 } },
  { value: 'o3-mini', label: 'o3 Mini', provider: 'openai', description: 'Fast reasoning', capabilities: { thinking: true, tools: true, vision: false, contextWindow: 200000 } },
  { value: 'o4-mini', label: 'o4 Mini', provider: 'openai', description: 'Latest reasoning', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 200000 } },
  // Google
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', provider: 'google', description: 'Fast thinking', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 1048576 } },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', provider: 'google', description: 'Advanced', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 1048576 } },
  { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash', provider: 'google', description: 'Multimodal', capabilities: { thinking: false, tools: true, vision: true, contextWindow: 1048576 } },
  // Mistral
  { value: 'mistral-large-latest', label: 'Mistral Large', provider: 'mistral', capabilities: { thinking: false, tools: true, vision: true, contextWindow: 128000 } },
  { value: 'mistral-small-latest', label: 'Mistral Small', provider: 'mistral', capabilities: { thinking: false, tools: true, vision: false, contextWindow: 128000 } },
  // Groq
  { value: 'llama-3.3-70b-versatile', label: 'LLaMA 3.3 70B', provider: 'groq', description: 'Fast inference', capabilities: { thinking: false, tools: true, vision: false, contextWindow: 128000 } },
  // xAI
  { value: 'grok-3', label: 'Grok 3', provider: 'xai', capabilities: { thinking: true, tools: true, vision: true, contextWindow: 131072 } },
  { value: 'grok-3-mini', label: 'Grok 3 Mini', provider: 'xai', description: 'Fast reasoning', capabilities: { thinking: true, tools: true, vision: false, contextWindow: 131072 } },
];

// Maps model shorthand to actual Claude model IDs
// Values must match apps/desktop/src/main/ai/config/types.ts MODEL_ID_MAP
export const MODEL_ID_MAP: Record<string, string> = {
  opus: 'claude-opus-4-6',
  'opus-1m': 'claude-opus-4-6',
  'opus-4.5': 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-4-5-20251001'
} as const;

// Maps thinking levels to budget tokens
export const THINKING_BUDGET_MAP: Record<string, number> = {
  low: 1024,
  medium: 4096,
  high: 16384
} as const;

// ============================================
// Thinking Levels
// ============================================

// Thinking levels for Claude model (budget token allocation)
export const THINKING_LEVELS = [
  { value: 'low', label: 'Low', description: 'Brief consideration' },
  { value: 'medium', label: 'Medium', description: 'Moderate analysis' },
  { value: 'high', label: 'High', description: 'Deep thinking' }
] as const;

// ============================================
// Agent Profiles - Phase Configurations
// ============================================

// Phase configurations for each preset profile
// Each profile has its own default phase models and thinking levels

// Auto (Optimized) - Opus with optimized thinking per phase
export const AUTO_PHASE_MODELS: PhaseModelConfig = {
  spec: 'opus',
  planning: 'opus',
  coding: 'opus',
  qa: 'opus'
};

export const AUTO_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = {
  spec: 'high',   // Deep thinking for comprehensive spec creation
  planning: 'high',     // High thinking for planning complex features
  coding: 'low',        // Faster coding iterations
  qa: 'low'             // Efficient QA review
};

// Complex Tasks - Opus with high thinking across all phases
export const COMPLEX_PHASE_MODELS: PhaseModelConfig = {
  spec: 'opus',
  planning: 'opus',
  coding: 'opus',
  qa: 'opus'
};

export const COMPLEX_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = {
  spec: 'high',
  planning: 'high',
  coding: 'high',
  qa: 'high'
};

// Balanced - Sonnet with medium thinking across all phases
export const BALANCED_PHASE_MODELS: PhaseModelConfig = {
  spec: 'sonnet',
  planning: 'sonnet',
  coding: 'sonnet',
  qa: 'sonnet'
};

export const BALANCED_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = {
  spec: 'medium',
  planning: 'medium',
  coding: 'medium',
  qa: 'medium'
};

// Quick Edits - Haiku with low thinking across all phases
export const QUICK_PHASE_MODELS: PhaseModelConfig = {
  spec: 'haiku',
  planning: 'haiku',
  coding: 'haiku',
  qa: 'haiku'
};

export const QUICK_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = {
  spec: 'low',
  planning: 'low',
  coding: 'low',
  qa: 'low'
};

// Default phase configuration (used for fallback, matches 'Balanced' profile for cost-effectiveness)
export const DEFAULT_PHASE_MODELS: PhaseModelConfig = BALANCED_PHASE_MODELS;
export const DEFAULT_PHASE_THINKING: import('../types/settings').PhaseThinkingConfig = BALANCED_PHASE_THINKING;

// ============================================
// Feature Settings (Non-Pipeline Features)
// ============================================

// Default feature model configuration (for insights, ideation, roadmap, github, utility)
export const DEFAULT_FEATURE_MODELS: FeatureModelConfig = {
  insights: 'sonnet',     // Fast, responsive chat
  ideation: 'opus',       // Creative ideation benefits from Opus
  roadmap: 'opus',        // Strategic planning benefits from Opus
  githubIssues: 'opus',   // Issue triage and analysis benefits from Opus
  githubPrs: 'opus',      // PR review benefits from thorough Opus analysis
  utility: 'haiku'        // Fast utility operations (commit messages, merge resolution)
};

// Default feature thinking configuration
export const DEFAULT_FEATURE_THINKING: FeatureThinkingConfig = {
  insights: 'medium',     // Balanced thinking for chat
  ideation: 'high',       // Deep thinking for creative ideas
  roadmap: 'high',        // Strategic thinking for roadmap
  githubIssues: 'medium', // Moderate thinking for issue analysis
  githubPrs: 'medium',    // Moderate thinking for PR review
  utility: 'low'          // Fast thinking for utility operations
};

// Feature labels for UI display
export const FEATURE_LABELS: Record<keyof FeatureModelConfig, { label: string; description: string }> = {
  insights: { label: 'Insights Chat', description: 'Ask questions about your codebase' },
  ideation: { label: 'Ideation', description: 'Generate feature ideas and improvements' },
  roadmap: { label: 'Roadmap', description: 'Create strategic feature roadmaps' },
  githubIssues: { label: 'GitHub Issues', description: 'Automated issue triage and labeling' },
  githubPrs: { label: 'GitHub PR Review', description: 'AI-powered pull request reviews' },
  utility: { label: 'Utility', description: 'Commit messages and merge conflict resolution' }
};

// Default agent profiles for preset model/thinking configurations
// All profiles have per-phase configuration for full customization
export const DEFAULT_AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'auto',
    name: 'Auto (Optimized)',
    description: 'Uses Opus across all phases with optimized thinking levels',
    model: 'opus',
    thinkingLevel: 'high',
    icon: 'Sparkles',
    phaseModels: AUTO_PHASE_MODELS,
    phaseThinking: AUTO_PHASE_THINKING
  },
  {
    id: 'complex',
    name: 'Complex Tasks',
    description: 'For intricate, multi-step implementations requiring deep analysis',
    model: 'opus',
    thinkingLevel: 'high',
    icon: 'Brain',
    phaseModels: COMPLEX_PHASE_MODELS,
    phaseThinking: COMPLEX_PHASE_THINKING
  },
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Good balance of speed and quality for most tasks',
    model: 'sonnet',
    thinkingLevel: 'medium',
    icon: 'Scale',
    phaseModels: BALANCED_PHASE_MODELS,
    phaseThinking: BALANCED_PHASE_THINKING
  },
  {
    id: 'quick',
    name: 'Quick Edits',
    description: 'Fast iterations for simple changes and quick fixes',
    model: 'haiku',
    thinkingLevel: 'low',
    icon: 'Zap',
    phaseModels: QUICK_PHASE_MODELS,
    phaseThinking: QUICK_PHASE_THINKING
  },
  {
    id: 'custom',
    name: 'Custom (Cross-Provider)',
    description: 'Mix different providers and models for each pipeline phase',
    model: 'opus',
    thinkingLevel: 'high',
    icon: 'Settings2',
    // No phaseModels/phaseThinking — reads from customMixedPhaseConfig
  }
];

// Models that support Fast Mode (same model, faster API routing, higher cost)
export const FAST_MODE_MODELS: readonly string[] = ['opus', 'opus-1m'] as const;

// Models that use adaptive thinking (Opus dynamically decides how much to think within the budget cap)
export const ADAPTIVE_THINKING_MODELS: readonly string[] = ['opus', 'opus-1m'] as const;

// Valid thinking levels for validation
export const VALID_THINKING_LEVELS = ['low', 'medium', 'high'] as const;

// Legacy thinking level mappings (must match backend phase_config.py LEGACY_THINKING_LEVEL_MAP)
export const LEGACY_THINKING_MAP: Record<string, string> = { ultrathink: 'high', none: 'low' } as const;

/** Sanitize a thinking level value, mapping legacy values to valid ones */
export function sanitizeThinkingLevel(val: string): string {
  if (VALID_THINKING_LEVELS.includes(val as typeof VALID_THINKING_LEVELS[number])) return val;
  return LEGACY_THINKING_MAP[val] ?? 'medium';
}

// Phase keys for iterating over phase model/thinking configuration
export const PHASE_KEYS: readonly (keyof PhaseModelConfig)[] = ['spec', 'planning', 'coding', 'qa'] as const;

// ============================================
// Memory Backends
// ============================================

export const MEMORY_BACKENDS = [
  { value: 'file', label: 'File-based (default)' },
  { value: 'graphiti', label: 'Graphiti (LadybugDB)' }
] as const;

// ============================================
// Reasoning Configuration Types
// ============================================

export type ReasoningType =
  | 'thinking_tokens'     // Anthropic: budget-based thinking
  | 'adaptive_effort'     // Anthropic Opus 4.6: effort level + budget cap
  | 'reasoning_effort'    // OpenAI o-series: reasoning_effort param
  | 'thinking_toggle'     // Google: thinking enabled/disabled
  | 'none';               // No reasoning/thinking API

export interface ReasoningConfig {
  type: ReasoningType;
  level?: 'low' | 'medium' | 'high';
}

export interface ProviderModelSpec {
  modelId: string;
  reasoning: ReasoningConfig;
}

export const DEFAULT_MODEL_EQUIVALENCES: Record<string, Partial<Record<BuiltinProvider, ProviderModelSpec>>> = {
  'opus': {
    anthropic: { modelId: 'claude-opus-4-6', reasoning: { type: 'adaptive_effort', level: 'high' } },
    openai: { modelId: 'gpt-5.3', reasoning: { type: 'none' } },
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
    xai: { modelId: 'grok-3', reasoning: { type: 'none' } },
    mistral: { modelId: 'mistral-large-latest', reasoning: { type: 'none' } },
  },
  'opus-1m': {
    anthropic: { modelId: 'claude-opus-4-6', reasoning: { type: 'adaptive_effort', level: 'high' } },
    openai: { modelId: 'gpt-4.1', reasoning: { type: 'none' } },
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
  },
  'opus-4.5': {
    anthropic: { modelId: 'claude-opus-4-5-20251101', reasoning: { type: 'thinking_tokens', level: 'high' } },
    openai: { modelId: 'gpt-5.3', reasoning: { type: 'none' } },
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
  },
  'sonnet': {
    anthropic: { modelId: 'claude-sonnet-4-5-20250929', reasoning: { type: 'thinking_tokens', level: 'medium' } },
    openai: { modelId: 'gpt-4o', reasoning: { type: 'none' } },
    google: { modelId: 'gemini-2.5-flash', reasoning: { type: 'thinking_toggle', level: 'medium' } },
    mistral: { modelId: 'mistral-large-latest', reasoning: { type: 'none' } },
    groq: { modelId: 'llama-3.3-70b-versatile', reasoning: { type: 'none' } },
    xai: { modelId: 'grok-3-mini', reasoning: { type: 'none' } },
  },
  'haiku': {
    anthropic: { modelId: 'claude-haiku-4-5-20251001', reasoning: { type: 'none' } },
    openai: { modelId: 'gpt-4.1-mini', reasoning: { type: 'none' } },
    google: { modelId: 'gemini-2.0-flash', reasoning: { type: 'none' } },
    mistral: { modelId: 'mistral-small-latest', reasoning: { type: 'none' } },
    groq: { modelId: 'llama-3.3-70b-versatile', reasoning: { type: 'none' } },
  },
  'gpt-5.3': {
    openai: { modelId: 'gpt-5.3', reasoning: { type: 'none' } },
    anthropic: { modelId: 'claude-opus-4-6', reasoning: { type: 'adaptive_effort', level: 'high' } },
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
  },
  'gpt-4.1': {
    openai: { modelId: 'gpt-4.1', reasoning: { type: 'none' } },
    anthropic: { modelId: 'claude-opus-4-6', reasoning: { type: 'adaptive_effort', level: 'high' } },
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
  },
  'gpt-4o': {
    openai: { modelId: 'gpt-4o', reasoning: { type: 'none' } },
    anthropic: { modelId: 'claude-sonnet-4-5-20250929', reasoning: { type: 'thinking_tokens', level: 'medium' } },
    google: { modelId: 'gemini-2.5-flash', reasoning: { type: 'thinking_toggle', level: 'medium' } },
  },
  'o3': {
    openai: { modelId: 'o3', reasoning: { type: 'reasoning_effort', level: 'high' } },
    anthropic: { modelId: 'claude-opus-4-6', reasoning: { type: 'adaptive_effort', level: 'high' } },
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
  },
  'gemini-2.5-pro': {
    google: { modelId: 'gemini-2.5-pro', reasoning: { type: 'thinking_toggle', level: 'high' } },
    anthropic: { modelId: 'claude-opus-4-6', reasoning: { type: 'adaptive_effort', level: 'high' } },
    openai: { modelId: 'gpt-5.3', reasoning: { type: 'none' } },
  },
};

// ============================================
// Reasoning Type Badges for UI
// ============================================

export const REASONING_TYPE_BADGES: Record<ReasoningType, { i18nKey: string } | null> = {
  adaptive_effort: { i18nKey: 'agentProfile.reasoning.adaptive' },
  thinking_tokens: { i18nKey: 'agentProfile.reasoning.budget' },
  reasoning_effort: { i18nKey: 'agentProfile.reasoning.reasoning' },
  thinking_toggle: { i18nKey: 'agentProfile.reasoning.thinking' },
  none: null,
};

/**
 * Get the ReasoningConfig for a model+provider pair.
 * Looks up from DEFAULT_MODEL_EQUIVALENCES, falling back to ALL_AVAILABLE_MODELS.
 */
export function getReasoningConfigForModel(
  modelValue: string,
  provider: BuiltinProvider,
): ReasoningConfig {
  // First try the equivalence table
  const equiv = DEFAULT_MODEL_EQUIVALENCES[modelValue]?.[provider];
  if (equiv) return equiv.reasoning;

  // Check if model is in ALL_AVAILABLE_MODELS with matching provider
  const modelEntry = ALL_AVAILABLE_MODELS.find(m => m.value === modelValue && m.provider === provider);
  if (modelEntry) {
    if (!modelEntry.capabilities?.thinking) {
      return { type: 'none' };
    }
    // If it has thinking but we don't have a specific reasoning config,
    // try to infer from the provider
    if (provider === 'anthropic') {
      return ADAPTIVE_THINKING_MODELS.includes(modelValue)
        ? { type: 'adaptive_effort', level: 'high' }
        : { type: 'thinking_tokens', level: 'medium' };
    }
    if (provider === 'openai') {
      return { type: 'reasoning_effort', level: 'medium' };
    }
    if (provider === 'google') {
      return { type: 'thinking_toggle', level: 'medium' };
    }
  }

  return { type: 'none' };
}

export function resolveModelEquivalent(
  modelValue: string,
  targetProvider: BuiltinProvider,
  userOverrides?: Record<string, Partial<Record<BuiltinProvider, ProviderModelSpec>>>
): ProviderModelSpec | null {
  const override = userOverrides?.[modelValue]?.[targetProvider];
  if (override) return override;

  // Direct lookup by shorthand or full ID
  const direct = DEFAULT_MODEL_EQUIVALENCES[modelValue]?.[targetProvider];
  if (direct) return direct;

  // Reverse lookup: if modelValue is a full model ID (e.g. 'claude-opus-4-6'),
  // find which equivalence entry resolves to that ID and use the target provider mapping
  for (const [_key, providerMap] of Object.entries(DEFAULT_MODEL_EQUIVALENCES)) {
    for (const spec of Object.values(providerMap)) {
      if (spec?.modelId === modelValue) {
        const targetSpec = providerMap[targetProvider];
        if (targetSpec) return targetSpec;
      }
    }
  }

  return null;
}

/**
 * Look up the context window size for a model shorthand.
 * Searches ALL_AVAILABLE_MODELS by value.
 * Falls back to 200,000 (conservative default) if not found.
 */
export function getModelContextWindow(modelShorthand: string): number {
  const model = ALL_AVAILABLE_MODELS.find((m) => m.value === modelShorthand);
  return model?.capabilities?.contextWindow ?? 200_000;
}
