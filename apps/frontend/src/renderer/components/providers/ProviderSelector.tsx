/**
 * Provider selector component for terminal provider selection.
 */

import React from 'react';
import { cn } from '@/lib/utils';
import type { ProviderType, ProviderProfile } from '@shared/types';
import { PROVIDER_DISPLAY_NAMES, PROVIDER_COLORS } from '@shared/types';

interface ProviderSelectorProps {
  availableProviders: ProviderType[];
  selectedProvider: ProviderType;
  profiles: ProviderProfile[];
  selectedProfileId: string;
  onProviderChange: (provider: ProviderType) => void;
  onProfileChange: (profileId: string) => void;
  disabled?: boolean;
  className?: string;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  availableProviders,
  selectedProvider,
  profiles,
  selectedProfileId,
  onProviderChange,
  onProfileChange,
  disabled = false,
  className,
}) => {
  const filteredProfiles = profiles.filter(
    (p) => p.providerType === selectedProvider
  );

  return (
    <div className={cn('provider-selector flex flex-col gap-3', className)}>
      <div className="provider-tabs flex gap-2">
        {availableProviders.map((provider) => (
          <button
            key={provider}
            type="button"
            className={cn(
              'provider-tab flex items-center gap-2 px-3 py-2 rounded-md border transition-colors',
              selectedProvider === provider
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:border-primary/50 hover:bg-muted',
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => onProviderChange(provider)}
            disabled={disabled}
            title={PROVIDER_DISPLAY_NAMES[provider]}
          >
            <span className={cn('provider-icon text-lg font-bold', PROVIDER_COLORS[provider])}>●</span>
            <span className="provider-name text-sm font-medium">
              {PROVIDER_DISPLAY_NAMES[provider]}
            </span>
          </button>
        ))}
      </div>

      {filteredProfiles.length > 0 && (
        <div className="profile-selector flex items-center gap-2">
          <label htmlFor="profile-select" className="text-sm text-muted-foreground">
            Profile:
          </label>
          <select
            id="profile-select"
            value={selectedProfileId}
            onChange={(e) => onProfileChange(e.target.value)}
            disabled={disabled}
            className={cn(
              'flex-1 px-3 py-2 rounded-md border border-border bg-background text-sm',
              'focus:outline-none focus:ring-2 focus:ring-primary/50',
              disabled && 'opacity-50 cursor-not-allowed'
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
    </div>
  );
};

export default ProviderSelector;
