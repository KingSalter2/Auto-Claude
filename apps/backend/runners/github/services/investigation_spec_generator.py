"""
Investigation Spec Generator
==============================

Template-based spec generation from investigation reports.
NO AI cost - uses string templates to transform investigation data
into spec.md and requirements.json for the build pipeline.

Usage:
    spec_path = generate_spec_from_investigation(
        project_dir=Path("/project"),
        issue_number=42,
        spec_id="042-fix-login-bug",
    )
"""

from __future__ import annotations

import json
import logging
import shutil
from pathlib import Path

try:
    from ...core.file_utils import write_json_atomic
except (ImportError, ValueError, SystemError):
    from core.file_utils import write_json_atomic

from .investigation_models import InvestigationReport
from .investigation_persistence import load_investigation_report

logger = logging.getLogger(__name__)


def generate_spec_from_investigation(
    project_dir: Path,
    issue_number: int,
    spec_id: str,
) -> Path:
    """Generate a spec directory from an investigation report.

    This is a template-based transformation (no AI cost). It reads
    the investigation report and produces:
    - spec.md: Markdown spec from the AI summary, root cause, and fix advice
    - requirements.json: Requirements derived from fix approaches
    - investigation_report.json: Copy of the original report for reference

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number
        spec_id: Spec identifier (e.g., '042-fix-login-bug')

    Returns:
        Path to the created spec directory

    Raises:
        FileNotFoundError: If no investigation report exists for the issue
    """
    # Load investigation report
    report = load_investigation_report(project_dir, issue_number)
    if report is None:
        raise FileNotFoundError(
            f"No investigation report found for issue #{issue_number}. "
            "Run investigation first."
        )

    # Create spec directory
    spec_dir = project_dir / ".auto-claude" / "specs" / spec_id
    spec_dir.mkdir(parents=True, exist_ok=True)

    # Generate spec.md
    spec_md = _build_spec_md(report)
    (spec_dir / "spec.md").write_text(spec_md, encoding="utf-8")

    # Generate requirements.json
    requirements = _build_requirements(report)
    write_json_atomic(spec_dir / "requirements.json", requirements)

    # Copy investigation report for reference
    report_data = report.model_dump(mode="json")
    write_json_atomic(spec_dir / "investigation_report.json", report_data)

    logger.info(
        f"Generated spec '{spec_id}' from investigation of issue #{issue_number}"
    )
    return spec_dir


def _build_spec_md(report: InvestigationReport) -> str:
    """Build spec.md content from investigation report.

    Args:
        report: The investigation report

    Returns:
        Markdown string for spec.md
    """
    lines: list[str] = []

    # Title
    lines.append(f"# Fix: {report.issue_title}")
    lines.append("")
    lines.append(f"> Generated from investigation of GitHub issue #{report.issue_number}")
    lines.append("")

    # Summary
    lines.append("## Summary")
    lines.append("")
    lines.append(report.ai_summary)
    lines.append("")

    # Root Cause
    lines.append("## Root Cause")
    lines.append("")
    lines.append(report.root_cause.identified_root_cause)
    lines.append("")

    if report.root_cause.code_paths:
        lines.append("### Affected Code Paths")
        lines.append("")
        for cp in report.root_cause.code_paths:
            end = cp.end_line if cp.end_line else cp.start_line
            lines.append(f"- `{cp.file}:{cp.start_line}-{end}` - {cp.description}")
        lines.append("")

    # Fix Approach
    lines.append("## Implementation Plan")
    lines.append("")

    if report.fix_advice.approaches:
        rec_idx = report.fix_advice.recommended_approach
        if 0 <= rec_idx < len(report.fix_advice.approaches):
            approach = report.fix_advice.approaches[rec_idx]
            lines.append(f"**Recommended approach:** {approach.description}")
            lines.append(f"- Complexity: {approach.complexity}")
            lines.append("")

            if approach.files_affected:
                lines.append("**Files to modify:**")
                for f in approach.files_affected:
                    lines.append(f"- `{f}`")
                lines.append("")

    # Patterns to follow
    if report.fix_advice.patterns_to_follow:
        lines.append("### Patterns to Follow")
        lines.append("")
        for pat in report.fix_advice.patterns_to_follow:
            lines.append(f"- `{pat.file}`: {pat.description}")
        lines.append("")

    # Gotchas
    if report.fix_advice.gotchas:
        lines.append("### Gotchas")
        lines.append("")
        for gotcha in report.fix_advice.gotchas:
            lines.append(f"- {gotcha}")
        lines.append("")

    # Testing
    lines.append("## Testing")
    lines.append("")
    lines.append(f"**Suggested approach:** {report.reproduction.suggested_test_approach}")
    lines.append("")

    if report.reproduction.test_coverage.test_files:
        lines.append("**Existing test files:**")
        for tf in report.reproduction.test_coverage.test_files:
            lines.append(f"- `{tf}`")
        lines.append("")

    # Impact
    lines.append("## Impact")
    lines.append("")
    lines.append(f"- **Severity:** {report.impact.severity}")
    lines.append(f"- **Blast radius:** {report.impact.blast_radius}")
    lines.append(f"- **User impact:** {report.impact.user_impact}")
    lines.append(f"- **Regression risk:** {report.impact.regression_risk}")
    lines.append("")

    return "\n".join(lines)


def _build_requirements(report: InvestigationReport) -> dict:
    """Build requirements.json from investigation report.

    Args:
        report: The investigation report

    Returns:
        Dict structure for requirements.json
    """
    requirements: list[dict] = []

    # Generate requirements from fix approaches
    for i, approach in enumerate(report.fix_advice.approaches):
        is_recommended = i == report.fix_advice.recommended_approach
        req = {
            "id": f"REQ-{i + 1:03d}",
            "description": approach.description,
            "priority": "must" if is_recommended else "should",
            "complexity": approach.complexity,
            "files": approach.files_affected,
        }
        requirements.append(req)

    # Add testing requirement
    requirements.append({
        "id": f"REQ-{len(requirements) + 1:03d}",
        "description": f"Add tests: {report.reproduction.suggested_test_approach}",
        "priority": "must",
        "complexity": "moderate",
        "files": report.reproduction.related_test_files,
    })

    return {
        "issue_number": report.issue_number,
        "issue_title": report.issue_title,
        "severity": report.severity,
        "requirements": requirements,
    }
