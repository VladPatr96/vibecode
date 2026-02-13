import { useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import type { ProviderType } from '../../../shared/types';
import { PROVIDER_DISPLAY_NAMES } from '../../../shared/types';
import { useProjectStore } from '../../stores/project-store';
import { useRoutingStore } from '../../stores/routing-store';

const PHASES: Array<'planning' | 'coding' | 'qa'> = ['planning', 'coding', 'qa'];
const PROVIDERS: ProviderType[] = ['claude', 'gemini', 'openai', 'codex', 'opencode'];

function formatPhaseLabel(phase: 'planning' | 'coding' | 'qa'): string {
  return phase === 'qa' ? 'QA' : phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function RoutingSettings({
  projectId,
  onOpenProviderStatus,
}: {
  projectId?: string;
  onOpenProviderStatus?: () => void;
}) {
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const activeProjectId = projectId || selectedProjectId || null;

  const {
    defaultProviders,
    fallbackChains,
    showConfirmationDialog,
    isLoading,
    error,
    setProject,
    setDefaultProvider,
    setFallbackChain,
    toggleConfirmationDialog,
  } = useRoutingStore();

  useEffect(() => {
    void setProject(activeProjectId);
  }, [activeProjectId, setProject]);

  return (
    <section className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold">Smart Routing</h3>
          <p className="text-sm text-muted-foreground">
            Configure default provider by phase and fallback priority when a provider is unavailable.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenProviderStatus}
          className="gap-1"
        >
          Provider Status
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>

      {!activeProjectId && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Select a project to configure routing settings.
        </div>
      )}

      {activeProjectId && (
        <>
          {isLoading && <div className="text-sm text-muted-foreground">Loading routing settings...</div>}
          {error && <div className="text-sm text-destructive">{error}</div>}

          <div className="grid gap-3">
            {PHASES.map((phase) => (
              <div key={phase} className="grid gap-1.5">
                <Label htmlFor={`routing-phase-${phase}`}>{formatPhaseLabel(phase)} default provider</Label>
                <select
                  id={`routing-phase-${phase}`}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={defaultProviders[phase]}
                  onChange={(event) => setDefaultProvider(phase, event.target.value as ProviderType)}
                >
                  {PROVIDERS.map((provider) => (
                    <option key={provider} value={provider}>
                      {PROVIDER_DISPLAY_NAMES[provider]}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="space-y-3 rounded-lg border border-border p-3">
            <h4 className="text-sm font-medium">Fallback Chains</h4>
            {PROVIDERS.map((provider) => (
              <div key={provider} className="grid gap-1.5">
                <Label htmlFor={`fallback-${provider}`}>{PROVIDER_DISPLAY_NAMES[provider]}</Label>
                <input
                  id={`fallback-${provider}`}
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={(fallbackChains[provider] || []).join(', ')}
                  onChange={(event) => {
                    const parsed = event.target.value
                      .split(',')
                      .map((item) => item.trim())
                      .filter((item): item is ProviderType => PROVIDERS.includes(item as ProviderType));
                    setFallbackChain(provider, parsed);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Show confirmation dialog</p>
              <p className="text-xs text-muted-foreground">
                Ask for confirmation before launching with automatic routing recommendations.
              </p>
            </div>
            <Switch checked={showConfirmationDialog} onCheckedChange={() => toggleConfirmationDialog()} />
          </div>
        </>
      )}
    </section>
  );
}
