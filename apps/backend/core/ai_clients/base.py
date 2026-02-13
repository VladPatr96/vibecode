"""Provider-agnostic base interface for AI clients."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class AIClientConfig:
    """Configuration for creating an AI client."""

    model: str
    provider_type: str
    max_thinking_tokens: int | None = None
    temperature: float = 1.0
    max_tokens: int | None = None
    system_prompt: str = ""
    project_dir: Path | None = None
    spec_dir: Path | None = None
    agent_type: str = "coder"
    allowed_tools: list[str] = field(default_factory=list)
    mcp_servers: dict[str, Any] = field(default_factory=dict)
    extra: dict[str, Any] = field(default_factory=dict)


class BaseAIClient(ABC):
    """Abstract AI client wrapper used by non-Claude providers."""

    def __init__(self, config: AIClientConfig):
        self.config = config
        self._is_open = False

    async def __aenter__(self):
        await self.open()
        self._is_open = True
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
        self._is_open = False
        return False

    @abstractmethod
    async def open(self) -> None:
        """Initialize SDK resources."""

    @abstractmethod
    async def close(self) -> None:
        """Release SDK resources."""

    @abstractmethod
    async def run_session(
        self,
        prompt: str,
        spec_dir: Path | None = None,
        verbose: bool = False,
        phase: str = "coding",
    ) -> tuple[str, str, dict]:
        """Run one model session and return (status, response, error_info)."""

    @property
    def provider_type(self) -> str:
        return self.config.provider_type

    @property
    def model(self) -> str:
        return self.config.model
