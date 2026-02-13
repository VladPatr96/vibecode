"""Factory helpers for provider-specific AI clients."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .base import AIClientConfig, BaseAIClient


def create_provider_client(
    provider_type: str,
    model: str,
    system_prompt: str = "",
    project_dir: Path | None = None,
    spec_dir: Path | None = None,
    agent_type: str = "coder",
    max_thinking_tokens: int | None = None,
    **kwargs: Any,
) -> BaseAIClient:
    """Create an AI client for a non-Claude provider."""

    provider_key = (provider_type or "").lower()
    config = AIClientConfig(
        model=model,
        provider_type=provider_key,
        system_prompt=system_prompt,
        project_dir=project_dir,
        spec_dir=spec_dir,
        agent_type=agent_type,
        max_thinking_tokens=max_thinking_tokens,
        extra=kwargs,
    )

    if provider_key == "gemini":
        from .gemini_client import GeminiAIClient

        return GeminiAIClient(config=config)
    if provider_key in ("openai", "codex"):
        from .openai_client import OpenAIClient

        return OpenAIClient(config=config)
    if provider_key == "opencode":
        from .opencode_client import OpenCodeAIClient

        return OpenCodeAIClient(config=config)

    raise ValueError(f"Unknown provider type: {provider_type}")
