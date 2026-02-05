"""Provider factory for creating provider instances.

This module provides a factory function for creating SDK-based providers
that integrate with the agent system (planner, coder, QA, etc.).

For terminal/CLI providers, use the ProviderRegistry from registry.py.
"""

from pathlib import Path
from typing import Any, Optional, Union

from .types import ProviderType


def create_provider(
    provider_type: Union[str, ProviderType],
    project_dir: Path,
    spec_dir: Path,
    model: str,
    agent_type: str = "coder",
    max_thinking_tokens: Optional[int] = None,
    output_format: Optional[dict] = None,
    agents: Optional[dict] = None,
) -> Any:
    """
    Factory function to create SDK-based provider instances for agent sessions.

    This function creates providers for autonomous agent sessions (planner, coder, QA).
    For terminal/CLI integration, use ProviderRegistry.create_for_terminal() instead.

    Args:
        provider_type: Provider type ('claude', 'gemini', 'openai' or ProviderType enum)
        project_dir: Root directory for the project (working directory)
        spec_dir: Directory containing the spec (for settings file)
        model: Model to use (e.g., 'claude-sonnet-4', 'gemini-2.0-flash', 'gpt-4o')
        agent_type: Agent type identifier ('coder', 'planner', 'qa_reviewer', etc.)
        max_thinking_tokens: Token budget for extended thinking (Claude only)
        output_format: Optional structured output format for validated JSON responses
        agents: Optional dict of subagent definitions for parallel execution

    Returns:
        Configured provider client (ClaudeSDKClient for Claude, API client for others)

    Raises:
        ValueError: If provider_type is not supported

    Example:
        >>> provider = create_provider(
        ...     provider_type="claude",
        ...     project_dir=Path("/project"),
        ...     spec_dir=Path("/project/.auto-claude/specs/001"),
        ...     model="claude-sonnet-4",
        ...     agent_type="coder",
        ... )
        >>> async with provider:
        ...     status, response = await run_agent_session(provider, prompt, spec_dir)
    """
    # Normalize provider type
    if isinstance(provider_type, str):
        try:
            provider_type = ProviderType(provider_type.lower())
        except ValueError:
            raise ValueError(
                f"Unknown provider type: {provider_type}. "
                f"Supported: {[p.value for p in ProviderType]}"
            )

    if provider_type == ProviderType.CLAUDE:
        # Use existing Claude SDK client via create_client
        from core.client import create_client as create_claude_client

        return create_claude_client(
            project_dir=project_dir,
            spec_dir=spec_dir,
            model=model,
            agent_type=agent_type,
            max_thinking_tokens=max_thinking_tokens,
            output_format=output_format,
            agents=agents,
        )

    elif provider_type == ProviderType.GEMINI:
        # Create Gemini SDK provider
        from .gemini.sdk_provider import create_gemini_client

        return create_gemini_client(
            project_dir=project_dir,
            spec_dir=spec_dir,
            model=model,
            agent_type=agent_type,
            output_format=output_format,
        )

    elif provider_type == ProviderType.OPENAI:
        # Create OpenAI SDK provider
        from .openai.sdk_provider import create_openai_client

        return create_openai_client(
            project_dir=project_dir,
            spec_dir=spec_dir,
            model=model,
            agent_type=agent_type,
            output_format=output_format,
        )

    else:
        raise ValueError(f"Unsupported provider type: {provider_type}")


def get_provider_capabilities(provider_type: Union[str, ProviderType]) -> dict:
    """
    Get capabilities for a provider type.

    Args:
        provider_type: Provider type string or enum

    Returns:
        Dict with capability flags:
        - supports_extended_thinking: bool
        - supports_mcp: bool (native MCP support)
        - supports_streaming: bool
        - supports_tool_use: bool
        - supports_vision: bool
        - supports_session_resume: bool
    """
    # Normalize provider type
    if isinstance(provider_type, str):
        try:
            provider_type = ProviderType(provider_type.lower())
        except ValueError:
            return {}

    capabilities = {
        ProviderType.CLAUDE: {
            "supports_extended_thinking": True,
            "supports_mcp": True,
            "supports_streaming": True,
            "supports_tool_use": True,
            "supports_vision": True,
            "supports_session_resume": True,
        },
        ProviderType.GEMINI: {
            "supports_extended_thinking": False,
            "supports_mcp": False,  # Requires MCP Bridge
            "supports_streaming": True,
            "supports_tool_use": True,
            "supports_vision": True,
            "supports_session_resume": False,
        },
        ProviderType.OPENAI: {
            "supports_extended_thinking": False,
            "supports_mcp": False,  # Requires MCP Bridge
            "supports_streaming": True,
            "supports_tool_use": True,
            "supports_vision": True,
            "supports_session_resume": False,
        },
    }

    return capabilities.get(provider_type, {})
