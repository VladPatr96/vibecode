"""Gemini SDK provider for agent sessions.

This module provides a Gemini-based provider that mimics the Claude SDK client
interface for use with the agent system (planner, coder, QA, etc.).
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator, Optional

from core.mcp_bridge import MCPBridge, MCPBridgeProvider

logger = logging.getLogger(__name__)


@dataclass
class GeminiAgentConfig:
    """Configuration for Gemini agent sessions."""

    model: str
    system_prompt: str
    project_dir: Path
    spec_dir: Path
    allowed_tools: list[str] = field(default_factory=list)
    mcp_servers: dict[str, dict] = field(default_factory=dict)
    output_format: Optional[dict] = None
    max_turns: int = 100
    temperature: float = 0.7


class GeminiSDKClient(MCPBridgeProvider):
    """
    Gemini SDK client that provides a compatible interface with ClaudeSDKClient.

    This allows agents to use Gemini models through the same interface as Claude,
    enabling seamless provider switching.

    Note: Extended thinking is not supported by Gemini. MCP tools are supported
    via the MCP Bridge layer.
    """

    def __init__(self, config: GeminiAgentConfig):
        self.config = config
        self._model = None
        self._chat = None
        self._is_initialized = False
        self._mcp_bridge: Optional[MCPBridge] = None

    async def __aenter__(self):
        """Initialize the Gemini client."""
        try:
            import google.generativeai as genai
        except ImportError:
            raise ImportError(
                "google-generativeai package is required for Gemini provider. "
                "Install with: pip install google-generativeai"
            )

        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if not api_key:
            raise ValueError(
                "GEMINI_API_KEY or GOOGLE_API_KEY environment variable is required"
            )

        genai.configure(api_key=api_key)

        # Initialize MCP Bridge if servers configured
        if self.config.mcp_servers:
            await self.init_mcp_bridge(self.config.mcp_servers)

        # Configure generation settings
        generation_config = genai.GenerationConfig(
            temperature=self.config.temperature,
            max_output_tokens=8192,
        )

        # Get MCP tools formatted for Gemini
        tools = None
        if self._mcp_bridge:
            mcp_tools = self.get_mcp_tools("gemini")
            if mcp_tools:
                tools = mcp_tools

        # Create model with system instruction
        self._model = genai.GenerativeModel(
            model_name=self.config.model,
            system_instruction=self.config.system_prompt,
            generation_config=generation_config,
            tools=tools,
        )

        # Start chat session
        self._chat = self._model.start_chat(history=[])
        self._is_initialized = True

        logger.info(f"Gemini client initialized with model: {self.config.model}")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup resources."""
        await self.cleanup_mcp_bridge()
        self._chat = None
        self._model = None
        self._is_initialized = False

    async def run(self, prompt: str) -> AsyncIterator[dict]:
        """
        Run agent session with the given prompt.

        Yields streaming events compatible with Claude SDK format:
        - {"type": "text", "text": "..."}
        - {"type": "tool_use", "name": "...", "input": {...}}
        - {"type": "tool_result", "name": "...", "content": ...}
        - {"type": "result", "status": "success|error", "output": "..."}

        Args:
            prompt: The user prompt to process

        Yields:
            Dict events representing agent actions and responses
        """
        if not self._is_initialized:
            raise RuntimeError("Client not initialized. Use 'async with' context.")

        try:
            current_prompt = prompt
            turn = 0

            while turn < self.config.max_turns:
                turn += 1

                # Send message and get response
                response = await self._chat.send_message_async(
                    current_prompt,
                    stream=True,
                )

                full_text = ""
                function_calls = []

                async for chunk in response:
                    # Handle text content
                    if chunk.text:
                        full_text += chunk.text
                        yield {
                            "type": "text",
                            "text": chunk.text,
                        }

                    # Handle function calls
                    if hasattr(chunk, 'candidates') and chunk.candidates:
                        for candidate in chunk.candidates:
                            if hasattr(candidate, 'content') and candidate.content:
                                for part in candidate.content.parts:
                                    if hasattr(part, 'function_call') and part.function_call:
                                        fc = part.function_call
                                        function_calls.append({
                                            "name": fc.name,
                                            "args": dict(fc.args) if fc.args else {},
                                        })

                # If no function calls, we're done
                if not function_calls:
                    yield {
                        "type": "result",
                        "status": "success",
                        "output": full_text,
                    }
                    return

                # Process function calls via MCP Bridge
                tool_results = []
                for fc in function_calls:
                    yield {
                        "type": "tool_use",
                        "name": fc["name"],
                        "input": fc["args"],
                    }

                    # Execute via MCP Bridge
                    if self._mcp_bridge and self._mcp_bridge.has_tool(fc["name"]):
                        result = await self._mcp_bridge.call_tool(fc["name"], fc["args"])
                        tool_results.append({
                            "name": fc["name"],
                            "content": result.content if result.success else result.error,
                            "success": result.success,
                        })

                        yield {
                            "type": "tool_result",
                            "name": fc["name"],
                            "content": result.content if result.success else result.error,
                            "success": result.success,
                        }
                    else:
                        # Tool not available
                        yield {
                            "type": "tool_result",
                            "name": fc["name"],
                            "content": f"Tool {fc['name']} not available",
                            "success": False,
                        }
                        tool_results.append({
                            "name": fc["name"],
                            "content": f"Tool {fc['name']} not available",
                            "success": False,
                        })

                # Continue conversation with tool results
                current_prompt = json.dumps(tool_results)

            # Max turns reached
            yield {
                "type": "result",
                "status": "error",
                "error": f"Max turns ({self.config.max_turns}) reached",
            }

        except Exception as e:
            logger.error(f"Gemini API error: {e}")
            yield {
                "type": "result",
                "status": "error",
                "error": str(e),
            }

    def get_tool_format(self, tools: list[dict]) -> list[dict]:
        """
        Convert unified tool format to Gemini function_declarations format.

        Args:
            tools: List of tools in unified format

        Returns:
            List of tools in Gemini format
        """
        return [
            {
                "function_declarations": [
                    {
                        "name": t["name"],
                        "description": t.get("description", ""),
                        "parameters": t.get("input_schema", {}),
                    }
                    for t in tools
                ]
            }
        ]


