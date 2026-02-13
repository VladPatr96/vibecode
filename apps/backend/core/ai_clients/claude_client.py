"""Claude SDK wrapper implementing BaseAIClient."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from .base import AIClientConfig, BaseAIClient


class ClaudeAIClient(BaseAIClient):
    """Adapter that wraps a ClaudeSDKClient-like object."""

    def __init__(self, config: AIClientConfig, sdk_client: Any | None = None):
        super().__init__(config)
        self._sdk_client = sdk_client

    async def open(self) -> None:
        if self._sdk_client is not None:
            await self._sdk_client.__aenter__()

    async def close(self) -> None:
        if self._sdk_client is not None:
            await self._sdk_client.__aexit__(None, None, None)

    async def run_session(
        self,
        prompt: str,
        spec_dir: Path | None = None,
        verbose: bool = False,
        phase: str = "coding",
    ) -> tuple[str, str, dict]:
        if self._sdk_client is None:
            return "error", "Claude SDK client is not initialized", {"type": "init_error"}

        from agents.session import run_agent_session
        from task_logger import LogPhase

        phase_map = {
            "planning": LogPhase.PLANNING,
            "coding": LogPhase.CODING,
            "qa_review": LogPhase.VALIDATION,
            "qa_fixing": LogPhase.VALIDATION,
        }
        log_phase = phase_map.get(phase, LogPhase.CODING)

        return await run_agent_session(
            self._sdk_client,
            prompt,
            spec_dir or self.config.spec_dir or Path("."),
            verbose,
            phase=log_phase,
        )
