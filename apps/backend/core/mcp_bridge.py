"""MCP Bridge Layer for non-Claude providers.

This module provides a bridge between MCP (Model Context Protocol) servers
and non-Claude providers (Gemini, OpenAI) that don't have native MCP support.

The bridge:
1. Spawns and manages MCP server processes
2. Communicates with servers via JSON-RPC over stdio
3. Converts tool calls to/from provider-specific formats
4. Routes tool executions to the appropriate MCP server

Architecture:
    Provider (Gemini/OpenAI) -> MCPBridge -> MCP Server Process
                                    |
                                    v
                             Tool Result
"""

import asyncio
import json
import logging
import os
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

from core.platform import is_windows, find_executable

logger = logging.getLogger(__name__)


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""

    name: str
    command: str
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    cwd: Optional[str] = None


@dataclass
class MCPTool:
    """Represents a tool exposed by an MCP server."""

    name: str
    description: str
    input_schema: dict
    server_name: str


@dataclass
class MCPToolResult:
    """Result from an MCP tool execution."""

    success: bool
    content: Any
    error: Optional[str] = None


class MCPServerProcess:
    """Manages a single MCP server process."""

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self._process: Optional[asyncio.subprocess.Process] = None
        self._tools: list[MCPTool] = []
        self._request_id = 0
        self._pending_requests: dict[int, asyncio.Future] = {}
        self._read_task: Optional[asyncio.Task] = None

    @property
    def is_running(self) -> bool:
        return self._process is not None and self._process.returncode is None

    async def start(self) -> None:
        """Start the MCP server process."""
        if self.is_running:
            return

        # Build command
        cmd = self.config.command
        args = self.config.args

        # On Windows, use shell for npx/npm commands
        shell = False
        if is_windows() and cmd in ("npx", "npm", "node"):
            shell = True

        # Merge environment
        env = os.environ.copy()
        env.update(self.config.env)

        try:
            if shell and is_windows():
                # Windows requires shell=True for npm/npx
                full_cmd = f"{cmd} {' '.join(args)}"
                self._process = await asyncio.create_subprocess_shell(
                    full_cmd,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                    cwd=self.config.cwd,
                )
            else:
                self._process = await asyncio.create_subprocess_exec(
                    cmd,
                    *args,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    env=env,
                    cwd=self.config.cwd,
                )

            # Start reading responses
            self._read_task = asyncio.create_task(self._read_responses())

            logger.info(f"Started MCP server: {self.config.name}")

            # Initialize and get tools
            await self._initialize()
            await self._list_tools()

        except Exception as e:
            logger.error(f"Failed to start MCP server {self.config.name}: {e}")
            raise

    async def stop(self) -> None:
        """Stop the MCP server process."""
        if self._read_task:
            self._read_task.cancel()
            try:
                await self._read_task
            except asyncio.CancelledError:
                pass

        if self._process:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self._process.kill()

            self._process = None
            logger.info(f"Stopped MCP server: {self.config.name}")

    async def _send_request(self, method: str, params: dict = None) -> Any:
        """Send a JSON-RPC request to the MCP server."""
        if not self.is_running:
            raise RuntimeError(f"MCP server {self.config.name} is not running")

        self._request_id += 1
        request_id = self._request_id

        request = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method,
        }
        if params:
            request["params"] = params

        # Create future for response
        future = asyncio.get_event_loop().create_future()
        self._pending_requests[request_id] = future

        # Send request
        request_json = json.dumps(request) + "\n"
        self._process.stdin.write(request_json.encode())
        await self._process.stdin.drain()

        # Wait for response with timeout
        try:
            result = await asyncio.wait_for(future, timeout=30.0)
            return result
        except asyncio.TimeoutError:
            del self._pending_requests[request_id]
            raise TimeoutError(f"MCP request {method} timed out")

    async def _read_responses(self) -> None:
        """Read responses from the MCP server."""
        try:
            while self.is_running:
                line = await self._process.stdout.readline()
                if not line:
                    break

                try:
                    response = json.loads(line.decode())
                    request_id = response.get("id")

                    if request_id and request_id in self._pending_requests:
                        future = self._pending_requests.pop(request_id)
                        if "error" in response:
                            future.set_exception(
                                RuntimeError(response["error"].get("message", "Unknown error"))
                            )
                        else:
                            future.set_result(response.get("result"))

                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from MCP server: {line}")

        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.error(f"Error reading MCP responses: {e}")

    async def _initialize(self) -> None:
        """Initialize the MCP server connection."""
        await self._send_request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "auto-claude-mcp-bridge",
                "version": "1.0.0",
            },
        })

        # Send initialized notification
        notification = {
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        }
        self._process.stdin.write((json.dumps(notification) + "\n").encode())
        await self._process.stdin.drain()

    async def _list_tools(self) -> None:
        """Get list of tools from the MCP server."""
        result = await self._send_request("tools/list")

        self._tools = []
        for tool in result.get("tools", []):
            self._tools.append(MCPTool(
                name=tool["name"],
                description=tool.get("description", ""),
                input_schema=tool.get("inputSchema", {}),
                server_name=self.config.name,
            ))

        logger.info(f"MCP server {self.config.name} provides {len(self._tools)} tools")

    def get_tools(self) -> list[MCPTool]:
        """Get all tools provided by this server."""
        return self._tools

    async def call_tool(self, tool_name: str, arguments: dict) -> MCPToolResult:
        """Execute a tool on this MCP server."""
        try:
            result = await self._send_request("tools/call", {
                "name": tool_name,
                "arguments": arguments,
            })

            return MCPToolResult(
                success=True,
                content=result.get("content", []),
            )

        except Exception as e:
            logger.error(f"Tool call failed: {tool_name}: {e}")
            return MCPToolResult(
                success=False,
                content=None,
                error=str(e),
            )