def create_gemini_client(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    agent_type: str = "coder",
    output_format: Optional[dict] = None,
    mcp_servers: Optional[dict[str, dict]] = None,
) -> GeminiSDKClient:
    """
    Create a Gemini SDK client for agent sessions.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the spec
        model: Gemini model to use (e.g., 'gemini-2.0-flash', 'gemini-1.5-pro')
        agent_type: Agent type identifier
        output_format: Optional structured output format
        mcp_servers: Optional MCP server configurations for tool support

    Returns:
        Configured GeminiSDKClient
    """
    from agents.tools_pkg import get_allowed_tools, get_required_mcp_servers
    from prompts_pkg.project_context import detect_project_capabilities, load_project_index

    # Load project capabilities
    project_index = load_project_index(project_dir)
    project_capabilities = detect_project_capabilities(project_index)

    # Get allowed tools
    allowed_tools = get_allowed_tools(agent_type, project_capabilities, False, {})

    # Get required MCP servers if not provided
    if mcp_servers is None:
        required_servers = get_required_mcp_servers(agent_type, project_capabilities, False, {})
        mcp_servers = _build_mcp_server_configs(required_servers)

    # Build system prompt
    system_prompt = (
        f"You are an expert full-stack developer building production-quality software. "
        f"Your working directory is: {project_dir.resolve()}\n"
        f"Your filesystem access is RESTRICTED to this directory only. "
        f"Use relative paths (starting with ./) for all file operations.\n\n"
        f"You follow existing code patterns, write clean maintainable code, and verify "
        f"your work through thorough testing."
    )

    config = GeminiAgentConfig(
        model=model,
        system_prompt=system_prompt,
        project_dir=project_dir,
        spec_dir=spec_dir,
        allowed_tools=allowed_tools,
        mcp_servers=mcp_servers or {},
        output_format=output_format,
    )

    mcp_count = len(mcp_servers) if mcp_servers else 0
    print(f"Gemini provider configured:")
    print(f"   - Model: {model}")
    print(f"   - Agent type: {agent_type}")
    print(f"   - Working directory: {project_dir.resolve()}")
    print(f"   - Extended thinking: not supported")
    print(f"   - MCP servers: {mcp_count} configured via MCP Bridge")
    print()

    return GeminiSDKClient(config)


def _build_mcp_server_configs(required_servers: set[str]) -> dict[str, dict]:
    """Build MCP server configurations from required server names."""
    configs = {}

    if "context7" in required_servers:
        configs["context7"] = {
            "command": "npx",
            "args": ["-y", "@upstash/context7-mcp"],
        }

    if "puppeteer" in required_servers:
        configs["puppeteer"] = {
            "command": "npx",
            "args": ["puppeteer-mcp-server"],
        }

    return configs
