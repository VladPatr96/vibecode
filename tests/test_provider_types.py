"""Tests for provider type definitions."""

from core.providers.types import ProviderType


def test_provider_type_has_five_values():
    assert len(ProviderType) == 5


def test_provider_type_codex_exists():
    assert ProviderType.CODEX.value == "codex"


def test_provider_type_opencode_exists():
    assert ProviderType.OPENCODE.value == "opencode"


def test_provider_type_string_values():
    assert ProviderType.CLAUDE.value == "claude"
    assert ProviderType.GEMINI.value == "gemini"
    assert ProviderType.OPENAI.value == "openai"
    assert ProviderType.CODEX.value == "codex"
    assert ProviderType.OPENCODE.value == "opencode"
