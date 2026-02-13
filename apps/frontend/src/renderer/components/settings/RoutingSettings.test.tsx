/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { RoutingSettings } from './RoutingSettings';

const setDefaultProvider = vi.fn();
const setFallbackChain = vi.fn();
const toggleConfirmationDialog = vi.fn();
const setProject = vi.fn(async () => undefined);

vi.mock('../../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: (state: { selectedProjectId: string | null }) => unknown) =>
    selector({ selectedProjectId: 'project-1' })
  ),
}));

vi.mock('../../stores/routing-store', () => ({
  useRoutingStore: vi.fn(() => ({
    defaultProviders: { planning: 'claude', coding: 'claude', qa: 'claude' },
    fallbackChains: {
      claude: ['gemini', 'codex', 'openai', 'opencode'],
      gemini: ['claude', 'codex', 'openai', 'opencode'],
      openai: ['codex', 'claude', 'gemini', 'opencode'],
      codex: ['openai', 'claude', 'gemini', 'opencode'],
      opencode: ['claude', 'gemini', 'codex', 'openai'],
    },
    showConfirmationDialog: true,
    isLoading: false,
    error: null,
    setProject,
    setDefaultProvider,
    setFallbackChain,
    toggleConfirmationDialog,
  })),
}));

describe('RoutingSettings', () => {
  it('updates default provider and fallback chain', () => {
    render(<RoutingSettings />);

    fireEvent.change(screen.getByLabelText('Planning default provider'), {
      target: { value: 'gemini' },
    });
    fireEvent.change(screen.getByLabelText('Claude Code'), {
      target: { value: 'gemini, codex' },
    });
    fireEvent.click(screen.getByRole('switch'));

    expect(setDefaultProvider).toHaveBeenCalledWith('planning', 'gemini');
    expect(setFallbackChain).toHaveBeenCalledWith('claude', ['gemini', 'codex']);
    expect(toggleConfirmationDialog).toHaveBeenCalled();
  });
});
