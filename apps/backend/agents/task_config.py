"""Task Provider Configuration.

This module handles provider selection for autonomous tasks.
Provider can be specified in task_metadata.json or via CLI.

Supported providers:
- claude (default): Uses Claude Agent SDK with full MCP support
- gemini: Uses Gemini API with MCP Bridge
- openai: Uses OpenAI API with MCP Bridge
"""

import json
import logging
from pathlib import Path
from typing import Optional, Union

from core.providers.types import ProviderType

logger = logging.getLogger(__name__)

# Default provider
DEFAULT_PROVIDER = ProviderType.CLAUDE

# Provider-specific defaults
PROVIDER_DEFAULTS = {
    ProviderType.CLAUDE: {
        "planning_model": "claude-sonnet-4-20250514",
        "coding_model": "claude-sonnet-4-20250514",
        "qa_model": "claude-sonnet-4-20250514",
        "supports_thinking": True,
        "default_thinking_budget": {
            "planning": 5000,
            "coding": None,
            "qa": 10000,
        },
    },
    ProviderType.GEMINI: {
        "planning_model": "gemini-2.0-flash",
        "coding_model": "gemini-2.0-flash",
        "qa_model": "gemini-2.0-flash",
        "supports_thinking": False,
        "default_thinking_budget": {
            "planning": None,
            "coding": None,
            "qa": None,
        },
    },
    ProviderType.OPENAI: {
        "planning_model": "gpt-4o",
        "coding_model": "gpt-4o",
        "qa_model": "gpt-4o",
        "supports_thinking": False,
        "default_thinking_budget": {
            "planning": None,
            "coding": None,
            "qa": None,
        },
    },
}


def get_task_provider(
    spec_dir: Path,
    cli_provider: Optional[str] = None,
) -> ProviderType:
    """
    Get the provider type for a task.

    Priority:
    1. CLI override (--provider flag)
    2. task_metadata.json "provider" field
    3. Default (claude)

    Args:
        spec_dir: Spec directory containing task_metadata.json
        cli_provider: Optional CLI override

    Returns:
        ProviderType enum value
    """
    # CLI override takes priority
    if cli_provider:
        try:
            return ProviderType(cli_provider.lower())
        except ValueError:
            logger.warning(f"Unknown provider '{cli_provider}', using default")
            return DEFAULT_PROVIDER

    # Check task_metadata.json
    metadata_file = spec_dir / "task_metadata.json"
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)

            provider_str = metadata.get("provider", "").lower()
            if provider_str:
                try:
                    return ProviderType(provider_str)
                except ValueError:
                    logger.warning(
                        f"Unknown provider '{provider_str}' in task_metadata.json"
                    )
        except (json.JSONDecodeError, IOError) as e:
            logger.debug(f"Failed to read task_metadata.json: {e}")

    return DEFAULT_PROVIDER


def get_provider_model(
    spec_dir: Path,
    phase: str,
    provider: ProviderType,
    cli_model: Optional[str] = None,
) -> str:
    """
    Get the model for a specific phase and provider.

    Priority:
    1. CLI override (--model flag)
    2. task_metadata.json models.{phase} field
    3. Provider-specific default

    Args:
        spec_dir: Spec directory
        phase: Phase name ('planning', 'coding', 'qa')
        provider: Provider type
        cli_model: Optional CLI model override

    Returns:
        Model name string
    """
    # CLI override
    if cli_model:
        return cli_model

    # Check task_metadata.json
    metadata_file = spec_dir / "task_metadata.json"
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)

            models = metadata.get("models", {})
            if phase in models:
                return models[phase]
        except (json.JSONDecodeError, IOError):
            pass

    # Provider default
    defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS[ProviderType.CLAUDE])
    return defaults.get(f"{phase}_model", defaults["coding_model"])


def get_provider_thinking_budget(
    spec_dir: Path,
    phase: str,
    provider: ProviderType,
    cli_thinking: Optional[int] = None,
) -> Optional[int]:
    """
    Get the thinking budget for a specific phase and provider.

    Note: Only Claude supports extended thinking. Other providers return None.

    Args:
        spec_dir: Spec directory
        phase: Phase name ('planning', 'coding', 'qa')
        provider: Provider type
        cli_thinking: Optional CLI override

    Returns:
        Thinking budget (int) or None if not supported
    """
    # Non-Claude providers don't support thinking
    if provider != ProviderType.CLAUDE:
        return None

    # CLI override
    if cli_thinking is not None:
        return cli_thinking

    # Check task_metadata.json
    metadata_file = spec_dir / "task_metadata.json"
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)

            budgets = metadata.get("thinking_budgets", {})
            if phase in budgets:
                return budgets[phase]
        except (json.JSONDecodeError, IOError):
            pass

    # Provider default
    defaults = PROVIDER_DEFAULTS.get(provider, PROVIDER_DEFAULTS[ProviderType.CLAUDE])
    return defaults.get("default_thinking_budget", {}).get(phase)


def save_task_provider(spec_dir: Path, provider: ProviderType) -> None:
    """
    Save provider selection to task_metadata.json.

    Args:
        spec_dir: Spec directory
        provider: Provider to save
    """
    metadata_file = spec_dir / "task_metadata.json"

    metadata = {}
    if metadata_file.exists():
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except (json.JSONDecodeError, IOError):
            pass

    metadata["provider"] = provider.value

    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)


def get_provider_capabilities(provider: ProviderType) -> dict:
    """
    Get capabilities for a provider.

    Args:
        provider: Provider type

    Returns:
        Dict with capability flags
    """
    return {
        "supports_thinking": provider == ProviderType.CLAUDE,
        "supports_mcp_native": provider == ProviderType.CLAUDE,
        "supports_session_resume": provider == ProviderType.CLAUDE,
        "requires_api_key": provider != ProviderType.CLAUDE,
    }
