/**
 * @vitest-environment jsdom
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ProviderRoutingDialog } from '../ProviderRoutingDialog';

const recommendation = {
  planning: {
    provider_type: 'gemini' as const,
    model: 'gemini-2.0-flash',
    reason: 'Large context',
    confidence: 0.9,
  },
  coding: {
    provider_type: 'claude' as const,
    model: 'claude-sonnet-4-20250514',
    reason: 'TypeScript-heavy',
    confidence: 0.8,
  },
  qa: {
    provider_type: 'codex' as const,
    model: 'gpt-4o',
    reason: 'Quick loops',
    confidence: 0.7,
  },
};

describe('ProviderRoutingDialog', () => {
  it('renders recommendation summary per phase', () => {
    render(
      <ProviderRoutingDialog
        open
        recommendation={recommendation}
        onCancel={vi.fn()}
        onStart={vi.fn()}
      />
    );

    expect(screen.getByText(/Recommended: Gemini CLI/i)).toBeTruthy();
    expect(screen.getByText(/Recommended: Claude Code/i)).toBeTruthy();
    expect(screen.getByText(/Recommended: Codex CLI/i)).toBeTruthy();
  });

  it('submits selected routing configuration', () => {
    const onStart = vi.fn();
    render(
      <ProviderRoutingDialog
        open
        recommendation={recommendation}
        providerHealth={{ claude: true, gemini: false, codex: true, openai: true, opencode: true }}
        onCancel={vi.fn()}
        onStart={onStart}
      />
    );

    fireEvent.change(screen.getByLabelText('planning-provider'), {
      target: { value: 'claude' },
    });
    fireEvent.change(screen.getByLabelText('planning-model'), {
      target: { value: 'claude-opus-4-20251010' },
    });
    fireEvent.click(screen.getByLabelText("Don't show again"));
    fireEvent.click(screen.getByRole('button', { name: 'Start' }));

    expect(onStart).toHaveBeenCalledTimes(1);
    expect(onStart.mock.calls[0][0].planning.provider).toBe('claude');
    expect(onStart.mock.calls[0][0].planning.model).toBe('claude-opus-4-20251010');
    expect(onStart.mock.calls[0][1]).toEqual({
      useForAllPhases: false,
      dontShowAgain: true,
    });
  });
});
