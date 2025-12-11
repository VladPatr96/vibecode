import { create } from 'zustand';
import type {
  IdeationSession,
  Idea,
  IdeationStatus,
  IdeationGenerationStatus,
  IdeationType,
  IdeationConfig,
  IdeationSummary
} from '../../shared/types';
import { DEFAULT_IDEATION_CONFIG } from '../../shared/constants';

interface IdeationState {
  // Data
  session: IdeationSession | null;
  generationStatus: IdeationGenerationStatus;
  config: IdeationConfig;
  logs: string[];

  // Actions
  setSession: (session: IdeationSession | null) => void;
  setGenerationStatus: (status: IdeationGenerationStatus) => void;
  setConfig: (config: Partial<IdeationConfig>) => void;
  updateIdeaStatus: (ideaId: string, status: IdeationStatus) => void;
  dismissIdea: (ideaId: string) => void;
  clearSession: () => void;
  addLog: (log: string) => void;
  clearLogs: () => void;
}

const initialGenerationStatus: IdeationGenerationStatus = {
  phase: 'idle',
  progress: 0,
  message: ''
};

const initialConfig: IdeationConfig = {
  enabledTypes: [...DEFAULT_IDEATION_CONFIG.enabledTypes] as IdeationType[],
  includeRoadmapContext: DEFAULT_IDEATION_CONFIG.includeRoadmapContext,
  includeKanbanContext: DEFAULT_IDEATION_CONFIG.includeKanbanContext,
  maxIdeasPerType: DEFAULT_IDEATION_CONFIG.maxIdeasPerType
};

export const useIdeationStore = create<IdeationState>((set) => ({
  // Initial state
  session: null,
  generationStatus: initialGenerationStatus,
  config: initialConfig,
  logs: [],

  // Actions
  setSession: (session) => set({ session }),

  setGenerationStatus: (status) => set({ generationStatus: status }),

  setConfig: (newConfig) =>
    set((state) => ({
      config: { ...state.config, ...newConfig }
    })),

  updateIdeaStatus: (ideaId, status) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, status } : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  dismissIdea: (ideaId) =>
    set((state) => {
      if (!state.session) return state;

      const updatedIdeas = state.session.ideas.map((idea) =>
        idea.id === ideaId ? { ...idea, status: 'dismissed' as IdeationStatus } : idea
      );

      return {
        session: {
          ...state.session,
          ideas: updatedIdeas,
          updatedAt: new Date()
        }
      };
    }),

  clearSession: () =>
    set({
      session: null,
      generationStatus: initialGenerationStatus
    }),

  addLog: (log) =>
    set((state) => ({
      logs: [...state.logs, log].slice(-100) // Keep last 100 logs
    })),

  clearLogs: () => set({ logs: [] })
}));

// Helper functions for loading ideation
export async function loadIdeation(projectId: string): Promise<void> {
  const result = await window.electronAPI.getIdeation(projectId);
  if (result.success && result.data) {
    useIdeationStore.getState().setSession(result.data);
  } else {
    useIdeationStore.getState().setSession(null);
  }
}

export function generateIdeation(projectId: string): void {
  const config = useIdeationStore.getState().config;
  useIdeationStore.getState().clearLogs();
  useIdeationStore.getState().addLog('Starting ideation generation...');
  useIdeationStore.getState().setGenerationStatus({
    phase: 'analyzing',
    progress: 0,
    message: 'Starting ideation generation...'
  });
  window.electronAPI.generateIdeation(projectId, config);
}

export function refreshIdeation(projectId: string): void {
  const config = useIdeationStore.getState().config;
  useIdeationStore.getState().clearLogs();
  useIdeationStore.getState().addLog('Refreshing ideation...');
  useIdeationStore.getState().setGenerationStatus({
    phase: 'analyzing',
    progress: 0,
    message: 'Refreshing ideation...'
  });
  window.electronAPI.refreshIdeation(projectId, config);
}

// Selectors
export function getIdeasByType(
  session: IdeationSession | null,
  type: IdeationType
): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.type === type);
}

export function getIdeasByStatus(
  session: IdeationSession | null,
  status: IdeationStatus
): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.status === status);
}

export function getActiveIdeas(session: IdeationSession | null): Idea[] {
  if (!session) return [];
  return session.ideas.filter((idea) => idea.status !== 'dismissed');
}

export function getIdeationSummary(session: IdeationSession | null): IdeationSummary {
  if (!session) {
    return {
      totalIdeas: 0,
      byType: {} as Record<IdeationType, number>,
      byStatus: {} as Record<IdeationStatus, number>
    };
  }

  const byType: Record<string, number> = {};
  const byStatus: Record<string, number> = {};

  session.ideas.forEach((idea) => {
    byType[idea.type] = (byType[idea.type] || 0) + 1;
    byStatus[idea.status] = (byStatus[idea.status] || 0) + 1;
  });

  return {
    totalIdeas: session.ideas.length,
    byType: byType as Record<IdeationType, number>,
    byStatus: byStatus as Record<IdeationStatus, number>,
    lastGenerated: session.generatedAt
  };
}

// Type guards for idea types
export function isLowHangingFruitIdea(idea: Idea): idea is Idea & { type: 'low_hanging_fruit' } {
  return idea.type === 'low_hanging_fruit';
}

export function isUIUXIdea(idea: Idea): idea is Idea & { type: 'ui_ux_improvements' } {
  return idea.type === 'ui_ux_improvements';
}

export function isHighValueIdea(idea: Idea): idea is Idea & { type: 'high_value_features' } {
  return idea.type === 'high_value_features';
}
