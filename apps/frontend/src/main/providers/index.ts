/**
 * Multi-provider support for Auto-Claude frontend.
 */

export * from './types';
export * from './provider-interface';
export { providerRegistry } from './provider-registry';

// Import providers
import { ClaudeCLIProvider } from './claude';
import { GeminiCLIProvider } from './gemini';
import { OpenAICLIProvider } from './openai';
import { CodexCLIProvider } from './codex';
import { OpencodeCLIProvider } from './opencode';
import { providerRegistry } from './provider-registry';
import { ProviderType } from './types';

// Register all providers
providerRegistry.register(ProviderType.CLAUDE, () => ClaudeCLIProvider.create());
providerRegistry.register(ProviderType.GEMINI, () => GeminiCLIProvider.create());
providerRegistry.register(ProviderType.OPENAI, () => OpenAICLIProvider.create());
providerRegistry.register(ProviderType.CODEX, () => CodexCLIProvider.create());
providerRegistry.register(ProviderType.OPENCODE, () => OpencodeCLIProvider.create());

export { ClaudeCLIProvider } from './claude';
export { GeminiCLIProvider } from './gemini';
export { OpenAICLIProvider } from './openai';
export { CodexCLIProvider } from './codex';
export { OpencodeCLIProvider } from './opencode';
