"""Claude authentication handlers."""

import os
import hashlib
from typing import Optional, List

from ..base import BaseAuthHandler, BaseCredentialStorage, BaseRateLimiter
from ..types import ProviderCredentials, ProviderType, RateLimitInfo


def _get_keychain_service_name(config_dir: str | None = None) -> str:
    """
    Get the Keychain service name for credential storage.

    Matches the frontend's getKeychainServiceName() in credential-utils.ts.
    """
    if not config_dir:
        return "Claude Code-credentials"

    expanded_dir = os.path.expanduser(config_dir)
    hash_suffix = hashlib.sha256(expanded_dir.encode()).hexdigest()[:8]
    return f"Claude Code-credentials-{hash_suffix}"


def _get_auth_token_from_env() -> Optional[str]:
    """Get auth token from environment variables."""
    auth_token_vars = [
        "CLAUDE_CODE_OAUTH_TOKEN",
        "ANTHROPIC_AUTH_TOKEN",
    ]
    for var in auth_token_vars:
        token = os.environ.get(var)
        if token:
            return token
    return None


class ClaudeAuthHandler(BaseAuthHandler):
    """OAuth authentication for Claude."""

    async def authenticate(
        self, config_dir: Optional[str] = None
    ) -> ProviderCredentials:
        """Get credentials from existing Claude auth system."""
        token = _get_auth_token_from_env()
        return ProviderCredentials(
            provider_type=ProviderType.CLAUDE,
            access_token=token,
            config_dir=config_dir,
        )

    async def refresh_credentials(
        self, credentials: ProviderCredentials
    ) -> ProviderCredentials:
        """Refresh Claude OAuth token."""
        # Claude CLI handles refresh automatically
        return await self.authenticate(credentials.config_dir)

    async def validate_credentials(
        self, credentials: ProviderCredentials
    ) -> bool:
        """Validate Claude token."""
        return credentials.access_token is not None

    async def revoke_credentials(
        self, credentials: ProviderCredentials
    ) -> None:
        """Revoke Claude credentials."""
        # TODO: Implement token revocation
        pass


class ClaudeCredentialStorage(BaseCredentialStorage):
    """Keychain storage for Claude credentials."""

    SERVICE_PREFIX = "Auto-Claude-claude"

    def _get_service_name(self, profile_id: str) -> str:
        """Get keychain service name for profile."""
        hash_suffix = hashlib.sha256(profile_id.encode()).hexdigest()[:8]
        return f"{self.SERVICE_PREFIX}-{hash_suffix}"

    async def store(
        self, profile_id: str, credentials: ProviderCredentials
    ) -> None:
        """Store in system keychain."""
        # Delegate to existing credential-utils
        pass

    async def retrieve(
        self, profile_id: str
    ) -> Optional[ProviderCredentials]:
        """Retrieve from system keychain."""
        # Try to get token from environment
        token = _get_auth_token_from_env()
        if token:
            return ProviderCredentials(
                provider_type=ProviderType.CLAUDE,
                access_token=token,
                config_dir=profile_id,
            )
        return None

    async def delete(self, profile_id: str) -> None:
        """Delete from keychain."""
        pass

    async def list_profiles(self) -> List[str]:
        """List Claude profiles."""
        # TODO: Enumerate from keychain
        return []


class ClaudeRateLimiter(BaseRateLimiter):
    """Rate limiter for Claude API."""

    DEFAULT_RPM = 50
    DEFAULT_TPM = 100000

    def __init__(self):
        self._requests_remaining = self.DEFAULT_RPM
        self._tokens_remaining = self.DEFAULT_TPM
        self._reset_at = 0

    async def acquire(self, tokens_estimate: int = 1) -> None:
        """Acquire permission (Claude CLI handles rate limiting)."""
        pass

    async def update_limits(self, rate_limit_info: RateLimitInfo) -> None:
        """Update from response headers."""
        self._requests_remaining = rate_limit_info.requests_remaining
        self._tokens_remaining = rate_limit_info.tokens_remaining
        self._reset_at = rate_limit_info.reset_at

    def get_current_limits(self) -> RateLimitInfo:
        """Get current state."""
        return RateLimitInfo(
            requests_remaining=self._requests_remaining,
            tokens_remaining=self._tokens_remaining,
            reset_at=self._reset_at,
        )
