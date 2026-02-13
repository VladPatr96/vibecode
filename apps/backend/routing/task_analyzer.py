"""Heuristic task analyzer for smart provider routing."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable

from .types import ProviderRecommendation, RoutingRecommendation


_DEFAULT_MODELS: dict[str, str] = {
    "claude": "claude-sonnet-4-20250514",
    "gemini": "gemini-2.0-flash",
    "openai": "gpt-4o",
    "codex": "gpt-4o",
    "opencode": "deepseek-v3",
}

_FALLBACK_ORDER = ["claude", "gemini", "codex", "openai", "opencode"]


@dataclass
class _TaskSignals:
    is_large_context: bool
    is_typescript_heavy: bool
    is_quick_iteration: bool


class TaskAnalyzer:
    """Heuristic analyzer for selecting providers per phase."""

    LARGE_CONTEXT_THRESHOLD = 10_000

    def analyze(
        self,
        spec_content: str,
        *,
        user_defaults: dict[str, str] | None = None,
        rate_limited_providers: Iterable[str] | None = None,
    ) -> RoutingRecommendation:
        """Build a recommendation for planning/coding/qa."""

        user_defaults = user_defaults or {}
        blocked = {provider.lower() for provider in (rate_limited_providers or [])}
        signals = self._collect_signals(spec_content)

        planning_provider = self._pick_provider(
            preferred=user_defaults.get("planning")
            or ("gemini" if signals.is_large_context else "claude"),
            blocked=blocked,
            fallback="claude",
        )
        coding_provider = self._pick_provider(
            preferred=user_defaults.get("coding")
            or ("claude" if signals.is_typescript_heavy else "codex" if signals.is_quick_iteration else "claude"),
            blocked=blocked,
            fallback="claude",
        )
        qa_provider = self._pick_provider(
            preferred=user_defaults.get("qa")
            or ("codex" if signals.is_quick_iteration and not signals.is_typescript_heavy else "claude"),
            blocked=blocked,
            fallback="claude",
        )

        return RoutingRecommendation(
            planning=self._build_recommendation("planning", planning_provider, signals, user_defaults),
            coding=self._build_recommendation("coding", coding_provider, signals, user_defaults),
            qa=self._build_recommendation("qa", qa_provider, signals, user_defaults),
        )

    def _collect_signals(self, spec_content: str) -> _TaskSignals:
        text = (spec_content or "").lower()
        is_large_context = len(spec_content or "") > self.LARGE_CONTEXT_THRESHOLD
        ts_markers = ("typescript", "tsconfig", ".tsx", ".ts", "react", "next.js", "node")
        quick_markers = ("quick fix", "small change", "minor tweak", "hotfix", "polish")
        is_typescript_heavy = sum(marker in text for marker in ts_markers) >= 2
        is_quick_iteration = len(spec_content or "") < 2000 or any(marker in text for marker in quick_markers)
        return _TaskSignals(
            is_large_context=is_large_context,
            is_typescript_heavy=is_typescript_heavy,
            is_quick_iteration=is_quick_iteration,
        )

    def _pick_provider(self, *, preferred: str | None, blocked: set[str], fallback: str) -> str:
        preferred = (preferred or fallback).lower()
        if preferred not in blocked:
            return preferred

        for provider in _FALLBACK_ORDER:
            if provider not in blocked:
                return provider
        return fallback

    def _build_recommendation(
        self,
        phase: str,
        provider_type: str,
        signals: _TaskSignals,
        user_defaults: dict[str, str],
    ) -> ProviderRecommendation:
        if user_defaults.get(phase):
            reason = "Using user default provider preference."
            confidence = 0.95
        elif phase == "planning" and signals.is_large_context:
            reason = "Large context task detected, favoring Gemini context window."
            confidence = 0.86
        elif phase == "coding" and signals.is_typescript_heavy:
            reason = "TypeScript-heavy task detected, favoring Claude for agentic coding."
            confidence = 0.88
        elif signals.is_quick_iteration:
            reason = "Quick-iteration task detected, favoring faster/cheaper execution."
            confidence = 0.81
        else:
            reason = "Balanced default routing."
            confidence = 0.74

        return ProviderRecommendation(
            provider_type=provider_type,
            model=_DEFAULT_MODELS.get(provider_type, _DEFAULT_MODELS["claude"]),
            reason=reason,
            confidence=confidence,
        )


def analyze_task_routing(
    spec_content: str,
    *,
    user_defaults: dict[str, str] | None = None,
    rate_limited_providers: Iterable[str] | None = None,
) -> RoutingRecommendation:
    """Convenience wrapper for routing analysis."""

    return TaskAnalyzer().analyze(
        spec_content,
        user_defaults=user_defaults,
        rate_limited_providers=rate_limited_providers,
    )

