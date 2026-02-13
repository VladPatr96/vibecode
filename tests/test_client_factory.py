"""Tests for create_client provider factory routing."""

import inspect
from pathlib import Path
from unittest.mock import MagicMock, patch

from core.client import create_client


def test_create_client_accepts_provider_type():
    sig = inspect.signature(create_client)
    assert "provider_type" in sig.parameters


def test_create_client_default_is_claude():
    sig = inspect.signature(create_client)
    assert sig.parameters["provider_type"].default == "claude"


def test_create_client_routes_non_claude_to_factory(tmp_path: Path):
    mock_client = MagicMock()

    with patch("core.client.configure_sdk_authentication") as mock_auth, patch(
        "core.ai_clients.create_provider_client", return_value=mock_client
    ) as mock_factory:
        client = create_client(
            project_dir=tmp_path,
            spec_dir=tmp_path,
            model="gemini-2.0-flash",
            provider_type="gemini",
        )

    assert client is mock_client
    mock_auth.assert_not_called()
    mock_factory.assert_called_once()
