import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import type { ProviderType } from '../../../shared/types';
import { DEFAULT_MODELS, PROVIDER_DISPLAY_NAMES } from '../../../shared/types';
import { ProviderStatusPanel } from '../providers/ProviderStatusPanel';

interface ProviderProfile {
  id: string;
  name: string;
  model: string;
  isActive: boolean;
}

type ProviderProfileState = Record<ProviderType, ProviderProfile[]>;

const STORAGE_KEY = 'provider-profile-settings-v1';
const PROVIDERS: ProviderType[] = ['claude', 'gemini', 'openai', 'codex', 'opencode'];

function getDefaultState(): ProviderProfileState {
  return {
    claude: [{ id: 'claude-default', name: 'Default', model: DEFAULT_MODELS.claude, isActive: true }],
    gemini: [{ id: 'gemini-default', name: 'Default', model: DEFAULT_MODELS.gemini, isActive: true }],
    openai: [{ id: 'openai-default', name: 'Default', model: DEFAULT_MODELS.openai, isActive: true }],
    codex: [{ id: 'codex-default', name: 'Default', model: DEFAULT_MODELS.codex, isActive: true }],
    opencode: [{ id: 'opencode-default', name: 'Default', model: DEFAULT_MODELS.opencode, isActive: true }],
  };
}

export function ProviderProfileSettings() {
  const [profilesByProvider, setProfilesByProvider] = useState<ProviderProfileState>(getDefaultState);
  const [newProfileName, setNewProfileName] = useState<Record<ProviderType, string>>({
    claude: '',
    gemini: '',
    openai: '',
    codex: '',
    opencode: '',
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<ProviderProfileState>;
      setProfilesByProvider({
        ...getDefaultState(),
        ...parsed,
      });
    } catch {
      setProfilesByProvider(getDefaultState());
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profilesByProvider));
  }, [profilesByProvider]);

  const providerEntries = useMemo(
    () => PROVIDERS.map((provider) => ({ provider, profiles: profilesByProvider[provider] || [] })),
    [profilesByProvider]
  );

  return (
    <section className="space-y-4">
      <ProviderStatusPanel />

      <div>
        <h3 className="text-base font-semibold">Provider Profiles</h3>
        <p className="text-sm text-muted-foreground">
          Manage profiles and per-profile models for each CLI provider.
        </p>
      </div>

      <div className="space-y-4">
        {providerEntries.map(({ provider, profiles }) => (
          <div key={provider} className="rounded-lg border border-border p-3">
            <div className="mb-2 text-sm font-medium">{PROVIDER_DISPLAY_NAMES[provider]}</div>

            <div className="space-y-2">
              {profiles.map((profile) => (
                <div key={profile.id} className="grid items-center gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
                  <Input
                    value={profile.name}
                    onChange={(event) => {
                      setProfilesByProvider((prev) => ({
                        ...prev,
                        [provider]: prev[provider].map((item) =>
                          item.id === profile.id ? { ...item, name: event.target.value } : item
                        ),
                      }));
                    }}
                  />
                  <Input
                    value={profile.model}
                    onChange={(event) => {
                      setProfilesByProvider((prev) => ({
                        ...prev,
                        [provider]: prev[provider].map((item) =>
                          item.id === profile.id ? { ...item, model: event.target.value } : item
                        ),
                      }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant={profile.isActive ? 'default' : 'outline'}
                    onClick={() => {
                      setProfilesByProvider((prev) => ({
                        ...prev,
                        [provider]: prev[provider].map((item) => ({
                          ...item,
                          isActive: item.id === profile.id,
                        })),
                      }));
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    Active
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setProfilesByProvider((prev) => ({
                        ...prev,
                        [provider]: prev[provider].filter((item) => item.id !== profile.id),
                      }));
                    }}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Label htmlFor={`profile-name-${provider}`} className="sr-only">
                New profile name
              </Label>
              <Input
                id={`profile-name-${provider}`}
                placeholder="New profile name"
                value={newProfileName[provider]}
                onChange={(event) => {
                  setNewProfileName((prev) => ({ ...prev, [provider]: event.target.value }));
                }}
              />
              <Button
                size="sm"
                onClick={() => {
                  const name = newProfileName[provider].trim();
                  if (!name) return;
                  const id = `${provider}-${Date.now()}`;
                  setProfilesByProvider((prev) => ({
                    ...prev,
                    [provider]: [
                      ...prev[provider],
                      { id, name, model: DEFAULT_MODELS[provider], isActive: false },
                    ],
                  }));
                  setNewProfileName((prev) => ({ ...prev, [provider]: '' }));
                }}
              >
                <Plus className="mr-1 h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
