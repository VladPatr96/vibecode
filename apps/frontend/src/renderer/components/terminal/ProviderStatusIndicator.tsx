import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { PROVIDER_COLORS } from '@shared/constants/provider-colors';
import type { ProviderType } from '@shared/types/provider-config';
import { Loader2, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

export type ProviderStatus = 'idle' | 'busy' | 'rate-limited' | 'error';

export interface ProviderUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  requestCount?: number;
  costEstimate?: string;
}

interface ProviderStatusIndicatorProps {
  providerType: ProviderType;
  model: string;
  status: ProviderStatus;
  usage?: ProviderUsage;
  className?: string;
}

const PROVIDER_ICONS: Record<ProviderType, string> = {
  claude: '🟠',
  gemini: '🔵',
  openai: '🟢',
  opencode: '🟣',
};

const PROVIDER_NAMES: Record<ProviderType, string> = {
  claude: 'Claude',
  gemini: 'Gemini',
  openai: 'OpenAI',
  opencode: 'OpenCode',
};

export const ProviderStatusIndicator: React.FC<ProviderStatusIndicatorProps> = ({
  providerType,
  model,
  status,
  usage,
  className,
}) => {
  // Determine styles based on status and provider
  const providerColors = PROVIDER_COLORS[providerType] || PROVIDER_COLORS.claude;

  let badgeStyles = '';
  let icon = null;
  let statusText = '';

  switch (status) {
    case 'busy':
      badgeStyles = cn(
        providerColors.bg,
        'text-white border-transparent animate-pulse'
      );
      icon = <Loader2 className="h-3 w-3 animate-spin mr-1" />;
      statusText = 'Processing...';
      break;
    case 'rate-limited':
      badgeStyles = 'bg-yellow-500/15 text-yellow-600 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800';
      icon = <AlertTriangle className="h-3 w-3 mr-1" />;
      statusText = 'Rate Limited';
      break;
    case 'error':
      badgeStyles = 'bg-red-500/15 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
      icon = <XCircle className="h-3 w-3 mr-1" />;
      statusText = 'Error';
      break;
    case 'idle':
    default:
      // Subtle style for idle state using provider accent color
      badgeStyles = cn(
        'bg-background hover:bg-muted/50 transition-colors',
        providerColors.border,
        providerColors.accent
      );
      icon = <span className="mr-1 text-xs">{PROVIDER_ICONS[providerType]}</span>;
      statusText = 'Ready';
      break;
  }

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border cursor-help transition-all duration-200",
              badgeStyles,
              className
            )}
          >
            {status === 'busy' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <span className="text-xs">{PROVIDER_ICONS[providerType]}</span>
            )}
            <span className="hidden sm:inline-block">
              {PROVIDER_NAMES[providerType]}
            </span>
            <span className="opacity-70 text-[10px] ml-0.5 border-l pl-1.5 border-current/20">
              {model}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="text-xs max-w-[250px]">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-4 pb-1 border-b border-border/50">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {PROVIDER_ICONS[providerType]} {PROVIDER_NAMES[providerType]}
              </span>
              <span className={cn(
                "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                status === 'busy' && "bg-primary/10 text-primary",
                status === 'rate-limited' && "bg-yellow-500/10 text-yellow-600",
                status === 'error' && "bg-red-500/10 text-red-600",
                status === 'idle' && "bg-muted text-muted-foreground"
              )}>
                {statusText}
              </span>
            </div>

            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted-foreground">
              <span className="text-right">Model:</span>
              <span className="font-mono text-foreground">{model}</span>

              {usage && (
                <>
                  <div className="col-span-2 h-px bg-border/50 my-1" />

                  {usage.requestCount !== undefined && (
                    <>
                      <span className="text-right">Requests:</span>
                      <span className="font-mono text-foreground">{usage.requestCount}</span>
                    </>
                  )}

                  {usage.totalTokens !== undefined && (
                    <>
                      <span className="text-right">Tokens:</span>
                      <span className="font-mono text-foreground">{usage.totalTokens.toLocaleString()}</span>
                    </>
                  )}

                  {usage.costEstimate && (
                    <>
                      <span className="text-right">Est. Cost:</span>
                      <span className="font-mono text-foreground">{usage.costEstimate}</span>
                    </>
                  )}
                </>
              )}
            </div>

            {status === 'rate-limited' && (
              <div className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 p-2 rounded text-[10px] mt-2">
                Provider is rate limited. Switching to backup provider or waiting...
              </div>
            )}

            {status === 'error' && (
              <div className="bg-red-500/10 text-red-700 dark:text-red-400 p-2 rounded text-[10px] mt-2">
                Connection error. Please check your API key and network connection.
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
