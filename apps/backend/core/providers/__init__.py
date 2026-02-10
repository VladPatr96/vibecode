"""Multi-provider support for Auto-Claude."""

from .types import ProviderType, ProviderCredentials, ProviderProfile
from .registry import ProviderRegistry
from .claude import ClaudeCLIProvider
from .gemini import GeminiCLIProvider
from .openai import OpenAICLIProvider
from .opencode import OpencodeCLIProvider

# Register all providers
ProviderRegistry.register(ProviderType.CLAUDE, ClaudeCLIProvider.create)
ProviderRegistry.register(ProviderType.GEMINI, GeminiCLIProvider.create)
ProviderRegistry.register(ProviderType.OPENAI, OpenAICLIProvider.create)
ProviderRegistry.register(ProviderType.OPENCODE, OpencodeCLIProvider.create)

__all__ = [
    "ProviderType",
    "ProviderCredentials",
    "ProviderProfile",
    "ProviderRegistry",
    "ClaudeCLIProvider",
    "GeminiCLIProvider",
    "OpenAICLIProvider",
    "OpencodeCLIProvider",
]
