/**
 * Type definitions for CLI providers.
 */

export enum ProviderType {
  CLAUDE = 'claude',
  GEMINI = 'gemini',
  OPENAI = 'openai',
  CODEX = 'codex',
  OPENCODE = 'opencode',
}

export interface ProviderCredentials {
  providerType: ProviderType;
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  expiresAt?: number;
  configDir?: string;
  metadata?: Record<string, unknown>;
}

export interface ProviderProfile {
  id: string;
  name: string;
  providerType: ProviderType;
  model: string;
  configDir?: string;
  temperature?: number;
  maxTokens?: number;
  customParams?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface RateLimitInfo {
  requestsRemaining: number;
  tokensRemaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface ProviderCapabilities {
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  supportsSessionResume: boolean;
  supportsProfileSwitch: boolean;
  supportedModels: string[];
}

export interface TerminalProviderState {
  terminalId: string;
  providerType: ProviderType;
  profileId: string;
  sessionId?: string;
  rateLimitInfo?: RateLimitInfo;
}

export const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  [ProviderType.CLAUDE]: 'Claude Code',
  [ProviderType.GEMINI]: 'Gemini CLI',
  [ProviderType.OPENAI]: 'OpenAI Codex',
  [ProviderType.CODEX]: 'Codex CLI',
  [ProviderType.OPENCODE]: 'OpenCode CLI',
};

export const PROVIDER_ICONS: Record<ProviderType, string> = {
  [ProviderType.CLAUDE]: '🟠',
  [ProviderType.GEMINI]: '🔵',
  [ProviderType.OPENAI]: '🟢',
  [ProviderType.CODEX]: '🟩',
  [ProviderType.OPENCODE]: '🟣',
};

export const DEFAULT_MODELS: Record<ProviderType, string> = {
  [ProviderType.CLAUDE]: 'claude-sonnet-4-20250514',
  [ProviderType.GEMINI]: 'gemini-2.0-flash',
  [ProviderType.OPENAI]: 'gpt-4o',
  [ProviderType.CODEX]: 'gpt-4o',
  [ProviderType.OPENCODE]: 'claude-sonnet-4-20250514',
};
