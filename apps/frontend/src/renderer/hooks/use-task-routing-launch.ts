import { useCallback, useState } from 'react';
import { DEFAULT_MODELS } from '../../shared/types/provider';
import type {
  ProviderType,
  RoutingRecommendation,
  RoutingSettings,
} from '../../shared/types';
import { startTask } from '../stores/task-store';

type PhaseRoutingConfig = {
  planning: { provider: ProviderType; model: string };
  coding: { provider: ProviderType; model: string };
  qa: { provider: ProviderType; model: string };
};

interface TaskRoutingInput {
  id: string;
  projectId: string;
  title: string;
  description: string;
}

const PROVIDERS: ProviderType[] = ['claude', 'gemini', 'openai', 'codex', 'opencode'];

function recommendationToRoutingConfig(recommendation: RoutingRecommendation): PhaseRoutingConfig {
  return {
    planning: {
      provider: recommendation.planning.provider_type,
      model: recommendation.planning.model || DEFAULT_MODELS[recommendation.planning.provider_type],
    },
    coding: {
      provider: recommendation.coding.provider_type,
      model: recommendation.coding.model || DEFAULT_MODELS[recommendation.coding.provider_type],
    },
    qa: {
      provider: recommendation.qa.provider_type,
      model: recommendation.qa.model || DEFAULT_MODELS[recommendation.qa.provider_type],
    },
  };
}

export function useTaskRoutingLaunch(task: TaskRoutingInput) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recommendation, setRecommendation] = useState<RoutingRecommendation | null>(null);
  const [providerHealth, setProviderHealth] = useState<Partial<Record<ProviderType, boolean>>>({});
  const [settingsSnapshot, setSettingsSnapshot] = useState<RoutingSettings | null>(null);

  const cancel = useCallback(() => {
    setDialogOpen(false);
    setRecommendation(null);
  }, []);

  const loadProviderHealth = useCallback(async (): Promise<void> => {
    try {
      const checks = await Promise.all(
        PROVIDERS.map(async (provider) => {
          const health = await window.electronAPI.provider.providerHealthCheck(provider);
          return { provider, healthy: Boolean(health.success && health.healthy !== false) };
        })
      );
      const nextState: Partial<Record<ProviderType, boolean>> = {};
      for (const check of checks) {
        nextState[check.provider] = check.healthy;
      }
      setProviderHealth(nextState);
    } catch {
      setProviderHealth({});
    }
  }, []);

  const startWithRouting = useCallback(async (): Promise<void> => {
    if (!window.electronAPI?.routing) {
      startTask(task.id);
      return;
    }

    try {
      const defaultsResult = await window.electronAPI.routing.getDefaults(task.projectId);
      const routingSettings = defaultsResult.success && defaultsResult.data ? defaultsResult.data : null;
      setSettingsSnapshot(routingSettings);

      const analyzeResult = await window.electronAPI.routing.analyzeTask({
        projectId: task.projectId,
        specContent: `${task.title}\n\n${task.description}`,
      });

      if (!analyzeResult.success || !analyzeResult.data) {
        startTask(task.id);
        return;
      }

      const routingConfig = recommendationToRoutingConfig(analyzeResult.data);
      const shouldShowDialog = routingSettings?.showConfirmationDialog ?? true;

      if (!shouldShowDialog) {
        startTask(task.id, { routingConfig });
        return;
      }

      setRecommendation(analyzeResult.data);
      setDialogOpen(true);
      void loadProviderHealth();
    } catch {
      startTask(task.id);
    }
  }, [loadProviderHealth, task.description, task.id, task.projectId, task.title]);

  const confirm = useCallback(
    async (
      phases: PhaseRoutingConfig,
      options: { useForAllPhases: boolean; dontShowAgain: boolean }
    ): Promise<void> => {
      startTask(task.id, { routingConfig: phases });
      setDialogOpen(false);

      if (!window.electronAPI?.routing || (!options.useForAllPhases && !options.dontShowAgain)) {
        return;
      }

      try {
        let nextSettings = settingsSnapshot;
        if (!nextSettings) {
          const current = await window.electronAPI.routing.getDefaults(task.projectId);
          nextSettings = current.success && current.data ? current.data : null;
        }
        if (!nextSettings) {
          return;
        }

        const updated: RoutingSettings = {
          ...nextSettings,
          defaultProviders: options.useForAllPhases
            ? {
                planning: phases.planning.provider,
                coding: phases.coding.provider,
                qa: phases.qa.provider,
              }
            : nextSettings.defaultProviders,
          showConfirmationDialog: options.dontShowAgain ? false : nextSettings.showConfirmationDialog,
        };

        await window.electronAPI.routing.saveDefaults(task.projectId, updated);
        setSettingsSnapshot(updated);
      } catch {
        // No-op: task execution should continue even if persisting UI preferences fails.
      }
    },
    [settingsSnapshot, task.id, task.projectId]
  );

  return {
    dialogOpen,
    recommendation,
    providerHealth,
    startWithRouting,
    cancel,
    confirm,
  };
}
