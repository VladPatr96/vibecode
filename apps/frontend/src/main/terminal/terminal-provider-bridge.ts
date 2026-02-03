/**
 * Bridge between terminal manager and providers.
 */

import { providerRegistry } from '../providers';
import type { ICLIProvider } from '../providers/provider-interface';
import type { ProviderType, ProviderProfile } from '../providers/types';

export interface TerminalProviderConfig {
  terminalId: string;
  providerType: ProviderType;
  profile: ProviderProfile;
  workingDirectory: string;
}

export class TerminalProviderBridge {
  private terminalId: string;
  private provider: ICLIProvider | null = null;

  constructor(terminalId: string) {
    this.terminalId = terminalId;
  }

  async initialize(config: TerminalProviderConfig): Promise<void> {
    this.provider = await providerRegistry.createForTerminal(
      config.terminalId,
      config.providerType,
      config.profile
    );
  }

  getProvider(): ICLIProvider | null {
    return this.provider;
  }

  getCliCommand(): string[] {
    if (!this.provider) {
      throw new Error('Terminal provider not initialized');
    }
    return this.provider.getCliCommand();
  }

  getCliEnvironment(): Record<string, string> {
    if (!this.provider) {
      throw new Error('Terminal provider not initialized');
    }
    return this.provider.getCliEnvironment();
  }

  async switchProvider(
    providerType: ProviderType,
    profile: ProviderProfile
  ): Promise<void> {
    this.provider = await providerRegistry.switchTerminalProvider(
      this.terminalId,
      providerType,
      profile
    );
  }

  async resumeSession(sessionId: string): Promise<void> {
    if (!this.provider) {
      throw new Error('Terminal provider not initialized');
    }
    await this.provider.resumeSession(sessionId);
  }

  getProviderType(): ProviderType | undefined {
    return this.provider?.providerType;
  }

  getCapabilities() {
    return this.provider?.capabilities;
  }

  async dispose(): Promise<void> {
    await providerRegistry.disposeTerminal(this.terminalId);
    this.provider = null;
  }
}

// Factory function
export function createTerminalProviderBridge(
  terminalId: string
): TerminalProviderBridge {
  return new TerminalProviderBridge(terminalId);
}
