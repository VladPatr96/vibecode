/**
 * Provider configuration types
 * Handles hierarchical configuration for providers (Global -> Project -> Task -> Phase)
 */
import type { ThinkingLevel } from './settings';

export type ProviderType = 'claude' | 'gemini' | 'openai' | 'opencode';

export interface PhaseProviderConfig {
  spec: ProviderType;
  planning: ProviderType;
  coding: ProviderType;
  qa: ProviderType;
}

export interface PhaseModelConfig {
  spec: string;
  planning: string;
  coding: string;
  qa: string;
}

export interface PhaseThinkingConfig {
  spec: ThinkingLevel;
  planning: ThinkingLevel;
  coding: ThinkingLevel;
  qa: ThinkingLevel;
}

export interface TaskProviderSettings {
  provider?: ProviderType;
  model?: string;
  thinkingLevel?: ThinkingLevel;
  phaseProviders?: Partial<PhaseProviderConfig>;
  phaseModels?: Partial<PhaseModelConfig>;
  phaseThinking?: Partial<PhaseThinkingConfig>;
}

export interface ProjectProviderSettings {
  defaultProvider?: ProviderType;
  defaultModel?: string;
  defaultThinking?: ThinkingLevel;
}

export interface GlobalProviderSettings {
  defaultProvider: ProviderType;
  phaseProviders?: PhaseProviderConfig;
}
