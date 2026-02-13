"""Tests for smart routing task analyzer."""

from routing.task_analyzer import TaskAnalyzer, analyze_task_routing


def test_large_context_prefers_gemini_for_planning():
    analyzer = TaskAnalyzer()
    spec = "A" * 12000
    result = analyzer.analyze(spec)

    assert result.planning.provider_type == "gemini"


def test_typescript_heavy_prefers_claude_for_coding():
    analyzer = TaskAnalyzer()
    spec = "TypeScript project with tsconfig and React .tsx pages"
    result = analyzer.analyze(spec)

    assert result.coding.provider_type == "claude"


def test_small_quick_task_prefers_codex_for_qa():
    analyzer = TaskAnalyzer()
    spec = "small change: quick fix in one file"
    result = analyzer.analyze(spec)

    assert result.qa.provider_type == "codex"


def test_user_defaults_override_heuristics():
    analyzer = TaskAnalyzer()
    spec = "A" * 12000
    result = analyzer.analyze(
        spec,
        user_defaults={"planning": "claude", "coding": "opencode", "qa": "gemini"},
    )

    assert result.planning.provider_type == "claude"
    assert result.coding.provider_type == "opencode"
    assert result.qa.provider_type == "gemini"


def test_rate_limited_provider_is_skipped():
    analyzer = TaskAnalyzer()
    spec = "TypeScript project with tsconfig and React .tsx pages"
    result = analyzer.analyze(spec, rate_limited_providers={"claude"})

    assert result.coding.provider_type != "claude"


def test_analyze_task_routing_wrapper():
    result = analyze_task_routing("quick fix for button alignment")
    assert result.coding.provider_type in {"claude", "codex"}

