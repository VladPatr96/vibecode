import { useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import type { ProviderType, RoutingRecommendation } from '../../../shared/types';
import { PROVIDER_DISPLAY_NAMES, DEFAULT_MODELS } from '../../../shared/types';

type PhaseConfig = { provider: ProviderType; model: string };

interface ProviderRoutingDialogProps {
  open: boolean;
  recommendation: RoutingRecommendation | null;
  providerHealth?: Partial<Record<ProviderType, boolean>>;
  onCancel: () => void;
  onStart: (
    phases: { planning: PhaseConfig; coding: PhaseConfig; qa: PhaseConfig },
    options: { useForAllPhases: boolean; dontShowAgain: boolean }
  ) => void;
}

const PROVIDERS: ProviderType[] = ['claude', 'gemini', 'openai', 'codex', 'opencode'];
const PHASES: Array<'planning' | 'coding' | 'qa'> = ['planning', 'coding', 'qa'];

function titleCasePhase(phase: 'planning' | 'coding' | 'qa'): string {
  if (phase === 'qa') return 'QA';
  return phase.charAt(0).toUpperCase() + phase.slice(1);
}

export function ProviderRoutingDialog({
  open,
  recommendation,
  providerHealth = {},
  onCancel,
  onStart,
}: ProviderRoutingDialogProps) {
  const initialState = useMemo(() => {
    return {
      planning: {
        provider: recommendation?.planning.provider_type ?? 'claude',
        model: recommendation?.planning.model ?? DEFAULT_MODELS.claude,
      },
      coding: {
        provider: recommendation?.coding.provider_type ?? 'claude',
        model: recommendation?.coding.model ?? DEFAULT_MODELS.claude,
      },
      qa: {
        provider: recommendation?.qa.provider_type ?? 'claude',
        model: recommendation?.qa.model ?? DEFAULT_MODELS.claude,
      },
    };
  }, [recommendation]);

  const [phaseConfig, setPhaseConfig] = useState(initialState);
  const [useForAllPhases, setUseForAllPhases] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    setPhaseConfig(initialState);
    setUseForAllPhases(false);
    setDontShowAgain(false);
  }, [initialState, open]);

  const updatePhaseProvider = (phase: 'planning' | 'coding' | 'qa', provider: ProviderType): void => {
    if (useForAllPhases) {
      const model = DEFAULT_MODELS[provider];
      setPhaseConfig({
        planning: { provider, model },
        coding: { provider, model },
        qa: { provider, model },
      });
      return;
    }
    setPhaseConfig((prev) => ({
      ...prev,
      [phase]: {
        provider,
        model: DEFAULT_MODELS[provider],
      },
    }));
  };

  const updatePhaseModel = (phase: 'planning' | 'coding' | 'qa', model: string): void => {
    if (useForAllPhases) {
      setPhaseConfig((prev) => ({
        planning: { ...prev.planning, model },
        coding: { ...prev.coding, model },
        qa: { ...prev.qa, model },
      }));
      return;
    }
    setPhaseConfig((prev) => ({
      ...prev,
      [phase]: {
        ...prev[phase],
        model,
      },
    }));
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onCancel(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Provider Routing</DialogTitle>
          <DialogDescription>
            Review recommendations per phase and override providers/models before launch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {PHASES.map((phase) => {
            const rec = recommendation?.[phase];
            const selected = phaseConfig[phase];
            return (
              <div key={phase} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-medium">{titleCasePhase(phase)}</div>
                  {rec && (
                    <div className="text-xs text-muted-foreground">
                      Recommended: {PROVIDER_DISPLAY_NAMES[rec.provider_type]} ({rec.model})
                    </div>
                  )}
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                  <select
                    aria-label={`${phase}-provider`}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={selected.provider}
                    onChange={(event) => updatePhaseProvider(phase, event.target.value as ProviderType)}
                  >
                    {PROVIDERS.map((provider) => (
                      <option key={provider} value={provider}>
                        {PROVIDER_DISPLAY_NAMES[provider]}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`${phase}-model`}
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={selected.model}
                    onChange={(event) => updatePhaseModel(phase, event.target.value)}
                  />
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${providerHealth[selected.provider] === false ? 'bg-red-500' : 'bg-green-500'}`}
                    />
                    {providerHealth[selected.provider] === false ? 'Unhealthy' : 'Healthy'}
                  </div>
                </div>
                {rec?.reason && (
                  <p className="mt-2 text-xs text-muted-foreground">{rec.reason}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="routing-use-all-phases"
              checked={useForAllPhases}
              onCheckedChange={(checked) => setUseForAllPhases(Boolean(checked))}
            />
            <Label htmlFor="routing-use-all-phases">Use for all phases</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="routing-dont-show-again"
              checked={dontShowAgain}
              onCheckedChange={(checked) => setDontShowAgain(Boolean(checked))}
            />
            <Label htmlFor="routing-dont-show-again">Don&apos;t show again</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button
            onClick={() => {
              onStart(phaseConfig, { useForAllPhases, dontShowAgain });
            }}
          >
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
