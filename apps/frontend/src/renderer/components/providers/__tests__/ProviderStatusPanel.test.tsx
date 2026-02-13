/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProviderStatusPanel } from '../ProviderStatusPanel';

describe('ProviderStatusPanel', () => {
  it('renders provider statuses and forwards actions', async () => {
    const onLaunchTerminal = vi.fn();

    (window as unknown as { electronAPI: unknown }).electronAPI = {
      provider: {
        getAvailableProviders: vi.fn().mockResolvedValue({
          success: true,
          providers: [
            { type: 'claude', displayName: 'Claude Code' },
            { type: 'gemini', displayName: 'Gemini CLI' },
          ],
        }),
        getProviderStatus: vi.fn().mockImplementation((providerType: string) => Promise.resolve({
          success: true,
          status: {
            provider: providerType,
            installed: true,
            authenticated: providerType === 'claude',
            accountLabel: providerType === 'claude' ? 'user@example.com' : undefined,
            authMethod: providerType === 'claude' ? 'oauth' : 'apiKey',
            rateLimitStatus: 'unknown',
          },
        })),
      },
    };

    render(<ProviderStatusPanel onLaunchTerminal={onLaunchTerminal} />);

    await waitFor(() => {
      expect(screen.getByText('Claude Code')).toBeTruthy();
      expect(screen.getByText('Gemini CLI')).toBeTruthy();
      expect(screen.getByText('Account: user@example.com')).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Launch Terminal' })[0]);
    expect(onLaunchTerminal).toHaveBeenCalledWith('claude');
  });
});
