/**
 * Shared provider type definitions.
 * Used by both main process (providers/) and renderer (components/providers/).
 *
 * NOTE: The main process providers/ also has its own ProviderType enum in
 * main/providers/types.ts. The enum values ('claude', 'gemini', 'openai', 'opencode')
 * are identical to this string literal union, so they are interchangeable
 * at runtime. This shared type is the canonical type for cross-process usage.
 */

export type ProviderType = 'claude' | 'gemini' | 'openai' | 'opencode';

export interface ProviderProfile {
  id: string;
  name: string;
  providerType: ProviderType;
  model: string;
  configDir?: string;
  temperature?: number;
  maxTokens?: number;
  customParams?: Record<string, unknown>;
  createdAt?: number;
  updatedAt?: number;
}

export interface ProviderCapabilities {
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  supportsSessionResume: boolean;
  supportsProfileSwitch: boolean;
  supportedModels: string[];
}

/**
 * Rate limit information from provider APIs.
 * Named ProviderRateLimitInfo to avoid conflict with the terminal-specific
 * RateLimitInfo in terminal.ts (which tracks Claude Code subscription limits).
 */
export interface ProviderRateLimitInfo {
  requestsRemaining: number;
  tokensRemaining: number;
  resetAt: number;
  retryAfter?: number;
}

export interface TerminalProviderState {
  terminalId: string;
  providerType: ProviderType;
  profileId: string;
  sessionId?: string;
  rateLimitInfo?: ProviderRateLimitInfo;
}

export const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  claude: 'Claude Code',
  gemini: 'Gemini CLI',
  openai: 'OpenAI Codex',
  opencode: 'OpenCode',
};

export const PROVIDER_COLORS: Record<ProviderType, string> = {
  claude: 'text-orange-400',
  gemini: 'text-blue-400',
  openai: 'text-green-400',
  opencode: 'text-purple-400',
};

export const DEFAULT_MODELS: Record<ProviderType, string> = {
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  opencode: 'opencode-default',
};

/**
 * Provider icon identifiers for lucide-react.
 * Import the icon components and use this mapping to display provider-specific icons.
 * Example: const Icon = PROVIDER_ICONS[providerType]; <Icon />
 */
export const PROVIDER_ICONS: Record<ProviderType, string> = {
  claude: 'Bot',
  gemini: 'Sparkles',
  openai: 'Cpu',
  opencode: 'Code',
};
