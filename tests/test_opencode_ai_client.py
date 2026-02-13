"""Tests for OpenCode AI Client wrapper."""

from core.ai_clients.base import AIClientConfig, BaseAIClient
from core.ai_clients.opencode_client import OpenCodeAIClient


def test_opencode_client_instantiation():
    config = AIClientConfig(model="deepseek-v3", provider_type="opencode")
    client = OpenCodeAIClient(config=config)
    assert client.provider_type == "opencode"
    assert client.model == "deepseek-v3"


def test_opencode_client_is_base_ai_client():
    config = AIClientConfig(model="deepseek-v3", provider_type="opencode")
    client = OpenCodeAIClient(config=config)
    assert isinstance(client, BaseAIClient)


def test_opencode_supported_models():
    assert "deepseek-v3" in OpenCodeAIClient.SUPPORTED_MODELS
    assert "deepseek-coder" in OpenCodeAIClient.SUPPORTED_MODELS
    assert "claude-sonnet-4" in OpenCodeAIClient.SUPPORTED_MODELS
