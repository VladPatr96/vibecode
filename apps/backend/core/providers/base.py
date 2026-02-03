"""Base provider interface and abstract classes."""

from abc import ABC, abstractmethod
from typing import Optional, Dict, Any, AsyncIterator, List

from .types import (
    ProviderType,
    ProviderCredentials,
    ProviderProfile,
    RateLimitInfo,
)


class BaseAuthHandler(ABC):
    """Abstract authentication handler."""

    @abstractmethod
    async def authenticate(self, config_dir: Optional[str] = None) -> ProviderCredentials:
        """Perform authentication (OAuth flow, API key validation)."""
        pass

    @abstractmethod
    async def refresh_credentials(
        self, credentials: ProviderCredentials
    ) -> ProviderCredentials:
        """Refresh expired credentials."""
        pass

    @abstractmethod
    async def validate_credentials(self, credentials: ProviderCredentials) -> bool:
        """Check if credentials are valid."""
        pass

    @abstractmethod
    async def revoke_credentials(self, credentials: ProviderCredentials) -> None:
        """Revoke credentials (logout)."""
        pass


class BaseCredentialStorage(ABC):
    """Abstract credential storage."""

    @abstractmethod
    async def store(
        self, profile_id: str, credentials: ProviderCredentials
    ) -> None:
        """Store credentials for profile."""
        pass

    @abstractmethod
    async def retrieve(self, profile_id: str) -> Optional[ProviderCredentials]:
        """Retrieve credentials by profile_id."""
        pass

    @abstractmethod
    async def delete(self, profile_id: str) -> None:
        """Delete credentials."""
        pass

    @abstractmethod
    async def list_profiles(self) -> List[str]:
        """List all stored profile_ids."""
        pass


class BaseRateLimiter(ABC):
    """Abstract rate limiter."""

    @abstractmethod
    async def acquire(self, tokens_estimate: int = 1) -> None:
        """Acquire permission for request (blocks if rate limited)."""
        pass

    @abstractmethod
    async def update_limits(self, rate_limit_info: RateLimitInfo) -> None:
        """Update limits from API response."""
        pass

    @abstractmethod
    def get_current_limits(self) -> RateLimitInfo:
        """Get current rate limit state."""
        pass


class BaseCLIProvider(ABC):
    """Main CLI provider interface."""

    provider_type: ProviderType

    def __init__(
        self,
        auth_handler: BaseAuthHandler,
        credential_storage: BaseCredentialStorage,
        rate_limiter: BaseRateLimiter,
    ):
        self.auth_handler = auth_handler
        self.credential_storage = credential_storage
        self.rate_limiter = rate_limiter
        self._current_profile: Optional[ProviderProfile] = None
        self._credentials: Optional[ProviderCredentials] = None

    @abstractmethod
    async def initialize(self, profile: ProviderProfile) -> None:
        """Initialize provider with profile."""
        pass

    @abstractmethod
    async def invoke(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """Execute request to CLI (streaming response)."""
        pass

    @abstractmethod
    async def resume_session(self, session_id: str) -> None:
        """Resume previous session."""
        pass

    @abstractmethod
    async def switch_profile(self, profile: ProviderProfile) -> None:
        """Switch profile without losing context."""
        pass

    @abstractmethod
    def get_cli_command(self) -> List[str]:
        """Get CLI command to execute."""
        pass

    @abstractmethod
    def get_cli_env(self) -> Dict[str, str]:
        """Get environment variables for CLI."""
        pass

    @abstractmethod
    async def health_check(self) -> bool:
        """Check provider availability."""
        pass

    @property
    def current_profile(self) -> Optional[ProviderProfile]:
        """Get current profile."""
        return self._current_profile

    @property
    def is_initialized(self) -> bool:
        """Check if provider is initialized."""
        return self._current_profile is not None
