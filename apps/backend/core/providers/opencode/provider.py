"""Opencode CLI provider implementation."""

import os
import shutil
from typing import Optional, Dict, Any, AsyncIterator, List

from ..base import (
    BaseCLIProvider,
    BaseAuthHandler,
    BaseCredentialStorage,
    BaseRateLimiter,
)
from ..types import (
    ProviderType,
    ProviderProfile,
    ProviderCredentials,
    RateLimitInfo,
)


class OpencodeAuthHandler(BaseAuthHandler):
    """API key authentication for Opencode."""

    async def authenticate(
        self, config_dir: Optional[str] = None
    ) -> ProviderCredentials:
        """Get Opencode API key from environment."""
        api_key = os.environ.get("OPENCODE_API_KEY")
        return ProviderCredentials(
            provider_type=ProviderType.OPENCODE,
            api_key=api_key,
        )

    async def refresh_credentials(
        self, credentials: ProviderCredentials
    ) -> ProviderCredentials:
        """API keys don't need refresh."""
        return credentials

    async def validate_credentials(
        self, credentials: ProviderCredentials
    ) -> bool:
        """Check if API key exists."""
        return credentials.api_key is not None

    async def revoke_credentials(
        self, credentials: ProviderCredentials
    ) -> None:
        """API keys can't be revoked here."""
        pass


class OpencodeCredentialStorage(BaseCredentialStorage):
    """Storage for Opencode credentials."""

    async def store(
        self, profile_id: str, credentials: ProviderCredentials
    ) -> None:
        pass

    async def retrieve(
        self, profile_id: str
    ) -> Optional[ProviderCredentials]:
        return None

    async def delete(self, profile_id: str) -> None:
        pass

    async def list_profiles(self) -> List[str]:
        return []


class OpencodeRateLimiter(BaseRateLimiter):
    """Rate limiter for Opencode API."""

    async def acquire(self, tokens_estimate: int = 1) -> None:
        pass

    async def update_limits(self, rate_limit_info: RateLimitInfo) -> None:
        pass

    def get_current_limits(self) -> RateLimitInfo:
        return RateLimitInfo(
            requests_remaining=60,
            tokens_remaining=1000000,
            reset_at=0,
        )


class OpencodeCLIProvider(BaseCLIProvider):
    """Opencode CLI provider."""

    provider_type = ProviderType.OPENCODE
    CLI_EXECUTABLE = "opencode"

    def __init__(self):
        super().__init__(
            auth_handler=OpencodeAuthHandler(),
            credential_storage=OpencodeCredentialStorage(),
            rate_limiter=OpencodeRateLimiter(),
        )

    @classmethod
    def create(cls, profile: ProviderProfile) -> "OpencodeCLIProvider":
        """Factory method."""
        return cls()

    async def initialize(self, profile: ProviderProfile) -> None:
        """Initialize with profile."""
        self._current_profile = profile
        self._credentials = await self.auth_handler.authenticate()

    async def invoke(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """Invoke Opencode CLI."""
        yield ""

    async def resume_session(self, session_id: str) -> None:
        """Resume session (if supported)."""
        pass

    async def switch_profile(self, profile: ProviderProfile) -> None:
        """Switch profile."""
        await self.initialize(profile)

    def get_cli_command(self) -> List[str]:
        """Get Opencode CLI command."""
        if not self._current_profile:
            raise RuntimeError("Provider not initialized")

        return [
            self.CLI_EXECUTABLE,
            "--model",
            self._current_profile.model or "deepseek-v3",
        ]

    def get_cli_env(self) -> Dict[str, str]:
        """Get environment for Opencode CLI."""
        env = {}
        if self._credentials and self._credentials.api_key:
            env["OPENCODE_API_KEY"] = self._credentials.api_key
        return env

    async def health_check(self) -> bool:
        """Check if Opencode CLI is available."""
        return shutil.which(self.CLI_EXECUTABLE) is not None
