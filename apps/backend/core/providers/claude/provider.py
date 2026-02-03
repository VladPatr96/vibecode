"""Claude Code CLI provider implementation."""

import shutil
from typing import Optional, Dict, Any, AsyncIterator, List

from ..base import BaseCLIProvider
from ..types import ProviderType, ProviderProfile
from .auth import ClaudeAuthHandler, ClaudeCredentialStorage, ClaudeRateLimiter


class ClaudeCLIProvider(BaseCLIProvider):
    """Claude Code CLI provider."""

    provider_type = ProviderType.CLAUDE
    CLI_EXECUTABLE = "claude"

    def __init__(
        self,
        auth_handler: Optional[ClaudeAuthHandler] = None,
        credential_storage: Optional[ClaudeCredentialStorage] = None,
        rate_limiter: Optional[ClaudeRateLimiter] = None,
    ):
        super().__init__(
            auth_handler=auth_handler or ClaudeAuthHandler(),
            credential_storage=credential_storage or ClaudeCredentialStorage(),
            rate_limiter=rate_limiter or ClaudeRateLimiter(),
        )

    @classmethod
    def create(cls, profile: ProviderProfile) -> "ClaudeCLIProvider":
        """Factory method for registry."""
        provider = cls()
        return provider

    async def initialize(self, profile: ProviderProfile) -> None:
        """Initialize with profile."""
        self._current_profile = profile

        # Get credentials
        self._credentials = await self.credential_storage.retrieve(profile.id)
        if not self._credentials:
            self._credentials = await self.auth_handler.authenticate(
                profile.config_dir
            )
            await self.credential_storage.store(profile.id, self._credentials)

    async def invoke(
        self,
        prompt: str,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[str]:
        """Invoke Claude CLI."""
        await self.rate_limiter.acquire()

        # Validate credentials
        if not await self.auth_handler.validate_credentials(self._credentials):
            self._credentials = await self.auth_handler.refresh_credentials(
                self._credentials
            )

        # Actual invocation handled by terminal layer
        yield ""

    async def resume_session(self, session_id: str) -> None:
        """Resume Claude session with --continue."""
        pass

    async def switch_profile(self, profile: ProviderProfile) -> None:
        """Switch to different profile."""
        await self.initialize(profile)

    def get_cli_command(self) -> List[str]:
        """Get Claude CLI command."""
        if not self._current_profile:
            raise RuntimeError("Provider not initialized")

        cmd = [self.CLI_EXECUTABLE]

        if self._current_profile.model:
            cmd.extend(["--model", self._current_profile.model])

        if self._current_profile.max_tokens:
            cmd.extend(["--max-tokens", str(self._current_profile.max_tokens)])

        return cmd

    def get_cli_env(self) -> Dict[str, str]:
        """Get environment for Claude CLI."""
        env = {
            "CLAUDE_CODE_ENTRYPOINT": "auto-claude",
        }

        if self._credentials and self._credentials.config_dir:
            env["CLAUDE_CONFIG_DIR"] = self._credentials.config_dir

        return env

    async def health_check(self) -> bool:
        """Check if Claude CLI is available."""
        return shutil.which(self.CLI_EXECUTABLE) is not None
