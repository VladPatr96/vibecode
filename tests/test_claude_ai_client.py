"""Tests for ClaudeAIClient wrapper."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from core.ai_clients.base import AIClientConfig, BaseAIClient
from core.ai_clients.claude_client import ClaudeAIClient


def test_claude_client_instantiation():
    config = AIClientConfig(model="claude-sonnet-4-20250514", provider_type="claude")
    client = ClaudeAIClient(config=config)
    assert client.provider_type == "claude"
    assert client.model == "claude-sonnet-4-20250514"


def test_claude_client_is_base_ai_client():
    config = AIClientConfig(model="test", provider_type="claude")
    client = ClaudeAIClient(config=config)
    assert isinstance(client, BaseAIClient)


@pytest.mark.asyncio
async def test_claude_client_context_manager():
    config = AIClientConfig(model="test", provider_type="claude")
    client = ClaudeAIClient(config=config)
    client._sdk_client = MagicMock()
    client._sdk_client.__aenter__ = AsyncMock(return_value=client._sdk_client)
    client._sdk_client.__aexit__ = AsyncMock(return_value=False)

    async with client:
        assert client._is_open is True
    assert client._is_open is False
