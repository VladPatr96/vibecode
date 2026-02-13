import { create } from 'zustand';
import type { ProviderType, RoutingPhase, RoutingSettings } from '../../shared/types';

interface RoutingState {
  defaultProviders: {
    planning: ProviderType;
    coding: ProviderType;
    qa: ProviderType;
  };
  fallbackChains: Record<ProviderType, ProviderType[]>;
  showConfirmationDialog: boolean;
  projectId: string | null;
  isLoading: boolean;
  error: string | null;
  setProject: (projectId: string | null) => Promise<void>;
  setDefaultProvider: (phase: RoutingPhase, provider: ProviderType) => void;
  setFallbackChain: (provider: ProviderType, chain: ProviderType[]) => void;
  toggleConfirmationDialog: () => void;
  loadRoutingSettings: (projectId: string) => Promise<void>;
}

const DEFAULT_STATE: RoutingSettings = {
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

async function persistRoutingSettings(projectId: string, settings: RoutingSettings): Promise<void> {
  if (typeof window === 'undefined' || !window.electronAPI?.routing) {
    return;
  }
  await window.electronAPI.routing.saveDefaults(projectId, settings);
}

function getPersistableState(state: RoutingState): RoutingSettings {
  return {
    defaultProviders: state.defaultProviders,
    fallbackChains: state.fallbackChains,
    showConfirmationDialog: state.showConfirmationDialog,
  };
}

export const useRoutingStore = create<RoutingState>((set, get) => ({
  ...DEFAULT_STATE,
  projectId: null,
  isLoading: false,
  error: null,

  setProject: async (projectId) => {
    set({ projectId });
    if (projectId) {
      await get().loadRoutingSettings(projectId);
    } else {
      set({ ...DEFAULT_STATE, error: null, isLoading: false });
    }
  },

  loadRoutingSettings: async (projectId) => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.routing.getDefaults(projectId);
      if (!result.success || !result.data) {
        set({
          ...DEFAULT_STATE,
          isLoading: false,
          error: result.error || 'Failed to load routing settings',
        });
        return;
      }
      set({
        defaultProviders: result.data.defaultProviders,
        fallbackChains: result.data.fallbackChains,
        showConfirmationDialog: result.data.showConfirmationDialog,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({
        ...DEFAULT_STATE,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load routing settings',
      });
    }
  },

  setDefaultProvider: (phase, provider) => {
    set((state) => ({
      defaultProviders: {
        ...state.defaultProviders,
        [phase]: provider,
      },
    }));
    const state = get();
    if (state.projectId) {
      void persistRoutingSettings(state.projectId, getPersistableState(state));
    }
  },

  setFallbackChain: (provider, chain) => {
    set((state) => ({
      fallbackChains: {
        ...state.fallbackChains,
        [provider]: chain,
      },
    }));
    const state = get();
    if (state.projectId) {
      void persistRoutingSettings(state.projectId, getPersistableState(state));
    }
  },

  toggleConfirmationDialog: () => {
    set((state) => ({
      showConfirmationDialog: !state.showConfirmationDialog,
    }));
    const state = get();
    if (state.projectId) {
      void persistRoutingSettings(state.projectId, getPersistableState(state));
    }
  },
}));
