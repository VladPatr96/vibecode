import type { ProviderType } from './provider';

export type RoutingPhase = 'planning' | 'coding' | 'qa';

export interface ProviderRecommendation {
  provider_type: ProviderType;
  model: string;
  reason: string;
  confidence: number;
}

export interface RoutingRecommendation {
  planning: ProviderRecommendation;
  coding: ProviderRecommendation;
  qa: ProviderRecommendation;
}

export interface RoutingPhaseProviders {
  planning: ProviderType;
  coding: ProviderType;
  qa: ProviderType;
}

export interface RoutingSettings {
  defaultProviders: RoutingPhaseProviders;
  fallbackChains: Record<ProviderType, ProviderType[]>;
  showConfirmationDialog: boolean;
}

export interface RoutingAnalyzeTaskInput {
  projectId?: string;
  specContent: string;
  userDefaults?: Partial<RoutingPhaseProviders>;
  rateLimitedProviders?: ProviderType[];
}
