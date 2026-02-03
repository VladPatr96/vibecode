"""OpenAI SDK provider for agent sessions.

This module provides an OpenAI-based provider that mimics the Claude SDK client
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
class OpenAIAgentConfig:
    """Configuration for OpenAI agent sessions."""

    model: str
    system_prompt: str
    project_dir: Path
    spec_dir: Path
    allowed_tools: list[str] = field(default_factory=list)
    mcp_servers: dict[str, dict] = field(default_factory=dict)
    output_format: Optional[dict] = None
    max_turns: int = 100
    temperature: float = 0.7


class OpenAISDKClient(MCPBridgeProvider):
    """
    OpenAI SDK client that provides a compatible interface with ClaudeSDKClient.

    This allows agents to use OpenAI models through the same interface as Claude,
    enabling seamless provider switching.

    Note: Extended thinking is not supported by OpenAI. MCP tools are supported
    via the MCP Bridge layer.
    """

    def __init__(self, config: OpenAIAgentConfig):
        self.config = config
        self._client = None
        self._messages: list[dict] = []
        self._is_initialized = False
        self._mcp_bridge: Optional[MCPBridge] = None
        self._tools: list[dict] = []

    async def __aenter__(self):
        """Initialize the OpenAI client."""
        try:
            from openai import AsyncOpenAI
        except ImportError:
            raise ImportError(
                "openai package is required for OpenAI provider. "
                "Install with: pip install openai"
            )

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY environment variable is required")

        self._client = AsyncOpenAI(api_key=api_key)

        # Initialize MCP Bridge if servers configured
        if self.config.mcp_servers:
            await self.init_mcp_bridge(self.config.mcp_servers)
            # Get MCP tools formatted for OpenAI
            self._tools = self.get_mcp_tools("openai")

        # Initialize messages with system prompt
        self._messages = [
            {"role": "system", "content": self.config.system_prompt}
        ]

        self._is_initialized = True
        logger.info(f"OpenAI client initialized with model: {self.config.model}")
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup resources."""
        await self.cleanup_mcp_bridge()
        self._client = None
        self._messages = []
        self._tools = []
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

        # Add user message
        self._messages.append({"role": "user", "content": prompt})

        try:
            turn = 0
            while turn < self.config.max_turns:
                turn += 1

                # Build request params
                request_params = {
                    "model": self.config.model,
                    "messages": self._messages,
                    "temperature": self.config.temperature,
                    "max_tokens": 8192,
                    "stream": True,
                }

                # Add tools if available
                if self._tools:
                    request_params["tools"] = self._tools

                # Create streaming completion
                stream = await self._client.chat.completions.create(**request_params)

                full_text = ""
                tool_calls = []
                current_tool_call = None

                async for chunk in stream:
                    if not chunk.choices:
                        continue

                    delta = chunk.choices[0].delta

                    # Handle text content
                    if delta.content:
                        full_text += delta.content
                        yield {
                            "type": "text",
                            "text": delta.content,
                        }

                    # Handle tool calls
                    if delta.tool_calls:
                        for tc in delta.tool_calls:
                            if tc.index >= len(tool_calls):
                                tool_calls.append({
                                    "id": tc.id,
                                    "name": "",
                                    "arguments": "",
                                })
                            if tc.function:
                                if tc.function.name:
                                    tool_calls[tc.index]["name"] = tc.function.name
                                if tc.function.arguments:
                                    tool_calls[tc.index]["arguments"] += tc.function.arguments

                # Check finish reason
                finish_reason = None
                if stream._last_response and stream._last_response.choices:
                    finish_reason = stream._last_response.choices[0].finish_reason

                # If no tool calls, we're done
                if not tool_calls or finish_reason != "tool_calls":
                    self._messages.append({"role": "assistant", "content": full_text})
                    yield {
                        "type": "result",
                        "status": "success",
                        "output": full_text,
                    }
                    return

                # Process tool calls via MCP Bridge
                assistant_msg = {
                    "role": "assistant",
                    "content": full_text or None,
                    "tool_calls": [
                        {
                            "id": tc["id"],
                            "type": "function",
                            "function": {
                                "name": tc["name"],
                                "arguments": tc["arguments"],
                            },
                        }
                        for tc in tool_calls
                    ],
                }
                self._messages.append(assistant_msg)

                for tc in tool_calls:
                    try:
                        args = json.loads(tc["arguments"]) if tc["arguments"] else {}
                    except json.JSONDecodeError:
                        args = {}

                    yield {
                        "type": "tool_use",
                        "name": tc["name"],
                        "input": args,
                    }

                    # Execute via MCP Bridge
                    if self._mcp_bridge and self._mcp_bridge.has_tool(tc["name"]):
                        result = await self._mcp_bridge.call_tool(tc["name"], args)
                        content = json.dumps(result.content) if result.success else result.error

                        yield {
                            "type": "tool_result",
                            "name": tc["name"],
                            "content": result.content if result.success else result.error,
                            "success": result.success,
                        }

                        # Add tool result to messages
                        self._messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": content,
                        })
                    else:
                        # Tool not available
                        error_msg = f"Tool {tc['name']} not available"
                        yield {
                            "type": "tool_result",
                            "name": tc["name"],
                            "content": error_msg,
                            "success": False,
                        }
                        self._messages.append({
                            "role": "tool",
                            "tool_call_id": tc["id"],
                            "content": error_msg,
                        })

            # Max turns reached
            yield {
                "type": "result",
                "status": "error",
                "error": f"Max turns ({self.config.max_turns}) reached",
            }

        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            yield {
                "type": "result",
                "status": "error",
                "error": str(e),
            }

    def get_tool_format(self, tools: list[dict]) -> list[dict]:
        """
        Convert unified tool format to OpenAI tools format.

        Args:
            tools: List of tools in unified format

        Returns:
            List of tools in OpenAI format
        """
        return [
            {
                "type": "function",
                "function": {
                    "name": t["name"],
                    "description": t.get("description", ""),
                    "parameters": t.get("input_schema", {}),
                },
            }
            for t in tools
        ]


def create_openai_client(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    agent_type: str = "coder",
    output_format: Optional[dict] = None,
    mcp_servers: Optional[dict[str, dict]] = None,
) -> OpenAISDKClient:
    """
    Create an OpenAI SDK client for agent sessions.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the spec
        model: OpenAI model to use (e.g., 'gpt-4o', 'gpt-4-turbo', 'o1-preview')
        agent_type: Agent type identifier
        output_format: Optional structured output format
        mcp_servers: Optional MCP server configurations for tool support

    Returns:
        Configured OpenAISDKClient
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

    config = OpenAIAgentConfig(
        model=model,
        system_prompt=system_prompt,
        project_dir=project_dir,
        spec_dir=spec_dir,
        allowed_tools=allowed_tools,
        mcp_servers=mcp_servers or {},
        output_format=output_format,
    )

    mcp_count = len(mcp_servers) if mcp_servers else 0
    print(f"OpenAI provider configured:")
    print(f"   - Model: {model}")
    print(f"   - Agent type: {agent_type}")
    print(f"   - Working directory: {project_dir.resolve()}")
    print(f"   - Extended thinking: not supported")
    print(f"   - MCP servers: {mcp_count} configured via MCP Bridge")
    print()

    return OpenAISDKClient(config)


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
