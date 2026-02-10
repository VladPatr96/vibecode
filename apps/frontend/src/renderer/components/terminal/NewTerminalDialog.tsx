/**
 * Dialog for creating new terminal with provider selection.
 */

import React, { useState, useEffect } from 'react';
import { ProviderSelector } from '../providers/ProviderSelector';
import type { ProviderType, ProviderProfile } from '@shared/types';
import { PROVIDER_DISPLAY_NAMES, DEFAULT_MODELS } from '@shared/types';
import { cn } from '@/lib/utils';

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

  const availableProviders: ProviderType[] = ['claude', 'gemini', 'openai', 'opencode'];

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

        <ProviderSelector
          availableProviders={availableProviders}
          selectedProvider={selectedProvider}
          profiles={existingProfiles}
          selectedProfileId={selectedProfileId}
          onProviderChange={setSelectedProvider}
          onProfileChange={setSelectedProfileId}
          className="mb-4"
        />

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
