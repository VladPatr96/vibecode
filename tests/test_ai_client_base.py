"""Tests for BaseAIClient abstractions."""

import pytest

from core.ai_clients.base import AIClientConfig, BaseAIClient


def test_ai_client_config_creation():
    config = AIClientConfig(
        model="claude-sonnet-4-20250514",
        provider_type="claude",
        max_thinking_tokens=5000,
    )
    assert config.model == "claude-sonnet-4-20250514"
    assert config.provider_type == "claude"
    assert config.max_thinking_tokens == 5000
    assert config.temperature == 1.0


def test_ai_client_config_defaults():
    config = AIClientConfig(model="gemini-2.0-flash", provider_type="gemini")
    assert config.max_thinking_tokens is None
    assert config.temperature == 1.0
    assert config.max_tokens is None


def test_cannot_instantiate_base_client():
    with pytest.raises(TypeError):
        BaseAIClient(config=AIClientConfig(model="test", provider_type="claude"))


def test_base_client_requires_all_abstract_methods():
    class IncompleteClient(BaseAIClient):
        pass

    with pytest.raises(TypeError):
        IncompleteClient(config=AIClientConfig(model="test", provider_type="claude"))
