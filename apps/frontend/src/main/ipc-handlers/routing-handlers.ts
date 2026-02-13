import { ipcMain } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import { projectStore } from '../project-store';
import type {
  IPCResult,
  ProviderRecommendation,
  ProviderType,
  RoutingAnalyzeTaskInput,
  RoutingPhase,
  RoutingRecommendation,
  RoutingSettings,
} from '../../shared/types';
import { DEFAULT_MODELS } from '../../shared/types/provider';

const DEFAULT_ROUTING_SETTINGS: RoutingSettings = {
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

function getRoutingSettingsPath(projectId: string): string {
  const project = projectStore.getProject(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const autoBuildDir = project.autoBuildPath || '.auto-claude';
  return path.join(project.path, autoBuildDir, 'routing-settings.json');
}

function readRoutingSettings(projectId: string): RoutingSettings {
  const settingsPath = getRoutingSettingsPath(projectId);
  if (!existsSync(settingsPath)) {
    return DEFAULT_ROUTING_SETTINGS;
  }

  try {
    const parsed = JSON.parse(readFileSync(settingsPath, 'utf-8')) as Partial<RoutingSettings>;
    return {
      defaultProviders: {
        ...DEFAULT_ROUTING_SETTINGS.defaultProviders,
        ...(parsed.defaultProviders || {}),
      },
      fallbackChains: {
        ...DEFAULT_ROUTING_SETTINGS.fallbackChains,
        ...(parsed.fallbackChains || {}),
      },
      showConfirmationDialog:
        typeof parsed.showConfirmationDialog === 'boolean'
          ? parsed.showConfirmationDialog
          : DEFAULT_ROUTING_SETTINGS.showConfirmationDialog,
    };
  } catch {
    return DEFAULT_ROUTING_SETTINGS;
  }
}

function writeRoutingSettings(projectId: string, settings: RoutingSettings): void {
  const settingsPath = getRoutingSettingsPath(projectId);
  const settingsDir = path.dirname(settingsPath);
  if (!existsSync(settingsDir)) {
    mkdirSync(settingsDir, { recursive: true });
  }
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

function isLikelyTypeScriptTask(specContent: string): boolean {
  return /(typescript|tsx?|tsconfig|react|next\.js|vite|electron|eslint)/i.test(specContent);
}

function getBasePhaseProvider(phase: RoutingPhase, specContent: string): ProviderRecommendation {
  const isLargeContext = specContent.length > 10_000;
  const isQuickTask = specContent.length > 0 && specContent.length < 2_000;
  const isTypeScript = isLikelyTypeScriptTask(specContent);

  if (phase === 'planning' && isLargeContext) {
    return {
      provider_type: 'gemini',
      model: DEFAULT_MODELS.gemini,
      reason: 'Large context task detected; Gemini handles long context well.',
      confidence: 0.87,
    };
  }

  if (phase === 'coding' && isTypeScript) {
    return {
      provider_type: 'claude',
      model: DEFAULT_MODELS.claude,
      reason: 'TypeScript-heavy implementation; Claude is preferred for complex coding.',
      confidence: 0.83,
    };
  }

  if (isQuickTask) {
    return {
      provider_type: 'codex',
      model: DEFAULT_MODELS.codex,
      reason: 'Small/quick task detected; Codex is fast for short iterations.',
      confidence: 0.74,
    };
  }

  return {
    provider_type: 'claude',
    model: DEFAULT_MODELS.claude,
    reason: 'Default balanced routing.',
    confidence: 0.6,
  };
}

function resolveRateLimitedProvider(
  provider: ProviderType,
  fallbackChains: Record<ProviderType, ProviderType[]>,
  rateLimitedProviders: Set<ProviderType>
): ProviderType {
  if (!rateLimitedProviders.has(provider)) {
    return provider;
  }
  const fallback = fallbackChains[provider].find((candidate) => !rateLimitedProviders.has(candidate));
  return fallback || provider;
}

export function analyzeRoutingRecommendation(
  input: RoutingAnalyzeTaskInput,
  settings: RoutingSettings = DEFAULT_ROUTING_SETTINGS
): RoutingRecommendation {
  const rateLimited = new Set((input.rateLimitedProviders || []).map((provider) => provider as ProviderType));
  const defaultProviders = {
    ...settings.defaultProviders,
    ...(input.userDefaults || {}),
  };

  const planningBase = getBasePhaseProvider('planning', input.specContent);
  const codingBase = getBasePhaseProvider('coding', input.specContent);
  const qaBase = getBasePhaseProvider('qa', input.specContent);

  const isExplicitOverride = (phase: RoutingPhase, provider: ProviderType): boolean => {
    const baseline = DEFAULT_ROUTING_SETTINGS.defaultProviders[phase];
    const hasUserDefault = Boolean(input.userDefaults && input.userDefaults[phase]);
    return hasUserDefault || provider !== baseline;
  };

  const planningPreferred = isExplicitOverride('planning', defaultProviders.planning)
    ? defaultProviders.planning
    : planningBase.provider_type;
  const codingPreferred = isExplicitOverride('coding', defaultProviders.coding)
    ? defaultProviders.coding
    : codingBase.provider_type;
  const qaPreferred = isExplicitOverride('qa', defaultProviders.qa)
    ? defaultProviders.qa
    : qaBase.provider_type;

  const planningProvider = resolveRateLimitedProvider(
    planningPreferred,
    settings.fallbackChains,
    rateLimited
  );
  const codingProvider = resolveRateLimitedProvider(
    codingPreferred,
    settings.fallbackChains,
    rateLimited
  );
  const qaProvider = resolveRateLimitedProvider(
    qaPreferred,
    settings.fallbackChains,
    rateLimited
  );

  return {
    planning: {
      provider_type: planningProvider,
      model: DEFAULT_MODELS[planningProvider],
      reason: planningProvider === planningBase.provider_type
        ? planningBase.reason
        : `Default provider adjusted due to rate limit fallback from ${defaultProviders.planning}.`,
      confidence: planningProvider === planningBase.provider_type ? planningBase.confidence : 0.55,
    },
    coding: {
      provider_type: codingProvider,
      model: DEFAULT_MODELS[codingProvider],
      reason: codingProvider === codingBase.provider_type
        ? codingBase.reason
        : `Default provider adjusted due to rate limit fallback from ${defaultProviders.coding}.`,
      confidence: codingProvider === codingBase.provider_type ? codingBase.confidence : 0.55,
    },
    qa: {
      provider_type: qaProvider,
      model: DEFAULT_MODELS[qaProvider],
      reason: qaProvider === qaBase.provider_type
        ? qaBase.reason
        : `Default provider adjusted due to rate limit fallback from ${defaultProviders.qa}.`,
      confidence: qaProvider === qaBase.provider_type ? qaBase.confidence : 0.55,
    },
  };
}

export function registerRoutingHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.ROUTING_ANALYZE_TASK,
    async (
      _event,
      input: RoutingAnalyzeTaskInput
    ): Promise<IPCResult<RoutingRecommendation>> => {
      try {
        const settings = input.projectId
          ? readRoutingSettings(input.projectId)
          : DEFAULT_ROUTING_SETTINGS;
        const recommendation = analyzeRoutingRecommendation(input, settings);
        return { success: true, data: recommendation };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to analyze routing',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ROUTING_GET_DEFAULTS,
    async (_event, projectId: string): Promise<IPCResult<RoutingSettings>> => {
      try {
        const settings = readRoutingSettings(projectId);
        return { success: true, data: settings };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load routing defaults',
        };
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.ROUTING_SAVE_DEFAULTS,
    async (_event, projectId: string, settings: RoutingSettings): Promise<IPCResult> => {
      try {
        writeRoutingSettings(projectId, settings);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save routing defaults',
        };
      }
    }
  );
}

export { DEFAULT_ROUTING_SETTINGS };
