"""OpenAI Codex CLI provider implementation."""

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


class OpenAIAuthHandler(BaseAuthHandler):
    """API key authentication for OpenAI."""

    async def authenticate(
        self, config_dir: Optional[str] = None
    ) -> ProviderCredentials:
        """Get OpenAI API key from environment."""
        api_key = os.environ.get("OPENAI_API_KEY")
        return ProviderCredentials(
            provider_type=ProviderType.OPENAI,
            api_key=api_key,
        )

    async def refresh_credentials(
        self, credentials: ProviderCredentials
    ) -> ProviderCredentials:
        return credentials

    async def validate_credentials(
        self, credentials: ProviderCredentials
    ) -> bool:
        return credentials.api_key is not None

    async def revoke_credentials(
        self, credentials: ProviderCredentials
    ) -> None:
        pass


class OpenAICredentialStorage(BaseCredentialStorage):
    """Storage for OpenAI credentials."""

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


class OpenAIRateLimiter(BaseRateLimiter):
    """Rate limiter for OpenAI API."""

    async def acquire(self, tokens_estimate: int = 1) -> None:
        pass

    async def update_limits(self, rate_limit_info: RateLimitInfo) -> None:
        pass

    def get_current_limits(self) -> RateLimitInfo:
        return RateLimitInfo(
            requests_remaining=60,
            tokens_remaining=150000,
            reset_at=0,
        )


class OpenAICLIProvider(BaseCLIProvider):
    """OpenAI Codex CLI provider."""

    provider_type = ProviderType.OPENAI
    CLI_EXECUTABLE = "codex"

    def __init__(self):
        super().__init__(
            auth_handler=OpenAIAuthHandler(),
            credential_storage=OpenAICredentialStorage(),
            rate_limiter=OpenAIRateLimiter(),
        )

    @classmethod
    def create(cls, profile: ProviderProfile) -> "OpenAICLIProvider":
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
        """Invoke OpenAI CLI."""
        yield ""

    async def resume_session(self, session_id: str) -> None:
        """Resume session."""
        pass

    async def switch_profile(self, profile: ProviderProfile) -> None:
        """Switch profile."""
        await self.initialize(profile)

    def get_cli_command(self) -> List[str]:
        """Get OpenAI CLI command."""
        if not self._current_profile:
            raise RuntimeError("Provider not initialized")

        return [
            self.CLI_EXECUTABLE,
            "--model",
            self._current_profile.model or "gpt-4o",
        ]

    def get_cli_env(self) -> Dict[str, str]:
        """Get environment for OpenAI CLI."""
        env = {}
        if self._credentials and self._credentials.api_key:
            env["OPENAI_API_KEY"] = self._credentials.api_key
        return env

    async def health_check(self) -> bool:
        """Check if OpenAI CLI is available."""
        return shutil.which(self.CLI_EXECUTABLE) is not None
