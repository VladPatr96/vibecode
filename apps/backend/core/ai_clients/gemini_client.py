"""Google Gemini wrapper implementing BaseAIClient."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from .base import AIClientConfig, BaseAIClient

logger = logging.getLogger(__name__)


class GeminiAIClient(BaseAIClient):
    """Gemini SDK adapter."""

    SUPPORTED_MODELS = [
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-pro",
        "gemini-1.5-flash",
    ]

    def __init__(self, config: AIClientConfig):
        super().__init__(config)
        self._genai_client = None
        self._chat = None

    async def open(self) -> None:
        try:
            import google.generativeai as genai
        except ImportError as exc:  # pragma: no cover - depends on optional dep
            raise ImportError(
                "google-generativeai package is required. Install: pip install google-generativeai"
            ) from exc

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if api_key:
            genai.configure(api_key=api_key)

        generation_config = {}
        if self.config.temperature is not None:
            generation_config["temperature"] = self.config.temperature
        if self.config.max_tokens:
            generation_config["max_output_tokens"] = self.config.max_tokens
        if self.config.max_thinking_tokens:
            generation_config["thinking_config"] = {
                "thinking_budget": self.config.max_thinking_tokens
            }

        self._genai_client = genai.GenerativeModel(
            model_name=self.config.model,
            system_instruction=self.config.system_prompt or None,
            generation_config=generation_config or None,
        )

    async def close(self) -> None:
        self._genai_client = None
        self._chat = None

    async def run_session(
        self,
        prompt: str,
        spec_dir: Path | None = None,
        verbose: bool = False,
        phase: str = "coding",
    ) -> tuple[str, str, dict]:
        del spec_dir, phase
        if not self._genai_client:
            return "error", "Gemini client is not initialized", {"type": "init_error"}

        try:
            if not self._chat:
                self._chat = self._genai_client.start_chat()

            response = self._chat.send_message(prompt)
            response_text = getattr(response, "text", "") or ""

            if verbose and response_text:
                print(response_text)

            return "continue", response_text, {}
        except Exception as exc:  # pragma: no cover - runtime SDK behavior
            error = str(exc)
            logger.error("Gemini session error: %s", error)
            if "429" in error or "quota" in error.lower() or "resource_exhausted" in error.lower():
                return "error", error, {"type": "rate_limit", "message": error}
            return "error", error, {
                "type": "other",
                "message": error,
                "exception_type": type(exc).__name__,
            }
