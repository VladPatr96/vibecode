/**
 * Unified Credential Store
 * Provider-aware in-memory credential caching with TTL.
 * Actual keychain read/write delegates to platform-specific code.
 */

import type { ProviderCredentials } from '../providers/types';
import type { ProviderType } from '../../shared/types/provider';

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const ERROR_CACHE_TTL_MS = 10 * 1000; // 10 seconds

interface CachedCredential {
  credentials: ProviderCredentials;
  cachedAt: number;
  isError: boolean;
}

export class UnifiedCredentialStore {
  private cache = new Map<string, CachedCredential>();

  getServiceName(providerType: ProviderType, profileIdHash: string): string {
    return `Auto-Claude-${providerType}-credentials-${profileIdHash}`;
  }

  cacheCredentials(profileId: string, credentials: ProviderCredentials): void {
    this.cache.set(profileId, {
      credentials,
      cachedAt: Date.now(),
      isError: false,
    });
  }

  getCachedCredentials(profileId: string): ProviderCredentials | null {
    const cached = this.cache.get(profileId);
    if (!cached) return null;

    const ttl = cached.isError ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS;
    if (Date.now() - cached.cachedAt > ttl) {
      this.cache.delete(profileId);
      return null;
    }

    return cached.credentials;
  }

  cacheError(profileId: string, providerType: ProviderType): void {
    this.cache.set(profileId, {
      credentials: { providerType: providerType as any },
      cachedAt: Date.now(),
      isError: true,
    });
  }

  clearCache(profileId: string): void {
    this.cache.delete(profileId);
  }

  clearAll(): void {
    this.cache.clear();
  }
}

let instance: UnifiedCredentialStore | null = null;

export function getUnifiedCredentialStore(): UnifiedCredentialStore {
  if (!instance) {
    instance = new UnifiedCredentialStore();
  }
  return instance;
}
