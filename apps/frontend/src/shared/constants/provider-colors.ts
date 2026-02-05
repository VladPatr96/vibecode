import type { ProviderType } from '../types/provider-config';

export const PROVIDER_COLORS: Record<ProviderType, { border: string; bg: string; accent: string }> = {
  claude: {
    border: 'border-orange-500',
    bg: 'bg-orange-500',
    accent: 'text-orange-500',
  },
  gemini: {
    border: 'border-blue-500',
    bg: 'bg-blue-500',
    accent: 'text-blue-500',
  },
  openai: {
    border: 'border-green-500',
    bg: 'bg-green-500',
    accent: 'text-green-500',
  },
  opencode: {
    border: 'border-purple-500',
    bg: 'bg-purple-500',
    accent: 'text-purple-500',
  },
};
