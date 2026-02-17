"""
Investigation context loading for agents.

Provides utilities to load investigation data from spec directories
for GitHub-sourced tasks.
"""

import json
from pathlib import Path
from typing import Any


def load_investigation_context(spec_dir: Path) -> dict[str, Any] | None:
    """
    Load investigation context if this spec was created from a GitHub issue.

    Args:
        spec_dir: Path to the spec directory

    Returns:
        Structured investigation context with root_cause, fix_approaches,
        reproducer, gotchas, and patterns_to_follow, or None if no
        investigation data exists.
    """
    investigation_report_path = spec_dir / "investigation_report.json"

    if not investigation_report_path.exists():
        return None

    try:
        with open(investigation_report_path) as f:
            report = json.load(f)

        root_cause = report.get("root_cause", {})
        fix_advice = report.get("fix_advice", {})
        reproduction = report.get("reproduction", {})

        # Structure the context for agents
        return {
            "root_cause": {
                "summary": root_cause.get("identified_root_cause"),
                "evidence": root_cause.get("evidence", ""),
                "code_paths": root_cause.get("code_paths", []),
            },
            "fix_approaches": fix_advice.get("approaches", []),
            "reproducer": reproduction if reproduction else None,
            "gotchas": fix_advice.get("gotchas", []),
            "patterns_to_follow": fix_advice.get("patterns_to_follow", []),
            "impact": report.get("impact", {}),
        }
    except (json.JSONDecodeError, OSError):
        return None


def load_investigation_for_qa(
    spec_dir: Path, base_branch: str
) -> dict[str, Any] | None:
    """
    Load investigation context for QA validation.

    Similar to load_investigation_context but includes base_branch
    for QA comparison.

    Args:
        spec_dir: Path to the spec directory
        base_branch: Base branch to compare against (e.g., 'main', 'develop')

    Returns:
        Structured investigation context with root_cause, reproducer,
        impact, expected_outcome, and base_branch, or None if no
        investigation data exists.
    """
    investigation_report_path = spec_dir / "investigation_report.json"

    if not investigation_report_path.exists():
        return None

    try:
        with open(investigation_report_path) as f:
            report = json.load(f)

        root_cause = report.get("root_cause", {})
        reproduction = report.get("reproduction", {})

        return {
            "root_cause": {
                "summary": root_cause.get("identified_root_cause"),
                "evidence": root_cause.get("evidence", ""),
                "code_paths": root_cause.get("code_paths", []),
            },
            "reproducer": reproduction if reproduction else None,
            "impact": report.get("impact", {}),
            "expected_outcome": report.get("ai_summary"),
            "base_branch": base_branch,
        }
    except (json.JSONDecodeError, OSError):
        return None
