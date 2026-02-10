"""Type definitions for CLI providers."""

from dataclasses import dataclass, field
from enum import Enum
from typing import Optional, Dict, Any


class ProviderType(str, Enum):
    """Supported CLI provider types."""
    CLAUDE = "claude"
    GEMINI = "gemini"
    OPENAI = "openai"
    OPENCODE = "opencode"


@dataclass
class ProviderCredentials:
    """Universal credentials for any provider."""
    provider_type: ProviderType
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    api_key: Optional[str] = None
    expires_at: Optional[int] = None
    config_dir: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderProfile:
    """Provider profile configuration."""
    id: str
    name: str
    provider_type: ProviderType
    model: str
    config_dir: Optional[str] = None
    temperature: float = 0.7
    max_tokens: int = 4096
    custom_params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RateLimitInfo:
    """Rate limit state."""
    requests_remaining: int
    tokens_remaining: int
    reset_at: int
    retry_after: Optional[int] = None


class ProviderError(Exception):
    """Base exception for provider errors."""
    pass


class AuthenticationError(ProviderError):
    """Authentication failed."""
    pass


class RateLimitError(ProviderError):
    """Rate limit exceeded."""
    def __init__(self, message: str, rate_limit_info: RateLimitInfo):
        super().__init__(message)
        self.rate_limit_info = rate_limit_info
