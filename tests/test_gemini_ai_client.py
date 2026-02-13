"""Tests for Gemini AI Client wrapper."""

from core.ai_clients.base import AIClientConfig, BaseAIClient
from core.ai_clients.gemini_client import GeminiAIClient


def test_gemini_client_instantiation():
    config = AIClientConfig(model="gemini-2.0-flash", provider_type="gemini")
    client = GeminiAIClient(config=config)
    assert client.provider_type == "gemini"
    assert client.model == "gemini-2.0-flash"


def test_gemini_client_is_base_ai_client():
    config = AIClientConfig(model="gemini-2.0-flash", provider_type="gemini")
    client = GeminiAIClient(config=config)
    assert isinstance(client, BaseAIClient)


def test_gemini_supported_models():
    assert "gemini-2.0-flash" in GeminiAIClient.SUPPORTED_MODELS
    assert "gemini-2.5-pro" in GeminiAIClient.SUPPORTED_MODELS
