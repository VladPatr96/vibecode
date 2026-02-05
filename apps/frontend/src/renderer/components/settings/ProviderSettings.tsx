import React from 'react';
import { useTranslation } from 'react-i18next';
import { useSettingsStore, Phase } from '../../stores/settings-store';
import { ProviderType, PhaseProviderConfig } from '@shared/types/provider-config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Label } from '../ui/label';
import { Card, CardContent } from '../ui/card';

const PROVIDER_DISPLAY_NAMES: Record<ProviderType, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  openai: 'OpenAI',
  opencode: 'Opencode',
};

export const ProviderSettings: React.FC = () => {
  const { t } = useTranslation('settings');
  const { globalProviderSettings, setGlobalProviderSettings } = useSettingsStore();

  const handleProviderChange = (phase: Phase, value: ProviderType) => {
    const currentPhaseProviders = globalProviderSettings.phaseProviders || {
      spec: globalProviderSettings.defaultProvider,
      planning: globalProviderSettings.defaultProvider,
      coding: globalProviderSettings.defaultProvider,
      qa: globalProviderSettings.defaultProvider,
    };

    setGlobalProviderSettings({
      ...globalProviderSettings,
      phaseProviders: {
        ...currentPhaseProviders,
        [phase]: value,
      },
    });
  };

  const phases: Phase[] = ['spec', 'planning', 'coding', 'qa'];

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-medium">{t('providers.title')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('providers.description')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {phases.map((phase) => (
          <Card key={phase}>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <Label htmlFor={`provider-${phase}`}>
                  {t(`providers.phases.${phase}`)}
                </Label>
                <Select
                  value={globalProviderSettings.phaseProviders?.[phase] || globalProviderSettings.defaultProvider}
                  onValueChange={(value) => handleProviderChange(phase, value as ProviderType)}
                >
                  <SelectTrigger id={`provider-${phase}`}>
                    <SelectValue placeholder={t('modelSelect.placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PROVIDER_DISPLAY_NAMES).map(([key, name]) => (
                      <SelectItem key={key} value={key}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
