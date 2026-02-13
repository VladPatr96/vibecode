/**
 * @vitest-environment jsdom
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoutingStore } from '../routing-store';
import type { RoutingSettings } from '../../../shared/types';

const defaultSettings: RoutingSettings = {
  defaultProviders: {
    planning: 'claude',
    coding: 'claude',
    qa: 'claude',
  },
  fallbackChains: {
    claude: ['gemini', 'codex', 'openai', 'opencode'],
    gemini: ['claude', 'codex', 'openai', 'opencode'],
    openai: ['codex', 'claude', 'gemini', 'opencode'],
    codex: ['openai', 'claude', 'gemini', 'opencode'],
    opencode: ['claude', 'gemini', 'codex', 'openai'],
  },
  showConfirmationDialog: true,
};

describe('routing-store', () => {
  const getDefaults = vi.fn();
  const saveDefaults = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getDefaults.mockResolvedValue({
      success: true,
      data: defaultSettings,
    });
    saveDefaults.mockResolvedValue({ success: true });

    (window as unknown as { electronAPI: unknown }).electronAPI = {
      routing: {
        getDefaults,
        saveDefaults,
      },
    };

    useRoutingStore.setState({
      ...defaultSettings,
      projectId: null,
      isLoading: false,
      error: null,
    });
  });

  it('loads routing settings when project is selected', async () => {
    await useRoutingStore.getState().setProject('project-1');

    expect(getDefaults).toHaveBeenCalledWith('project-1');
    expect(useRoutingStore.getState().projectId).toBe('project-1');
    expect(useRoutingStore.getState().defaultProviders).toEqual(defaultSettings.defaultProviders);
  });

  it('persists updated default provider', async () => {
    await useRoutingStore.getState().setProject('project-1');
    useRoutingStore.getState().setDefaultProvider('planning', 'gemini');
    await Promise.resolve();

    expect(useRoutingStore.getState().defaultProviders.planning).toBe('gemini');
    expect(saveDefaults).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        defaultProviders: expect.objectContaining({ planning: 'gemini' }),
      })
    );
  });

  it('persists confirmation toggle', async () => {
    await useRoutingStore.getState().setProject('project-1');
    useRoutingStore.getState().toggleConfirmationDialog();
    await Promise.resolve();

    expect(useRoutingStore.getState().showConfirmationDialog).toBe(false);
    expect(saveDefaults).toHaveBeenCalledWith(
      'project-1',
      expect.objectContaining({
        showConfirmationDialog: false,
      })
    );
  });

  it('sets error on failed load', async () => {
    getDefaults.mockResolvedValueOnce({
      success: false,
      error: 'read failed',
    });

    await useRoutingStore.getState().setProject('project-1');

    expect(useRoutingStore.getState().error).toBe('read failed');
    expect(useRoutingStore.getState().defaultProviders).toEqual(defaultSettings.defaultProviders);
  });
});
