"""Tests for multi-provider support."""

import pytest
from core.providers import (
    ProviderType,
    ProviderProfile,
    ProviderRegistry,
    ClaudeCLIProvider,
    GeminiCLIProvider,
    OpenAICLIProvider,
)


class TestProviderTypes:
    """Test provider type definitions."""

    def test_provider_types_exist(self):
        assert ProviderType.CLAUDE.value == "claude"
        assert ProviderType.GEMINI.value == "gemini"
        assert ProviderType.OPENAI.value == "openai"

    def test_provider_profile_creation(self):
        profile = ProviderProfile(
            id="test-profile",
            name="Test Profile",
            provider_type=ProviderType.CLAUDE,
            model="claude-sonnet-4-20250514",
        )
        assert profile.id == "test-profile"
        assert profile.provider_type == ProviderType.CLAUDE


class TestProviderRegistry:
    """Test provider registry."""

    def setup_method(self):
        ProviderRegistry.clear_all()

    def test_list_available_providers(self):
        available = ProviderRegistry.list_available()
        assert ProviderType.CLAUDE in available
        assert ProviderType.GEMINI in available
        assert ProviderType.OPENAI in available

    def test_get_factory(self):
        factory = ProviderRegistry.get_factory(ProviderType.CLAUDE)
        assert factory is not None

    @pytest.mark.asyncio
    async def test_create_for_terminal(self):
        profile = ProviderProfile(
            id="test",
            name="Test",
            provider_type=ProviderType.CLAUDE,
            model="claude-sonnet-4-20250514",
        )
        provider = await ProviderRegistry.create_for_terminal(
            "terminal-1",
            ProviderType.CLAUDE,
            profile,
        )
        assert provider is not None
        assert provider.provider_type == ProviderType.CLAUDE


class TestClaudeProvider:
    """Test Claude CLI provider."""

    def test_create(self):
        profile = ProviderProfile(
            id="test",
            name="Test",
            provider_type=ProviderType.CLAUDE,
            model="claude-sonnet-4-20250514",
        )
        provider = ClaudeCLIProvider.create(profile)
        assert provider.provider_type == ProviderType.CLAUDE

    @pytest.mark.asyncio
    async def test_get_cli_command(self):
        profile = ProviderProfile(
            id="test",
            name="Test",
            provider_type=ProviderType.CLAUDE,
            model="claude-sonnet-4-20250514",
        )
        provider = ClaudeCLIProvider.create(profile)
        await provider.initialize(profile)

        cmd = provider.get_cli_command()
        assert "claude" in cmd
        assert "--model" in cmd


class TestGeminiProvider:
    """Test Gemini CLI provider."""

    @pytest.mark.asyncio
    async def test_get_cli_command(self):
        profile = ProviderProfile(
            id="test",
            name="Test",
            provider_type=ProviderType.GEMINI,
            model="gemini-2.0-flash",
        )
        provider = GeminiCLIProvider.create(profile)
        await provider.initialize(profile)

        cmd = provider.get_cli_command()
        assert "gemini" in cmd


class TestOpenAIProvider:
    """Test OpenAI CLI provider."""

    @pytest.mark.asyncio
    async def test_get_cli_command(self):
        profile = ProviderProfile(
            id="test",
            name="Test",
            provider_type=ProviderType.OPENAI,
            model="gpt-4o",
        )
        provider = OpenAICLIProvider.create(profile)
        await provider.initialize(profile)

        cmd = provider.get_cli_command()
        assert "codex" in cmd
