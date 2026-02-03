/**
 * Terminal Module
 * Modular terminal management system with multi-provider integration
 */

// Main manager
export { TerminalManager } from './terminal-manager';

// Types
export type {
  TerminalProcess,
  RateLimitEvent,
  OAuthTokenEvent,
  SessionCaptureResult,
  TerminalOperationResult,
  WindowGetter
} from './types';

// Output parsing utilities
export * as OutputParser from './output-parser';

// PTY management utilities
export * as PtyManager from './pty-manager';

// Session management utilities
export * as SessionHandler from './session-handler';

// Claude integration utilities
export * as ClaudeIntegration from './claude-integration-handler';

// Multi-provider integration utilities
export * as ProviderIntegration from './provider-integration-handler';

// Terminal lifecycle utilities
export * as TerminalLifecycle from './terminal-lifecycle';

// Event handler utilities
export * as TerminalEventHandler from './terminal-event-handler';

// Provider bridge
export { TerminalProviderBridge, createTerminalProviderBridge } from './terminal-provider-bridge';
