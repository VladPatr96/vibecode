"""Tests for AI client factory."""

import pytest

from core.ai_clients.base import BaseAIClient
from core.ai_clients.factory import create_provider_client


def test_factory_returns_gemini_client():
    client = create_provider_client(
        provider_type="gemini",
        model="gemini-2.0-flash",
        system_prompt="test",
    )
    assert isinstance(client, BaseAIClient)
    assert client.provider_type == "gemini"


def test_factory_returns_openai_client():
    client = create_provider_client(
        provider_type="openai",
        model="gpt-4o",
        system_prompt="test",
    )
    assert isinstance(client, BaseAIClient)
    assert client.provider_type == "openai"


def test_factory_returns_codex_client():
    client = create_provider_client(
        provider_type="codex",
        model="o3",
        system_prompt="test",
    )
    assert isinstance(client, BaseAIClient)
    assert client.provider_type == "codex"


def test_factory_returns_opencode_client():
    client = create_provider_client(
        provider_type="opencode",
        model="deepseek-v3",
        system_prompt="test",
    )
    assert isinstance(client, BaseAIClient)
    assert client.provider_type == "opencode"


def test_factory_raises_for_unknown_provider():
    with pytest.raises(ValueError, match="Unknown provider"):
        create_provider_client(provider_type="unknown", model="test")
