/**
 * @vitest-environment jsdom
 */

/**
 * Tests for ProviderSelector Component
 *
 * Tests the terminal provider selection dropdown component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ProviderSelector } from './ProviderSelector';
import type { ProviderType } from '../../../shared/types/provider';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'terminal:provider.selectProvider': 'Select provider',
        'terminal:provider.availableProviders': 'Available providers',
        'common:status.active': 'Active'
      };
      return translations[key] || key;
    }
  })
}));

describe('ProviderSelector', () => {
  const mockOnProviderChange = vi.fn();

  describe('rendering', () => {
    it('should render with selected provider', () => {
      render(
        <ProviderSelector
          selectedProvider="claude"
          onProviderChange={mockOnProviderChange}
        />
      );

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should render all provider types', () => {
      const providers: ProviderType[] = ['claude', 'gemini', 'openai', 'opencode'];

      for (const provider of providers) {
        const { unmount } = render(
          <ProviderSelector
            selectedProvider={provider}
            onProviderChange={mockOnProviderChange}
          />
        );

        // Verify the selected provider is displayed
        expect(screen.getByRole('button')).toBeInTheDocument();
        unmount();
      }
    });
  });

  describe('compact mode', () => {
    it('should render in compact mode', () => {
      render(
        <ProviderSelector
          selectedProvider="claude"
          onProviderChange={mockOnProviderChange}
          compact={true}
        />
      );

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should render in full mode by default', () => {
      render(
        <ProviderSelector
          selectedProvider="gemini"
          onProviderChange={mockOnProviderChange}
        />
      );

      expect(screen.getByText('Gemini CLI')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('should be disabled when disabled prop is true', () => {
      render(
        <ProviderSelector
          selectedProvider="claude"
          onProviderChange={mockOnProviderChange}
          disabled={true}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('should be enabled by default', () => {
      render(
        <ProviderSelector
          selectedProvider="claude"
          onProviderChange={mockOnProviderChange}
        />
      );

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('provider display', () => {
    it('should display Claude Code for claude provider', () => {
      render(
        <ProviderSelector
          selectedProvider="claude"
          onProviderChange={mockOnProviderChange}
        />
      );

      expect(screen.getByText('Claude Code')).toBeInTheDocument();
    });

    it('should display Gemini CLI for gemini provider', () => {
      render(
        <ProviderSelector
          selectedProvider="gemini"
          onProviderChange={mockOnProviderChange}
        />
      );

      expect(screen.getByText('Gemini CLI')).toBeInTheDocument();
    });

    it('should display OpenAI Codex for openai provider', () => {
      render(
        <ProviderSelector
          selectedProvider="openai"
          onProviderChange={mockOnProviderChange}
        />
      );

      expect(screen.getByText('OpenAI Codex')).toBeInTheDocument();
    });

    it('should display OpenCode for opencode provider', () => {
      render(
        <ProviderSelector
          selectedProvider="opencode"
          onProviderChange={mockOnProviderChange}
        />
      );

      expect(screen.getByText('OpenCode')).toBeInTheDocument();
    });
  });
});
