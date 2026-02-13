import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '../ui/button';
import type { ProviderType } from '../../../shared/types';
import { PROVIDER_DISPLAY_NAMES } from '../../../shared/types';
import { useProjectStore } from '../../stores/project-store';
import { useTerminalStore } from '../../stores/terminal-store';
import { useToast } from '../../hooks/use-toast';

interface ProviderStatus {
  provider: ProviderType;
  installed: boolean;
  authenticated: boolean;
  accountLabel?: string;
  authMethod?: 'oauth' | 'apiKey' | 'token' | 'unknown';
  rateLimitStatus: 'ok' | 'limited' | 'unknown';
}

const PROVIDERS: ProviderType[] = ['claude', 'gemini', 'openai', 'codex', 'opencode'];

export function ProviderStatusPanel({
  onLogin,
  onSwitchProfile,
  onLaunchTerminal,
}: {
  onLogin?: (provider: ProviderType) => void;
  onSwitchProfile?: (provider: ProviderType) => void;
  onLaunchTerminal?: (provider: ProviderType) => void;
}) {
  const [statuses, setStatuses] = useState<ProviderStatus[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const selectedProject = useProjectStore((state) => state.getSelectedProject());
  const addExternalTerminal = useTerminalStore((state) => state.addExternalTerminal);
  const removeTerminal = useTerminalStore((state) => state.removeTerminal);
  const canAddTerminal = useTerminalStore((state) => state.canAddTerminal);
  const getTerminalsForProject = useTerminalStore((state) => state.getTerminalsForProject);
  const setClaudeMode = useTerminalStore((state) => state.setClaudeMode);
  const setTerminalProvider = useTerminalStore((state) => state.setTerminalProvider);
  const setActiveTerminal = useTerminalStore((state) => state.setActiveTerminal);

  const launchProviderTerminal = useCallback(async (provider: ProviderType): Promise<void> => {
    if (!selectedProject?.path) {
      toast({
        variant: 'destructive',
        title: 'No project selected',
        description: 'Select a project first, then launch a provider terminal.',
      });
      return;
    }

    const providerStatus = statuses.find((item) => item.provider === provider);
    if (providerStatus && !providerStatus.installed) {
      toast({
        variant: 'destructive',
        title: `${PROVIDER_DISPLAY_NAMES[provider]} is not installed`,
        description: 'Install the CLI tool and try again.',
      });
      return;
    }

    const projectPath = selectedProject.path;

    let targetTerminalId: string;
    let createdTerminalId: string | null = null;

    if (canAddTerminal(projectPath)) {
      const terminalId = crypto.randomUUID();
      const created = await window.electronAPI.createTerminal({
        id: terminalId,
        cwd: projectPath,
        projectPath,
        providerType: provider,
      });

      if (!created.success) {
        toast({
          variant: 'destructive',
          title: 'Cannot create terminal',
          description: created.error || 'Failed to create terminal backend session.',
        });
        return;
      }

      const terminalTitle = `${PROVIDER_DISPLAY_NAMES[provider]}`;
      const terminal = addExternalTerminal(terminalId, terminalTitle, projectPath, projectPath);
      if (!terminal) {
        // Roll back backend PTY if renderer store failed to add terminal.
        await window.electronAPI.destroyTerminal(terminalId);
        toast({
          variant: 'destructive',
          title: 'Cannot create terminal',
          description: 'Terminal limit reached for this project.',
        });
        return;
      }

      targetTerminalId = terminal.id;
      createdTerminalId = terminal.id;
    } else {
      const existing = getTerminalsForProject(projectPath).filter((terminal) => terminal.status !== 'exited');
      const reusable =
        existing.find((terminal) => terminal.status === 'running') ||
        existing.find((terminal) => terminal.status === 'idle') ||
        (provider === 'claude' ? existing.find((terminal) => terminal.status === 'claude-active') : undefined);

      if (!reusable) {
        toast({
          variant: 'destructive',
          title: 'Terminal limit reached',
          description: 'Close one terminal and try again.',
        });
        return;
      }

      targetTerminalId = reusable.id;
      toast({
        title: 'Using existing terminal',
        description: 'Terminal limit reached; reusing an active terminal.',
      });
    }

    try {
      setActiveTerminal(targetTerminalId);

      // Switch view so user sees the launched terminal immediately.
      window.dispatchEvent(new CustomEvent('open-terminals-view'));

      if (provider === 'claude') {
        setClaudeMode(targetTerminalId, true);
        window.electronAPI.invokeClaudeInTerminal(targetTerminalId, projectPath);
      } else {
        setTerminalProvider(targetTerminalId, provider);
        const result = await window.electronAPI.provider.invokeProviderInTerminal(
          targetTerminalId,
          provider,
          { cwd: projectPath }
        );
        if (!result.success) {
          throw new Error(result.error || `Failed to launch ${PROVIDER_DISPLAY_NAMES[provider]}`);
        }
      }

      toast({
        title: `${PROVIDER_DISPLAY_NAMES[provider]} started`,
        description: 'Switched to Terminals view.',
      });
    } catch (launchError) {
      if (createdTerminalId) {
        await window.electronAPI.destroyTerminal(createdTerminalId).catch(() => undefined);
        removeTerminal(createdTerminalId);
      }
      toast({
        variant: 'destructive',
        title: 'Provider launch failed',
        description:
          launchError instanceof Error ? launchError.message : 'Failed to launch provider terminal.',
      });
    }
  }, [addExternalTerminal, canAddTerminal, getTerminalsForProject, removeTerminal, selectedProject, setActiveTerminal, setClaudeMode, setTerminalProvider, statuses, toast]);

  const handleLogin = useCallback((provider: ProviderType): void => {
    if (onLogin) {
      onLogin(provider);
      return;
    }
    void launchProviderTerminal(provider);
  }, [launchProviderTerminal, onLogin]);

  const handleSwitchProfile = useCallback((provider: ProviderType): void => {
    if (onSwitchProfile) {
      onSwitchProfile(provider);
      return;
    }
    void launchProviderTerminal(provider);
  }, [launchProviderTerminal, onSwitchProfile]);

  const handleLaunchTerminal = useCallback((provider: ProviderType): void => {
    if (onLaunchTerminal) {
      onLaunchTerminal(provider);
      return;
    }
    void launchProviderTerminal(provider);
  }, [launchProviderTerminal, onLaunchTerminal]);

  useEffect(() => {
    const load = async (): Promise<void> => {
      setIsLoading(true);
      setError(null);
      try {
        const providers = await window.electronAPI.provider.getAvailableProviders();
        if (!providers.success || !providers.providers) {
          setError(providers.error || 'Failed to load providers');
          setStatuses(
            PROVIDERS.map((provider) => ({
              provider,
              installed: false,
              authenticated: false,
              rateLimitStatus: 'unknown',
            }))
          );
          setIsLoading(false);
          return;
        }

        const discoveredProviders = new Set<ProviderType>(
          providers.providers.map(({ type }) => type)
        );

        const providerStatuses = await Promise.all(
          PROVIDERS.map(async (type) => {
            if (!discoveredProviders.has(type)) {
              return {
                provider: type,
                installed: false,
                authenticated: false,
                rateLimitStatus: 'unknown' as const,
              };
            }
            const statusResult = await window.electronAPI.provider.getProviderStatus(type);
            if (!statusResult.success || !statusResult.status) {
              return {
                provider: type,
                installed: false,
                authenticated: false,
                rateLimitStatus: 'unknown' as const,
              };
            }
            return {
              ...statusResult.status,
            };
          })
        );
        setStatuses(providerStatuses);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : 'Failed to load provider status');
      } finally {
        setIsLoading(false);
      }
    };
    void load();
  }, []);

  const hasStatuses = useMemo(() => statuses.length > 0, [statuses]);

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold">Provider Status</h3>
        <p className="text-sm text-muted-foreground">
          Installation/auth status and quick actions for all CLI providers.
        </p>
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading provider status...</div>}
      {error && <div className="text-sm text-destructive">{error}</div>}
      {!isLoading && !error && !hasStatuses && (
        <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          No providers discovered.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {statuses.map((status) => (
          <div key={status.provider} className="rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-medium">{PROVIDER_DISPLAY_NAMES[status.provider]}</div>
              <span className={`h-2.5 w-2.5 rounded-full ${status.installed ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>CLI installed: {status.installed ? 'yes' : 'no'}</div>
              <div>Authenticated: {status.authenticated ? 'yes' : 'no'}</div>
              <div>
                Account:{' '}
                {status.accountLabel
                  ? status.accountLabel
                  : status.authenticated
                    ? 'connected'
                    : 'not connected'}
              </div>
              {status.authMethod && <div>Auth method: {status.authMethod}</div>}
              <div>
                Rate limit:{' '}
                {status.rateLimitStatus === 'ok'
                  ? 'ok'
                  : status.rateLimitStatus === 'limited'
                    ? 'limited'
                    : 'unknown'}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleLogin(status.provider)}
              >
                Login
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSwitchProfile(status.provider)}
              >
                Switch Profile
              </Button>
              <Button
                size="sm"
                onClick={() => handleLaunchTerminal(status.provider)}
              >
                Launch Terminal
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
