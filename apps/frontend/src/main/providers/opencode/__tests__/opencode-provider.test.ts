import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OpencodeCLIProvider, OPENCODE_MODELS } from '../opencode-provider';
import { ProviderType } from '../../types';

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn(),
}));

vi.mock('util', () => ({
  promisify: vi.fn((fn) => fn),
}));

describe('OpencodeCLIProvider', () => {
  let provider: OpencodeCLIProvider;

  beforeEach(() => {
    provider = OpencodeCLIProvider.create();
    vi.clearAllMocks();
  });

  describe('providerType', () => {
    it('should be OPENCODE', () => {
      expect(provider.providerType).toBe(ProviderType.OPENCODE);
    });
  });

  describe('capabilities', () => {
    it('should support OAuth', () => {
      expect(provider.capabilities.supportsOAuth).toBe(true);
    });

    it('should support API key', () => {
      expect(provider.capabilities.supportsApiKey).toBe(true);
    });

    it('should not support session resume', () => {
      expect(provider.capabilities.supportsSessionResume).toBe(false);
    });

    it('should support profile switch', () => {
      expect(provider.capabilities.supportsProfileSwitch).toBe(true);
    });

    it('should have correct supported models', () => {
      expect(provider.capabilities.supportedModels).toEqual([
        'claude-sonnet-4',
        'claude-opus-4',
        'gpt-4o',
        'gpt-4o-mini',
        'gemini-2.0-flash',
        'gemini-1.5-pro',
        'o1',
        'o3-mini',
      ]);
    });
  });

  describe('OPENCODE_MODELS', () => {
    it('should contain expected models', () => {
      expect(OPENCODE_MODELS).toContain('claude-sonnet-4');
      expect(OPENCODE_MODELS).toContain('claude-opus-4');
      expect(OPENCODE_MODELS).toContain('gpt-4o');
      expect(OPENCODE_MODELS).toContain('gemini-2.0-flash');
      expect(OPENCODE_MODELS.length).toBe(8);
    });
  });

  describe('getCliCommand', () => {
    it('should return ["opencode"] when no profile is set', () => {
      const cmd = provider.getCliCommand();
      expect(cmd).toEqual(['opencode']);
    });

    it('should include --model flag when profile has model', async () => {
      await provider.initialize({
        id: 'test-profile',
        name: 'Test Profile',
        providerType: ProviderType.OPENCODE,
        model: 'gpt-4o',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const cmd = provider.getCliCommand();
      expect(cmd).toEqual(['opencode', '--model', 'gpt-4o']);
    });
  });

  describe('getCliEnvironment', () => {
    it('should return empty object when no profile is set', () => {
      const env = provider.getCliEnvironment();
      expect(env).toEqual({});
    });

    it('should include OPENCODE_MODEL when profile has model', async () => {
      await provider.initialize({
        id: 'test-profile',
        name: 'Test Profile',
        providerType: ProviderType.OPENCODE,
        model: 'claude-sonnet-4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      const env = provider.getCliEnvironment();
      expect(env.OPENCODE_MODEL).toBe('claude-sonnet-4');
    });
  });

  describe('resumeSession', () => {
    it('should throw error as session resume is not supported', async () => {
      await expect(provider.resumeSession('session-123')).rejects.toThrow(
        'Session resume is not supported by Opencode provider'
      );
    });
  });

  describe('lifecycle', () => {
    it('should initialize and dispose correctly', async () => {
      const profile = {
        id: 'test-profile',
        name: 'Test Profile',
        providerType: ProviderType.OPENCODE,
        model: 'gpt-4o',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await provider.initialize(profile);
      expect(provider.getCliCommand()).toContain('--model');

      await provider.dispose();
      // After dispose, getCliCommand should return just ['opencode']
      expect(provider.getCliCommand()).toEqual(['opencode']);
    });

    it('should switch profile correctly', async () => {
      const profile1 = {
        id: 'profile-1',
        name: 'Profile 1',
        providerType: ProviderType.OPENCODE,
        model: 'gpt-4o',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const profile2 = {
        id: 'profile-2',
        name: 'Profile 2',
        providerType: ProviderType.OPENCODE,
        model: 'claude-sonnet-4',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await provider.initialize(profile1);
      expect(provider.getCliCommand()).toContain('gpt-4o');

      await provider.switchProfile(profile2);
      expect(provider.getCliCommand()).toContain('claude-sonnet-4');
    });
  });

  describe('handlers', () => {
    it('should return auth handler', () => {
      const handler = provider.getAuthHandler();
      expect(handler).toBeDefined();
      expect(handler.authenticate).toBeDefined();
      expect(handler.validateCredentials).toBeDefined();
    });

    it('should return credential manager', () => {
      const manager = provider.getCredentialManager();
      expect(manager).toBeDefined();
      expect(manager.store).toBeDefined();
      expect(manager.retrieve).toBeDefined();
    });

    it('should return rate limit handler', () => {
      const handler = provider.getRateLimitHandler();
      expect(handler).toBeDefined();
      expect(handler.acquire).toBeDefined();
      expect(handler.getCurrentLimits).toBeDefined();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no credentials', async () => {
      const isAuth = await provider.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });
});
