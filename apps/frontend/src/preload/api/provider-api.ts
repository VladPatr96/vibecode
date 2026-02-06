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

export interface ProviderAPI {
  getAvailableProviders: () => Promise<{ success: boolean; providers?: ProviderInfo[]; error?: string }>;
  providerHealthCheck: (providerType: ProviderType) => Promise<{ success: boolean; healthy?: boolean; error?: string }>;
  invokeProviderInTerminal: (terminalId: string, providerType: ProviderType, options?: { cwd?: string }) => Promise<{ success: boolean; error?: string }>;
}

export const createProviderAPI = (): ProviderAPI => ({
  getAvailableProviders: () =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_LIST),

  providerHealthCheck: (providerType: ProviderType) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROVIDER_HEALTH_CHECK, providerType),

  invokeProviderInTerminal: (terminalId: string, providerType: ProviderType, options?: { cwd?: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.TERMINAL_INVOKE_PROVIDER, terminalId, providerType, options),
});
