import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Lock, RefreshCw, ServerOff, ShieldAlert } from 'lucide-react';
import type { AuthErrorType } from '@shared/types/terminal';

interface AuthErrorDialogProps {
  isOpen: boolean;
  providerType: string; // e.g., 'Claude', 'OpenAI', 'Gemini'
  errorType: AuthErrorType;
  errorMessage?: string;
  onRetry?: () => void;
  onSwitchProvider?: () => void;
  onClose: () => void;
}

export const AuthErrorDialog: React.FC<AuthErrorDialogProps> = ({
  isOpen,
  providerType,
  errorType,
  errorMessage,
  onRetry,
  onSwitchProvider,
  onClose,
}) => {
  const { t } = useTranslation(['errors']);

  // Determine content based on error type
  const getErrorContent = () => {
    switch (errorType) {
      case 'auth_failed':
        return {
          title: t('errors:provider.authFailed'),
          description: t('errors:provider.descriptions.authFailed', { provider: providerType }),
          icon: <Lock className="h-6 w-6 text-destructive" />,
          primaryAction: t('errors:provider.actions.reauthenticate'),
        };
      case 'token_expired':
        return {
          title: t('errors:provider.tokenExpired'),
          description: t('errors:provider.descriptions.tokenExpired', { provider: providerType }),
          icon: <ShieldAlert className="h-6 w-6 text-yellow-500" />,
          primaryAction: t('errors:provider.actions.reauthenticate'),
        };
      case 'rate_limit':
        return {
          title: t('errors:provider.rateLimited'),
          description: t('errors:provider.descriptions.rateLimited', { provider: providerType }),
          icon: <AlertTriangle className="h-6 w-6 text-orange-500" />,
          primaryAction: t('errors:provider.actions.retry'),
        };
      case 'unavailable':
        return {
          title: t('errors:provider.unavailable'),
          description: t('errors:provider.descriptions.unavailable', { provider: providerType }),
          icon: <ServerOff className="h-6 w-6 text-muted-foreground" />,
          primaryAction: t('errors:provider.actions.retry'),
        };
      default:
        return {
          title: t('errors:provider.authFailed'),
          description: errorMessage || t('errors:provider.descriptions.generic', { provider: providerType, message: '' }),
          icon: <AlertTriangle className="h-6 w-6 text-destructive" />,
          primaryAction: t('errors:provider.actions.retry'),
        };
    }
  };

  const content = getErrorContent();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader className="flex flex-row items-start gap-4 space-y-0">
          <div className="p-2 rounded-full bg-muted/20 mt-1">
            {content.icon}
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <DialogTitle>{content.title}</DialogTitle>
            <DialogDescription className="text-base text-foreground/90">
              {content.description}
            </DialogDescription>
          </div>
        </DialogHeader>

        {errorMessage && errorType !== 'auth_failed' && (
          <div className="my-2 p-3 text-sm text-muted-foreground bg-muted/50 rounded-md border font-mono break-words">
            {errorMessage}
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0 mt-4">
          <Button variant="outline" onClick={onClose} className="sm:mr-auto">
            {t('errors:provider.actions.cancel')}
          </Button>

          <div className="flex flex-col sm:flex-row gap-2">
            {onSwitchProvider && (
              <Button variant="secondary" onClick={onSwitchProvider}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('errors:provider.actions.switchProvider')}
              </Button>
            )}

            {onRetry && (
              <Button onClick={onRetry}>
                {content.primaryAction}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
