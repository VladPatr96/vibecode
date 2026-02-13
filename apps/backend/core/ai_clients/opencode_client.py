"""OpenCode CLI wrapper implementing BaseAIClient."""

from __future__ import annotations

import asyncio
from pathlib import Path

from .base import AIClientConfig, BaseAIClient


class OpenCodeAIClient(BaseAIClient):
    """Thin adapter around opencode CLI."""

    SUPPORTED_MODELS = [
        "deepseek-v3",
        "deepseek-coder",
        "claude-sonnet-4",
    ]

    async def open(self) -> None:
        return None

    async def close(self) -> None:
        return None

    async def run_session(
        self,
        prompt: str,
        spec_dir: Path | None = None,
        verbose: bool = False,
        phase: str = "coding",
    ) -> tuple[str, str, dict]:
        del phase
        try:
            process = await asyncio.create_subprocess_exec(
                "opencode",
                "--model",
                self.config.model,
                "--prompt",
                prompt,
                cwd=str((spec_dir or self.config.project_dir or Path(".")).resolve()),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await process.communicate()
            output = stdout.decode("utf-8", errors="ignore").strip()
            error_output = stderr.decode("utf-8", errors="ignore").strip()

            if process.returncode != 0:
                message = error_output or output or "opencode exited with non-zero status"
                return "error", message, {"type": "cli_error", "returncode": process.returncode}

            if verbose and output:
                print(output)

            return "continue", output, {}
        except FileNotFoundError:
            return "error", "opencode CLI not found in PATH", {"type": "missing_cli"}
        except Exception as exc:  # pragma: no cover - subprocess runtime behavior
            error = str(exc)
            return "error", error, {"type": "other", "exception_type": type(exc).__name__}
