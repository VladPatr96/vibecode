/**
 * Dialog for creating new terminal with provider selection.
 */

import React, { useState, useEffect } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ProviderType, ProviderProfile } from '../providers/ProviderSelector';
import { cn } from '@/lib/utils';

const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  claude: 'Claude Code',
  gemini: 'Gemini CLI',
  openai: 'OpenAI Codex',
  opencode: 'OpenCode',
};

const PROVIDER_ICONS: Record<ProviderType, string> = {
  claude: '🟠',
  gemini: '🔵',
  openai: '🟢',
  opencode: '🟣',
};

const DEFAULT_MODELS: Record<ProviderType, string> = {
  claude: 'claude-sonnet-4-20250514',
  gemini: 'gemini-2.0-flash',
  openai: 'gpt-4o',
  opencode: 'opencode-v1',
};

interface NewTerminalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTerminal: (providerType: ProviderType, profile: ProviderProfile) => void;
  existingProfiles?: ProviderProfile[];
}

export const NewTerminalDialog: React.FC<NewTerminalDialogProps> = ({
  isOpen,
  onClose,
  onCreateTerminal,
  existingProfiles = [],
}) => {
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('claude');
  const [selectedProfileId, setSelectedProfileId] = useState<string>('');
  const [newProfileName, setNewProfileName] = useState<string>('');

  const filteredProfiles = existingProfiles.filter(
    (p) => p.providerType === selectedProvider
  );

  useEffect(() => {
    if (filteredProfiles.length > 0) {
      setSelectedProfileId(filteredProfiles[0].id);
    } else {
      setSelectedProfileId('');
    }
  }, [selectedProvider, filteredProfiles.length]);

  const handleCreate = () => {
    let profile: ProviderProfile;

    if (selectedProfileId && filteredProfiles.length > 0) {
      const existingProfile = filteredProfiles.find((p) => p.id === selectedProfileId);
      if (existingProfile) {
        profile = existingProfile;
      } else {
        profile = createDefaultProfile();
      }
    } else {
      profile = createDefaultProfile();
    }

    onCreateTerminal(selectedProvider, profile);
    onClose();
  };

  const createDefaultProfile = (): ProviderProfile => ({
    id: `${selectedProvider}-${Date.now()}`,
    name: newProfileName || `Default ${PROVIDER_DISPLAY_NAMES[selectedProvider]}`,
    providerType: selectedProvider,
    model: DEFAULT_MODELS[selectedProvider],
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      handleCreate();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
      onKeyDown={handleKeyDown}
    >
      <div
        className={cn(
          'bg-background border border-border rounded-lg shadow-xl',
          'w-full max-w-md p-6',
          'animate-in fade-in-0 zoom-in-95'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">New Terminal</h2>

        <div className="mb-6">
          <label className="text-sm text-muted-foreground mb-2 block">Provider</label>
          <Tabs
            value={selectedProvider}
            onValueChange={(v) => setSelectedProvider(v as ProviderType)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-secondary/50">
              <TabsTrigger
                value="claude"
                className="flex flex-col gap-1 py-2 data-[state=active]:bg-orange-500 data-[state=active]:text-white transition-all"
              >
                <span className="text-lg">{PROVIDER_ICONS.claude}</span>
                <span className="text-xs">Claude</span>
              </TabsTrigger>
              <TabsTrigger
                value="gemini"
                className="flex flex-col gap-1 py-2 data-[state=active]:bg-blue-500 data-[state=active]:text-white transition-all"
              >
                <span className="text-lg">{PROVIDER_ICONS.gemini}</span>
                <span className="text-xs">Gemini</span>
              </TabsTrigger>
              <TabsTrigger
                value="openai"
                className="flex flex-col gap-1 py-2 data-[state=active]:bg-green-500 data-[state=active]:text-white transition-all"
              >
                <span className="text-lg">{PROVIDER_ICONS.openai}</span>
                <span className="text-xs">OpenAI</span>
              </TabsTrigger>
              <TabsTrigger
                value="opencode"
                className="flex flex-col gap-1 py-2 data-[state=active]:bg-purple-500 data-[state=active]:text-white transition-all"
              >
                <span className="text-lg">{PROVIDER_ICONS.opencode}</span>
                <span className="text-xs">Opencode</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {filteredProfiles.length > 0 && (
          <div className="mb-4">
            <label
              htmlFor="profile-select"
              className="block text-sm text-muted-foreground mb-2"
            >
              Profile:
            </label>
            <select
              id="profile-select"
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className={cn(
                'w-full px-3 py-2 rounded-md border border-border bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            >
              {filteredProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name} ({profile.model})
                </option>
              ))}
            </select>
          </div>
        )}

        {filteredProfiles.length === 0 && (
          <div className="new-profile-section mb-4">
            <label
              htmlFor="profile-name"
              className="block text-sm text-muted-foreground mb-2"
            >
              Profile Name:
            </label>
            <input
              id="profile-name"
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder={`Default ${PROVIDER_DISPLAY_NAMES[selectedProvider]}`}
              className={cn(
                'w-full px-3 py-2 rounded-md border border-border bg-background text-sm',
                'focus:outline-none focus:ring-2 focus:ring-primary/50'
              )}
            />
          </div>
        )}

        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className={cn(
              'px-4 py-2 rounded-md border border-border text-sm',
              'hover:bg-muted transition-colors'
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className={cn(
              'px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm',
              'hover:bg-primary/90 transition-colors'
            )}
          >
            Create Terminal
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewTerminalDialog;
