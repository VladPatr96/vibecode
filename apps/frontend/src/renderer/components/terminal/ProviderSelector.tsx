/**
 * ProviderSelector - Terminal CLI provider selection component
 *
 * Allows users to select a CLI provider for terminal sessions:
 * - Claude Code: Claude AI assistant integration
 * - Gemini CLI: Google Gemini AI integration
 * - OpenAI Codex: OpenAI GPT models integration
 * - OpenCode: DeepSeek models integration
 *
 * Provider detection uses colors and display names from provider.ts:
 * - Claude: Orange (text-orange-400)
 * - Gemini: Blue (text-blue-400)
 * - OpenAI: Green (text-green-400)
 * - OpenCode: Purple (text-purple-400)
 *
 * Usage:
 * - Terminal creation: Select provider before creating new terminal
 * - Terminal switching: Change provider for existing terminal (recreates session)
 */

import { ChevronDown, Bot, Sparkles, Cpu, Code2 } from 'lucide-react';
import type { ProviderType } from '../../../shared/types/provider';
import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_COLORS,
} from '../../../shared/types/provider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../lib/utils';
import { useTranslation } from 'react-i18next';

interface ProviderSelectorProps {
  selectedProvider: ProviderType;
  onProviderChange: (provider: ProviderType) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Provider icon mapping
 * Maps each provider type to its corresponding icon component
 */
const PROVIDER_ICONS: Record<ProviderType, React.ComponentType<{ className?: string }>> = {
  claude: Bot,
  gemini: Sparkles,
  openai: Code2,
  opencode: Cpu,
};

/**
 * Get all available providers in display order
 */
const AVAILABLE_PROVIDERS: ProviderType[] = ['claude', 'gemini', 'openai', 'opencode'];

export function ProviderSelector({
  selectedProvider,
  onProviderChange,
  disabled = false,
  compact = false,
}: ProviderSelectorProps) {
  const { t } = useTranslation(['terminal', 'common']);

  const SelectedIcon = PROVIDER_ICONS[selectedProvider];
  const selectedColor = PROVIDER_COLORS[selectedProvider];
  const selectedDisplayName = PROVIDER_DISPLAY_NAMES[selectedProvider];

  // Compact mode: Small badge-style button for terminal header
  if (compact) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={disabled}
            className={cn(
              'flex items-center gap-1.5 h-6 px-2 rounded text-[10px] font-medium transition-colors',
              'border border-border/50 bg-card/50 hover:bg-card hover:border-border',
              selectedColor,
              disabled && 'opacity-50 cursor-not-allowed'
            )}
            onClick={(e) => e.stopPropagation()}
            aria-label={t('terminal:provider.selectProvider')}
          >
            <SelectedIcon className="h-3 w-3" />
            <span>{selectedDisplayName}</span>
            <ChevronDown className="h-2.5 w-2.5 opacity-60" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <div className="px-2 py-1.5 text-xs text-muted-foreground">
            {t('terminal:provider.selectProvider')}
          </div>
          {AVAILABLE_PROVIDERS.map((provider) => {
            const Icon = PROVIDER_ICONS[provider];
            const color = PROVIDER_COLORS[provider];
            const displayName = PROVIDER_DISPLAY_NAMES[provider];
            const isSelected = provider === selectedProvider;

            return (
              <DropdownMenuItem
                key={provider}
                onClick={() => onProviderChange(provider)}
                className="text-xs"
                disabled={isSelected}
              >
                <Icon className={cn('h-3 w-3 mr-2', color)} />
                <span className={cn(isSelected && 'font-semibold')}>
                  {displayName}
                </span>
                {isSelected && (
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {t('common:status.active')}
                  </span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Full mode: Regular dropdown for dialogs and settings
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            'flex items-center justify-between w-full h-10 px-3 py-2 rounded-lg',
            'border border-border bg-card text-sm text-foreground',
            'hover:bg-accent hover:text-accent-foreground',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary',
            'transition-colors duration-200',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
          aria-label={t('terminal:provider.selectProvider')}
        >
          <div className="flex items-center gap-2">
            <SelectedIcon className={cn('h-4 w-4', selectedColor)} />
            <span>{selectedDisplayName}</span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-full min-w-[240px]">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          {t('terminal:provider.availableProviders')}
        </div>
        <DropdownMenuSeparator />
        {AVAILABLE_PROVIDERS.map((provider) => {
          const Icon = PROVIDER_ICONS[provider];
          const color = PROVIDER_COLORS[provider];
          const displayName = PROVIDER_DISPLAY_NAMES[provider];
          const isSelected = provider === selectedProvider;

          return (
            <DropdownMenuItem
              key={provider}
              onClick={() => onProviderChange(provider)}
              disabled={isSelected}
              className={cn(
                'flex items-center gap-2 cursor-pointer',
                isSelected && 'bg-accent'
              )}
            >
              <Icon className={cn('h-4 w-4', color)} />
              <div className="flex flex-col flex-1">
                <span className={cn('text-sm', isSelected && 'font-semibold')}>
                  {displayName}
                </span>
              </div>
              {isSelected && (
                <span className="text-xs text-muted-foreground">
                  {t('common:status.active')}
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
