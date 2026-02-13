"""Tests for --provider CLI flag parsing."""

import sys

import pytest

from cli.main import parse_args


def test_parse_args_accepts_provider_flag(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["run.py", "--spec", "001-test", "--provider", "codex"],
    )
    args = parse_args()
    assert args.provider == "codex"


def test_parse_args_provider_default_none(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(sys, "argv", ["run.py", "--spec", "001-test"])
    args = parse_args()
    assert args.provider is None


def test_parse_args_rejects_invalid_provider(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(
        sys,
        "argv",
        ["run.py", "--spec", "001-test", "--provider", "invalid"],
    )
    with pytest.raises(SystemExit):
        parse_args()
