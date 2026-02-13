"""Cross-provider phase handoff utilities."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Iterable


LINEAGE_FILE = "provider-context-lineage.json"


@dataclass
class PhaseHandoff:
    source_phase: str
    source_provider: str
    target_phase: str
    target_provider: str
    artifacts: list[str]
    summary: str
    context_files: list[Path]


def _normalize_artifacts(artifacts: Iterable[str]) -> list[str]:
    return [artifact.strip() for artifact in artifacts if artifact and artifact.strip()]


def build_handoff_prompt(handoff: PhaseHandoff) -> str:
    artifacts_text = ", ".join(handoff.artifacts) if handoff.artifacts else "none"
    files_text = ", ".join(str(path) for path in handoff.context_files) if handoff.context_files else "none"
    return (
        f"Previous phase completed by {handoff.source_provider} ({handoff.source_phase}).\n"
        f"Transitioning to {handoff.target_provider} for {handoff.target_phase}.\n"
        f"Key outputs: {handoff.summary}\n"
        f"Artifacts: {artifacts_text}\n"
        f"Context files: {files_text}"
    )


def create_phase_handoff(
    *,
    source_phase: str,
    source_provider: str,
    target_phase: str,
    target_provider: str,
    artifacts: Iterable[str] | None = None,
    summary: str = "",
    context_files: Iterable[Path] | None = None,
) -> PhaseHandoff:
    normalized_artifacts = _normalize_artifacts(artifacts or [])
    normalized_files = [Path(path) for path in (context_files or [])]
    effective_summary = summary.strip() or (
        f"{source_phase} outputs prepared for {target_phase}."
    )

    return PhaseHandoff(
        source_phase=source_phase,
        source_provider=source_provider,
        target_phase=target_phase,
        target_provider=target_provider,
        artifacts=normalized_artifacts,
        summary=effective_summary,
        context_files=normalized_files,
    )


def save_context_lineage(spec_dir: Path, handoff: PhaseHandoff) -> Path:
    spec_dir.mkdir(parents=True, exist_ok=True)
    lineage_path = spec_dir / LINEAGE_FILE

    if lineage_path.exists():
        try:
            lineage = json.loads(lineage_path.read_text(encoding="utf-8"))
            if not isinstance(lineage, list):
                lineage = []
        except json.JSONDecodeError:
            lineage = []
    else:
        lineage = []

    handoff_record = asdict(handoff)
    handoff_record["context_files"] = [str(path) for path in handoff.context_files]
    lineage.append(handoff_record)
    lineage_path.write_text(json.dumps(lineage, indent=2), encoding="utf-8")
    return lineage_path


def load_context_lineage(spec_dir: Path) -> list[PhaseHandoff]:
    lineage_path = spec_dir / LINEAGE_FILE
    if not lineage_path.exists():
        return []

    try:
        raw = json.loads(lineage_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return []

    handoffs: list[PhaseHandoff] = []
    for item in raw if isinstance(raw, list) else []:
        try:
            handoffs.append(
                PhaseHandoff(
                    source_phase=item["source_phase"],
                    source_provider=item["source_provider"],
                    target_phase=item["target_phase"],
                    target_provider=item["target_provider"],
                    artifacts=_normalize_artifacts(item.get("artifacts", [])),
                    summary=item.get("summary", ""),
                    context_files=[Path(path) for path in item.get("context_files", [])],
                )
            )
        except KeyError:
            continue
    return handoffs