class MCPBridge:
    """
    Bridge between MCP servers and non-Claude providers.

    This class manages multiple MCP server processes and provides
    a unified interface for tool discovery and execution.

    Usage:
        bridge = MCPBridge({
            "context7": {"command": "npx", "args": ["-y", "@upstash/context7-mcp"]},
            "puppeteer": {"command": "npx", "args": ["puppeteer-mcp-server"]},
        })

        async with bridge:
            tools = bridge.get_all_tools()
            result = await bridge.call_tool("mcp__context7__resolve", {...})
    """

    def __init__(self, mcp_servers: dict[str, dict]):
        """
        Initialize MCP Bridge with server configurations.

        Args:
            mcp_servers: Dict of server name -> config
                Config format: {"command": str, "args": list, "env": dict, "cwd": str}
        """
        self._servers: dict[str, MCPServerProcess] = {}
        self._tool_to_server: dict[str, str] = {}

        for name, config in mcp_servers.items():
            # Skip HTTP-based MCP servers (they don't need bridge)
            if config.get("type") == "http":
                continue

            self._servers[name] = MCPServerProcess(MCPServerConfig(
                name=name,
                command=config.get("command", "npx"),
                args=config.get("args", []),
                env=config.get("env", {}),
                cwd=config.get("cwd"),
            ))

    async def __aenter__(self):
        """Start all MCP servers."""
        await self.start_servers()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Stop all MCP servers."""
        await self.stop_servers()

    async def start_servers(self) -> None:
        """Start all configured MCP servers."""
        tasks = [server.start() for server in self._servers.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

        # Build tool -> server mapping
        self._tool_to_server.clear()
        for name, server in self._servers.items():
            for tool in server.get_tools():
                # Use prefixed tool names to avoid collisions
                prefixed_name = f"mcp__{name}__{tool.name}"
                self._tool_to_server[prefixed_name] = name
                self._tool_to_server[tool.name] = name  # Also map unprefixed

    async def stop_servers(self) -> None:
        """Stop all MCP servers."""
        tasks = [server.stop() for server in self._servers.values()]
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)

    def get_all_tools(self) -> list[MCPTool]:
        """Get all tools from all MCP servers."""
        tools = []
        for server in self._servers.values():
            tools.extend(server.get_tools())
        return tools

    def get_tools_for_provider(self, provider_type: str) -> list[dict]:
        """
        Get tools formatted for a specific provider.

        Args:
            provider_type: 'gemini' or 'openai'

        Returns:
            List of tools in provider-specific format
        """
        tools = self.get_all_tools()

        if provider_type == "gemini":
            return self._format_tools_for_gemini(tools)
        elif provider_type == "openai":
            return self._format_tools_for_openai(tools)
        else:
            return [self._tool_to_unified_format(t) for t in tools]

    def _format_tools_for_gemini(self, tools: list[MCPTool]) -> list[dict]:
        """Format tools for Gemini API."""
        return [{
            "function_declarations": [{
                "name": f"mcp__{t.server_name}__{t.name}",
                "description": t.description,
                "parameters": t.input_schema,
            } for t in tools]
        }]

    def _format_tools_for_openai(self, tools: list[MCPTool]) -> list[dict]:
        """Format tools for OpenAI API."""
        return [{
            "type": "function",
            "function": {
                "name": f"mcp__{t.server_name}__{t.name}",
                "description": t.description,
                "parameters": t.input_schema,
            },
        } for t in tools]

    def _tool_to_unified_format(self, tool: MCPTool) -> dict:
        """Convert MCPTool to unified format."""
        return {
            "name": f"mcp__{tool.server_name}__{tool.name}",
            "description": tool.description,
            "input_schema": tool.input_schema,
        }

    @property
    def tool_names(self) -> set[str]:
        """Get all available tool names."""
        return set(self._tool_to_server.keys())

    def has_tool(self, tool_name: str) -> bool:
        """Check if a tool is available."""
        return tool_name in self._tool_to_server

    async def call_tool(self, tool_name: str, arguments: dict) -> MCPToolResult:
        """
        Execute a tool call on the appropriate MCP server.

        Args:
            tool_name: Tool name (can be prefixed or unprefixed)
            arguments: Tool arguments

        Returns:
            MCPToolResult with execution result
        """
        # Find the server for this tool
        server_name = self._tool_to_server.get(tool_name)
        if not server_name:
            return MCPToolResult(
                success=False,
                content=None,
                error=f"Unknown tool: {tool_name}",
            )

        server = self._servers.get(server_name)
        if not server or not server.is_running:
            return MCPToolResult(
                success=False,
                content=None,
                error=f"MCP server {server_name} is not running",
            )

        # Extract actual tool name (remove prefix if present)
        actual_name = tool_name
        if tool_name.startswith(f"mcp__{server_name}__"):
            actual_name = tool_name[len(f"mcp__{server_name}__"):]

        return await server.call_tool(actual_name, arguments)


class MCPBridgeProvider:
    """
    Mixin for providers that need MCP bridge support.

    Add this to Gemini/OpenAI SDK clients to enable MCP tool support.
    """

    _mcp_bridge: Optional[MCPBridge] = None

    async def init_mcp_bridge(self, mcp_servers: dict[str, dict]) -> None:
        """Initialize MCP bridge with server configurations."""
        if not mcp_servers:
            return

        self._mcp_bridge = MCPBridge(mcp_servers)
        await self._mcp_bridge.start_servers()

    async def cleanup_mcp_bridge(self) -> None:
        """Cleanup MCP bridge resources."""
        if self._mcp_bridge:
            await self._mcp_bridge.stop_servers()
            self._mcp_bridge = None

    def get_mcp_tools(self, provider_type: str) -> list[dict]:
        """Get MCP tools formatted for this provider."""
        if not self._mcp_bridge:
            return []
        return self._mcp_bridge.get_tools_for_provider(provider_type)

    async def handle_tool_call(self, tool_name: str, arguments: dict) -> Any:
        """
        Handle a tool call, routing to MCP if needed.

        Args:
            tool_name: Name of the tool to call
            arguments: Tool arguments

        Returns:
            Tool execution result
        """
        if self._mcp_bridge and self._mcp_bridge.has_tool(tool_name):
            result = await self._mcp_bridge.call_tool(tool_name, arguments)
            if result.success:
                return result.content
            else:
                raise RuntimeError(result.error)

        # Not an MCP tool - let subclass handle
        raise NotImplementedError(f"Tool {tool_name} not handled by MCP bridge")
