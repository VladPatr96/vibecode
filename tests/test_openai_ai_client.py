"""Tests for OpenAI/Codex AI Client wrapper."""

from core.ai_clients.base import AIClientConfig, BaseAIClient
from core.ai_clients.openai_client import OpenAIClient


def test_openai_client_instantiation():
    config = AIClientConfig(model="gpt-4o", provider_type="openai")
    client = OpenAIClient(config=config)
    assert client.provider_type == "openai"
    assert client.model == "gpt-4o"


def test_codex_client_instantiation():
    config = AIClientConfig(model="o3", provider_type="codex")
    client = OpenAIClient(config=config)
    assert client.provider_type == "codex"


def test_openai_client_is_base_ai_client():
    config = AIClientConfig(model="gpt-4o", provider_type="openai")
    client = OpenAIClient(config=config)
    assert isinstance(client, BaseAIClient)


def test_openai_supported_models():
    assert "gpt-4o" in OpenAIClient.SUPPORTED_MODELS
    assert "o3" in OpenAIClient.SUPPORTED_MODELS
    assert "gpt-4.1" in OpenAIClient.SUPPORTED_MODELS
