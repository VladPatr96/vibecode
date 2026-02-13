from pathlib import Path

from context.cross_provider_context import (
    LINEAGE_FILE,
    build_handoff_prompt,
    create_phase_handoff,
    load_context_lineage,
    save_context_lineage,
)


def test_create_phase_handoff_defaults():
    handoff = create_phase_handoff(
        source_phase="planning",
        source_provider="gemini",
        target_phase="coding",
        target_provider="claude",
    )
    assert handoff.source_phase == "planning"
    assert handoff.target_provider == "claude"
    assert handoff.summary


def test_build_handoff_prompt_includes_core_fields():
    handoff = create_phase_handoff(
        source_phase="planning",
        source_provider="gemini",
        target_phase="coding",
        target_provider="claude",
        artifacts=["implementation_plan.json", "requirements.json"],
        summary="Architecture and constraints are finalized.",
        context_files=[Path("specs/001/implementation_plan.json")],
    )

    prompt = build_handoff_prompt(handoff)
    assert "Previous phase completed by gemini" in prompt
    assert "Transitioning to claude for coding" in prompt
    assert "implementation_plan.json" in prompt


def test_save_and_load_context_lineage(tmp_path: Path):
    spec_dir = tmp_path / "spec-001"
    handoff = create_phase_handoff(
        source_phase="coding",
        source_provider="claude",
        target_phase="qa_review",
        target_provider="codex",
        artifacts=["diff.patch"],
        summary="Implementation done; ready for QA.",
        context_files=[spec_dir / "diff.patch"],
    )

    lineage_path = save_context_lineage(spec_dir, handoff)
    assert lineage_path.name == LINEAGE_FILE
    assert lineage_path.exists()

    loaded = load_context_lineage(spec_dir)
    assert len(loaded) == 1
    assert loaded[0].source_provider == "claude"
    assert loaded[0].target_provider == "codex"
    assert loaded[0].artifacts == ["diff.patch"]
