/**
 * Central registry for CLI providers.
 */

import type { ICLIProvider } from './provider-interface';
import type { ProviderType, ProviderProfile, TerminalProviderState } from './types';

type ProviderFactory = () => ICLIProvider;

class ProviderRegistryImpl {
  private factories: Map<ProviderType, ProviderFactory> = new Map();
  private terminalProviders: Map<string, ICLIProvider> = new Map();
  private terminalStates: Map<string, TerminalProviderState> = new Map();

  register(providerType: ProviderType, factory: ProviderFactory): void {
    this.factories.set(providerType, factory);
  }

  unregister(providerType: ProviderType): void {
    this.factories.delete(providerType);
  }

  getAvailableProviders(): ProviderType[] {
    return Array.from(this.factories.keys());
  }

  async createForTerminal(
    terminalId: string,
    providerType: ProviderType,
    profile: ProviderProfile
  ): Promise<ICLIProvider> {
    const factory = this.factories.get(providerType);
    if (!factory) {
      throw new Error(`Unknown provider type: ${providerType}`);
    }

    // Cleanup existing
    await this.disposeTerminal(terminalId);

    // Create and initialize
    const provider = factory();
    await provider.initialize(profile);

    this.terminalProviders.set(terminalId, provider);
    this.terminalStates.set(terminalId, {
      terminalId,
      providerType,
      profileId: profile.id,
    });

    return provider;
  }

  getTerminalProvider(terminalId: string): ICLIProvider | undefined {
    return this.terminalProviders.get(terminalId);
  }

  getTerminalState(terminalId: string): TerminalProviderState | undefined {
    return this.terminalStates.get(terminalId);
  }

  async disposeTerminal(terminalId: string): Promise<void> {
    const provider = this.terminalProviders.get(terminalId);
    if (provider) {
      await provider.dispose();
      this.terminalProviders.delete(terminalId);
      this.terminalStates.delete(terminalId);
    }
  }

  async switchTerminalProvider(
    terminalId: string,
    providerType: ProviderType,
    profile: ProviderProfile
  ): Promise<ICLIProvider> {
    return this.createForTerminal(terminalId, providerType, profile);
  }

  clearAll(): void {
    this.terminalProviders.clear();
    this.terminalStates.clear();
  }
}

export const providerRegistry = new ProviderRegistryImpl();
