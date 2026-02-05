/**
 * Provider Integration Handler for Terminals
 *
 * Provides a unified interface for invoking any supported CLI provider
 * (Claude, Gemini, OpenAI) in terminal sessions.
 */

import { providerRegistry } from '../providers';
import type { ICLIProvider } from '../providers/provider-interface';
import type { ProviderType, ProviderProfile } from '../providers/types';
import { ProviderType as PT } from '../providers/types';
import {
  detectProviderRateLimit,
  detectProviderBusyState,
  detectProviderExit,
  detectApiKeyError,
  type ProviderRateLimitInfo,
} from './output-parser';

export interface ProviderInvocationConfig {
  terminalId: string;
  providerType: ProviderType;
  profile: ProviderProfile;
  workingDirectory: string;
  taskContext?: string;
  onRateLimit?: (info: ProviderRateLimitInfo) => void;
  onBusyStateChange?: (state: 'busy' | 'idle') => void;
  onExit?: () => void;
  onApiKeyError?: () => void;
}

export interface ProviderInvocationResult {
  command: string[];
  environment: Record<string, string>;
  provider: ICLIProvider;
}

/**
 * Build shell command string from command array and environment
 */
export function buildProviderShellCommand(
  cmdArray: string[],
  envVars: Record<string, string>,
  cwd?: string
): string {
  const envPrefix = Object.entries(envVars)
    .map(([key, value]) => {
      // Escape special characters in values
      const escapedValue = value.replace(/"/g, '\\"');
      return `${key}="${escapedValue}"`;
    })
    .join(' ');

  const command = cmdArray.join(' ');

  if (cwd) {
    return `cd "${cwd}" && ${envPrefix} ${command}`.trim();
  }

  return `${envPrefix} ${command}`.trim();
}

/**
 * Prepare provider invocation for a terminal
 */
export async function prepareProviderInvocation(
  config: ProviderInvocationConfig
): Promise<ProviderInvocationResult> {
  // Get or create provider for terminal
  let provider = providerRegistry.getTerminalProvider(config.terminalId);

  if (!provider || provider.providerType !== config.providerType) {
    provider = await providerRegistry.createForTerminal(
      config.terminalId,
      config.providerType,
      config.profile
    );
  }

  // Get CLI command and environment
  const command = provider.getCliCommand();
  const environment = provider.getCliEnvironment();

  return {
    command,
    environment,
    provider,
  };
}

/**
 * Create an output handler for provider-specific parsing
 */
export function createProviderOutputHandler(
  providerType: ProviderType,
  callbacks: {
    onRateLimit?: (info: ProviderRateLimitInfo) => void;
    onBusyStateChange?: (state: 'busy' | 'idle') => void;
    onExit?: () => void;
    onApiKeyError?: () => void;
  }
) {
  let lastBusyState: 'busy' | 'idle' | null = null;
  const providerTypeStr = providerType as 'claude' | 'gemini' | 'openai' | 'opencode';

  return (data: string) => {
    // Check for rate limits
    const rateLimitInfo = detectProviderRateLimit(data, providerTypeStr);
    if (rateLimitInfo && callbacks.onRateLimit) {
      callbacks.onRateLimit(rateLimitInfo);
    }

    // Check busy state
    const busyState = detectProviderBusyState(data, providerTypeStr);
    if (busyState && busyState !== lastBusyState) {
      lastBusyState = busyState;
      if (callbacks.onBusyStateChange) {
        callbacks.onBusyStateChange(busyState);
      }
    }

    // Check for exit
    if (detectProviderExit(data, providerTypeStr)) {
      if (callbacks.onExit) {
        callbacks.onExit();
      }
    }

    // Check for API key errors (Gemini/OpenAI/Opencode only)
    if (providerType !== PT.CLAUDE) {
      if (detectApiKeyError(data, providerTypeStr as 'gemini' | 'openai' | 'opencode')) {
        if (callbacks.onApiKeyError) {
          callbacks.onApiKeyError();
        }
      }
    }
  };
}

/**
 * Get provider capabilities summary
 */
export function getProviderCapabilitiesSummary(providerType: ProviderType): {
  supportsSessionResume: boolean;
  supportsExtendedThinking: boolean;
  supportsMcp: boolean;
  authMethod: 'oauth' | 'api_key';
} {
  switch (providerType) {
    case PT.CLAUDE:
      return {
        supportsSessionResume: true,
        supportsExtendedThinking: true,
        supportsMcp: true,
        authMethod: 'oauth',
      };
    case PT.GEMINI:
      return {
        supportsSessionResume: false,
        supportsExtendedThinking: false,
        supportsMcp: false, // Via MCP Bridge
        authMethod: 'api_key',
      };
    case PT.OPENAI:
      return {
        supportsSessionResume: false,
        supportsExtendedThinking: false,
        supportsMcp: false, // Via MCP Bridge
        authMethod: 'api_key',
      };
    case PT.OPENCODE:
      return {
        supportsSessionResume: false,
        supportsExtendedThinking: false,
        supportsMcp: true, // Via Models.dev bridge
        authMethod: 'oauth',
      };
    default:
      return {
        supportsSessionResume: false,
        supportsExtendedThinking: false,
        supportsMcp: false,
        authMethod: 'api_key',
      };
  }
}

/**
 * Get default model for provider
 */
export function getDefaultModel(providerType: ProviderType): string {
  switch (providerType) {
    case PT.CLAUDE:
      return 'claude-sonnet-4-20250514';
    case PT.GEMINI:
      return 'gemini-2.0-flash';
    case PT.OPENAI:
      return 'gpt-4o';
    case PT.OPENCODE:
      return 'claude-sonnet-4';
    default:
      return '';
  }
}

/**
 * Get available models for provider
 */
export function getAvailableModels(providerType: ProviderType): string[] {
  switch (providerType) {
    case PT.CLAUDE:
      return [
        'claude-opus-4-20250514',
        'claude-sonnet-4-20250514',
        'claude-haiku-3-5-20241022',
      ];
    case PT.GEMINI:
      return [
        'gemini-2.0-flash',
        'gemini-2.0-flash-thinking-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
      ];
    case PT.OPENAI:
      return [
        'gpt-4o',
        'gpt-4o-mini',
        'o1',
        'o1-mini',
        'o3-mini',
      ];
    case PT.OPENCODE:
      return [
        'claude-sonnet-4',
        'claude-opus-4',
        'gpt-4o',
        'gpt-4o-mini',
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'o1',
        'o3-mini',
      ];
    default:
      return [];
  }
}
