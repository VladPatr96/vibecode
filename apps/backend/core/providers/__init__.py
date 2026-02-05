"""Multi-provider support for Auto-Claude.

This module provides a unified interface for multiple AI providers:
- Claude (via claude-agent-sdk)
- Gemini (via google-generativeai)
- OpenAI (via openai)

For terminal/CLI integration, use ProviderRegistry and CLI providers.
For agent sessions (planner, coder, QA), use create_provider() factory.
"""

from .types import ProviderType, ProviderCredentials, ProviderProfile, RateLimitInfo
from .registry import ProviderRegistry
from .factory import create_provider, get_provider_capabilities
from .claude import ClaudeCLIProvider
from .gemini import GeminiCLIProvider, GeminiSDKClient
from .openai import OpenAICLIProvider, OpenAISDKClient

# Register all CLI providers
ProviderRegistry.register(ProviderType.CLAUDE, ClaudeCLIProvider.create)
ProviderRegistry.register(ProviderType.GEMINI, GeminiCLIProvider.create)
ProviderRegistry.register(ProviderType.OPENAI, OpenAICLIProvider.create)

__all__ = [
    # Types
    "ProviderType",
    "ProviderCredentials",
    "ProviderProfile",
    "RateLimitInfo",
    # Registry
    "ProviderRegistry",
    # Factory
    "create_provider",
    "get_provider_capabilities",
    # CLI Providers
    "ClaudeCLIProvider",
    "GeminiCLIProvider",
    "OpenAICLIProvider",
    # SDK Clients
    "GeminiSDKClient",
    "OpenAISDKClient",
]
