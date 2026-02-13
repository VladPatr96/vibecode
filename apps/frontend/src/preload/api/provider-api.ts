/**
 * Preload API for multi-CLI provider operations.
 */

import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type { ProviderType } from '../../shared/types';

export interface ProviderInfo {
  type: ProviderType;
  displayName: string;
}

export interface ProviderStatusInfo {
  provider: ProviderType;
  installed: boolean;
  authenticated: boolean;
  accountLabel?: string;
  authMethod?: 'oauth' | 'apiKey' | 'token' | 'unknown';
  rateLimitStatus: 'ok' | 'limited' | 'unknown';
}

export interface ProviderAPI {
  getAvailableProviders: () => Promise<{ success: boolean; providers?: ProviderInfo[]; error?: string }>;
  providerHealthCheck: (providerType: ProviderType) => Promise<{ success: boolean; healthy?: boolean; error?: string }>;
  getProviderStatus: (providerType: ProviderType) => Promise<{ success: boolean; status?: ProviderStatusInfo; error?: string }>;
  invokeProviderInTerminal: (terminalId: string, providerType: ProviderType, options?: { cwd?: string }) => Promise<{ success: boolean; error?: string }>;
}

export const createProviderAPI = (): ProviderAPI => ({
  getAvailableProviders: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_LIST),

  providerHealthCheck: (providerType: ProviderType) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_HEALTH_CHECK, providerType),

  getProviderStatus: (providerType: ProviderType) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_GET_STATUS, providerType),

  invokeProviderInTerminal: (terminalId: string, providerType: ProviderType, options?: { cwd?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_INVOKE_PROVIDER, terminalId, providerType, options),
});
