/**
 * ProviderSelector - UI component for selecting AI provider
 *
 * Supports Claude, Gemini, and OpenAI providers with visual indicators
 * for capabilities (extended thinking, MCP support, etc.)
 */

import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Label } from './label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Badge } from './badge';
import { Sparkles, Zap, Brain } from 'lucide-react';

export type ProviderType = 'claude' | 'gemini' | 'openai';

interface ProviderSelectorProps {
  value: ProviderType;
  onValueChange: (value: ProviderType) => void;
  disabled?: boolean;
  showCapabilities?: boolean;
  className?: string;
}

// Provider configuration
const PROVIDERS = {
  claude: {
    name: 'Claude',
    icon: '🟠',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
    capabilities: {
      extendedThinking: true,
      mcp: true,
      sessionResume: true,
    },
  },
  gemini: {
    name: 'Gemini',
    icon: '🔵',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    capabilities: {
      extendedThinking: false,
      mcp: false, // Via MCP Bridge
      sessionResume: false,
    },
  },
  openai: {
    name: 'OpenAI',
    icon: '🟢',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    capabilities: {
      extendedThinking: false,
      mcp: false, // Via MCP Bridge
      sessionResume: false,
    },
  },
} as const;

export function ProviderSelector({
  value,
  onValueChange,
  disabled = false,
  showCapabilities = false,
  className,
}: ProviderSelectorProps) {
  const { t } = useTranslation(['settings', 'common']);
  const selectedProvider = PROVIDERS[value];

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="provider-select" className="text-sm font-medium">
        {t('settings:provider.label', 'AI Provider')}
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onValueChange(v as ProviderType)}
        disabled={disabled}
      >
        <SelectTrigger
          id="provider-select"
          className={cn(
            'h-10',
            selectedProvider.bgColor,
            selectedProvider.borderColor
          )}
        >
          <SelectValue>
            <span className="flex items-center gap-2">
              <span>{selectedProvider.icon}</span>
              <span className={selectedProvider.color}>{selectedProvider.name}</span>
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {Object.entries(PROVIDERS).map(([key, provider]) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-2">
                <span>{provider.icon}</span>
                <span>{provider.name}</span>
                {provider.capabilities.extendedThinking && (
                  <Badge variant="outline" className="text-[10px] px-1 py-0 ml-1">
                    <Brain className="h-2.5 w-2.5 mr-0.5" />
                    Thinking
                  </Badge>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Capabilities info */}
      {showCapabilities && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedProvider.capabilities.extendedThinking && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 border-purple-500/30">
              <Brain className="h-3 w-3 mr-1" />
              {t('settings:provider.capabilities.extendedThinking', 'Extended Thinking')}
            </Badge>
          )}
          {selectedProvider.capabilities.mcp ? (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border-blue-500/30">
              <Sparkles className="h-3 w-3 mr-1" />
              {t('settings:provider.capabilities.nativeMcp', 'Native MCP')}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground">
              <Zap className="h-3 w-3 mr-1" />
              {t('settings:provider.capabilities.mcpBridge', 'MCP Bridge')}
            </Badge>
          )}
          {selectedProvider.capabilities.sessionResume && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-green-500/10 text-green-400 border-green-500/30">
              {t('settings:provider.capabilities.sessionResume', 'Session Resume')}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * ProviderBadge - Small badge to display provider type
 * Used in TaskCard and other compact displays
 */
interface ProviderBadgeProps {
  provider?: ProviderType;
  className?: string;
}

export function ProviderBadge({ provider, className }: ProviderBadgeProps) {
  if (!provider || provider === 'claude') {
    // Don't show badge for default (Claude)
    return null;
  }

  const config = PROVIDERS[provider];

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0.5',
        config.bgColor,
        config.color,
        config.borderColor,
        className
      )}
    >
      <span className="mr-0.5">{config.icon}</span>
      {config.name}
    </Badge>
  );
}

/**
 * Get provider display info
 */
export function getProviderInfo(provider: ProviderType) {
  return PROVIDERS[provider];
}

/**
 * Check if provider supports a capability
 */
export function providerSupports(
  provider: ProviderType,
  capability: keyof typeof PROVIDERS.claude.capabilities
): boolean {
  return PROVIDERS[provider]?.capabilities[capability] ?? false;
}
