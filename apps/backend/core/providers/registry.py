"""Provider registry for managing CLI providers."""

from typing import Dict, Type, Optional, Callable

from .base import BaseCLIProvider
from .types import ProviderType, ProviderProfile


ProviderFactory = Callable[[ProviderProfile], BaseCLIProvider]


class ProviderRegistry:
    """Central registry for CLI providers."""

    _factories: Dict[ProviderType, ProviderFactory] = {}
    _instances: Dict[str, BaseCLIProvider] = {}  # terminal_id -> provider

    @classmethod
    def register(
        cls,
        provider_type: ProviderType,
        factory: ProviderFactory,
    ) -> None:
        """Register a provider factory."""
        cls._factories[provider_type] = factory

    @classmethod
    def unregister(cls, provider_type: ProviderType) -> None:
        """Unregister a provider."""
        cls._factories.pop(provider_type, None)

    @classmethod
    def get_factory(
        cls, provider_type: ProviderType
    ) -> Optional[ProviderFactory]:
        """Get provider factory by type."""
        return cls._factories.get(provider_type)

    @classmethod
    async def create_for_terminal(
        cls,
        terminal_id: str,
        provider_type: ProviderType,
        profile: ProviderProfile,
    ) -> BaseCLIProvider:
        """Create and initialize provider for terminal."""
        factory = cls._factories.get(provider_type)
        if not factory:
            raise ValueError(f"Unknown provider type: {provider_type}")

        # Cleanup existing provider
        await cls.dispose_terminal(terminal_id)

        # Create and initialize new provider
        provider = factory(profile)
        await provider.initialize(profile)

        cls._instances[terminal_id] = provider
        return provider

    @classmethod
    def get_terminal_provider(
        cls, terminal_id: str
    ) -> Optional[BaseCLIProvider]:
        """Get provider for terminal."""
        return cls._instances.get(terminal_id)

    @classmethod
    async def dispose_terminal(cls, terminal_id: str) -> None:
        """Dispose provider for terminal."""
        provider = cls._instances.pop(terminal_id, None)
        if provider:
            # Cleanup if provider has dispose method
            pass

    @classmethod
    def list_available(cls) -> list[ProviderType]:
        """List available provider types."""
        return list(cls._factories.keys())

    @classmethod
    def clear_all(cls) -> None:
        """Clear all instances (for testing)."""
        cls._instances.clear()
