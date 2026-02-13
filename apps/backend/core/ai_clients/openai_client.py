"""OpenAI/Codex wrapper implementing BaseAIClient."""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

from .base import AIClientConfig, BaseAIClient

logger = logging.getLogger(__name__)


class OpenAIClient(BaseAIClient):
    """OpenAI SDK adapter used for both openai and codex provider types."""

    SUPPORTED_MODELS = [
        "gpt-4o",
        "gpt-4.1",
        "gpt-4o-mini",
        "o3",
        "o3-mini",
    ]

    def __init__(self, config: AIClientConfig):
        super().__init__(config)
        self._client: Any | None = None

    async def open(self) -> None:
        try:
            from openai import AsyncOpenAI
        except ImportError as exc:  # pragma: no cover - depends on optional dep
            raise ImportError(
                "openai package is required. Install: pip install openai"
            ) from exc

        self._client = AsyncOpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

    async def close(self) -> None:
        self._client = None

    async def run_session(
        self,
        prompt: str,
        spec_dir: Path | None = None,
        verbose: bool = False,
        phase: str = "coding",
    ) -> tuple[str, str, dict]:
        del spec_dir, phase
        if self._client is None:
            return "error", "OpenAI client is not initialized", {"type": "init_error"}

        try:
            kwargs: dict[str, Any] = {
                "model": self.config.model,
                "input": prompt,
            }
            if self.config.temperature is not None:
                kwargs["temperature"] = self.config.temperature
            if self.config.max_tokens is not None:
                kwargs["max_output_tokens"] = self.config.max_tokens

            response = await self._client.responses.create(**kwargs)
            response_text = getattr(response, "output_text", "") or ""
            if not response_text and hasattr(response, "output"):
                chunks: list[str] = []
                for item in getattr(response, "output", []):
                    for content in getattr(item, "content", []) or []:
                        text = getattr(content, "text", None)
                        if text:
                            chunks.append(text)
                response_text = "".join(chunks)

            if verbose and response_text:
                print(response_text)

            return "continue", response_text, {}
        except Exception as exc:  # pragma: no cover - runtime SDK behavior
            error = str(exc)
            logger.error("OpenAI session error: %s", error)
            if "429" in error or "rate limit" in error.lower():
                return "error", error, {"type": "rate_limit", "message": error}
            return "error", error, {
                "type": "other",
                "message": error,
                "exception_type": type(exc).__name__,
            }
