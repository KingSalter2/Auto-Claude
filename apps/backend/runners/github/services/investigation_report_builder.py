"""
Investigation Report Builder
==============================

Transforms an InvestigationReport into formatted output:
- build_github_comment(): Branded markdown for posting to GitHub issues
- build_summary(): One-paragraph summary for list display
"""

from __future__ import annotations

from datetime import datetime, timezone

try:
    from .investigation_models import InvestigationReport
except (ImportError, ValueError, SystemError):
    from investigation_models import InvestigationReport


def build_github_comment(report: InvestigationReport) -> str:
    """Produce branded markdown for a GitHub issue comment.

    Args:
        report: The investigation report to format

    Returns:
        Markdown string suitable for posting as a GitHub comment
    """
    lines: list[str] = []

    # Header
    lines.append("## Auto-Claude Investigation")
    lines.append("")
    confidence = report.root_cause.confidence
    lines.append(f"**Severity:** {report.severity} | **Confidence:** {confidence}")
    lines.append("")

    # Summary
    lines.append("### Summary")
    lines.append(report.ai_summary)
    lines.append("")

    # Already-resolved warning
    if report.likely_resolved:
        lines.append(
            "> **Note:** Evidence suggests this issue may have already been resolved."
        )
        lines.append("")

    # Root Cause Analysis (collapsible)
    lines.append("<details>")
    lines.append("<summary>Root Cause Analysis</summary>")
    lines.append("")
    lines.append(f"**Root Cause:** {report.root_cause.identified_root_cause}")
    lines.append("")

    if report.root_cause.code_paths:
        lines.append("**Code Paths:**")
        lines.append("")
        lines.append("| File | Lines | Description |")
        lines.append("|------|-------|-------------|")
        for cp in report.root_cause.code_paths:
            end = cp.end_line if cp.end_line else cp.start_line
            lines.append(f"| `{cp.file}` | {cp.start_line}-{end} | {cp.description} |")
        lines.append("")

    lines.append(f"**Evidence:** {report.root_cause.evidence}")
    lines.append("")
    lines.append("</details>")
    lines.append("")

    # Impact Assessment (collapsible)
    lines.append("<details>")
    lines.append("<summary>Impact Assessment</summary>")
    lines.append("")
    lines.append(f"**Severity:** {report.impact.severity}")
    lines.append(f"**Blast Radius:** {report.impact.blast_radius}")
    lines.append(f"**User Impact:** {report.impact.user_impact}")
    lines.append(f"**Regression Risk:** {report.impact.regression_risk}")
    lines.append("")

    if report.impact.affected_components:
        lines.append("**Affected Components:**")
        lines.append("")
        lines.append("| Component | File | Type | Description |")
        lines.append("|-----------|------|------|-------------|")
        for ac in report.impact.affected_components:
            lines.append(
                f"| {ac.component} | `{ac.file}` | {ac.impact_type} | {ac.description} |"
            )
        lines.append("")

    lines.append("</details>")
    lines.append("")

    # Fix Recommendations (collapsible)
    lines.append("<details>")
    lines.append("<summary>Fix Recommendations</summary>")
    lines.append("")

    for i, approach in enumerate(report.fix_advice.approaches):
        recommended = (
            " **(recommended)**" if i == report.fix_advice.recommended_approach else ""
        )
        lines.append(f"**Approach {i + 1}:** {approach.description}{recommended}")
        lines.append(f"- Complexity: {approach.complexity}")
        if approach.pros:
            lines.append(f"- Pros: {', '.join(approach.pros)}")
        if approach.cons:
            lines.append(f"- Cons: {', '.join(approach.cons)}")
        lines.append("")

    if report.fix_advice.files_to_modify:
        lines.append(
            "**Files to Modify:** "
            + ", ".join(f"`{f}`" for f in report.fix_advice.files_to_modify)
        )
        lines.append("")

    if report.fix_advice.gotchas:
        lines.append("**Gotchas:**")
        for gotcha in report.fix_advice.gotchas:
            lines.append(f"- {gotcha}")
        lines.append("")

    lines.append("</details>")
    lines.append("")

    # Reproduction & Testing (collapsible)
    lines.append("<details>")
    lines.append("<summary>Reproduction & Testing</summary>")
    lines.append("")
    lines.append(f"**Reproducible:** {report.reproduction.reproducible}")
    lines.append("")

    if report.reproduction.reproduction_steps:
        lines.append("**Steps:**")
        for j, step in enumerate(report.reproduction.reproduction_steps, 1):
            lines.append(f"{j}. {step}")
        lines.append("")

    lines.append(
        f"**Test Coverage:** {report.reproduction.test_coverage.coverage_assessment}"
    )
    lines.append(
        f"**Suggested Test Approach:** {report.reproduction.suggested_test_approach}"
    )
    lines.append("")
    lines.append("</details>")
    lines.append("")

    # Suggested Labels
    if report.suggested_labels:
        lines.append("### Suggested Labels")
        for label in report.suggested_labels:
            lines.append(f"- `{label.name}` - {label.reason}")
        lines.append("")

    # Footer
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines.append("---")
    lines.append(
        f"*Generated by [Auto-Claude](https://github.com/AndyMik90/Auto-Claude) "
        f"* {timestamp}*"
    )

    return "\n".join(lines)


def build_summary(report: InvestigationReport) -> str:
    """Build a one-paragraph summary for list display (max ~200 chars).

    Args:
        report: The investigation report to summarize

    Returns:
        A short summary string
    """
    severity = report.severity.upper()
    confidence = report.root_cause.confidence
    cause = report.root_cause.identified_root_cause

    summary = f"[{severity}] {cause}"

    # Add resolution note if relevant
    if report.likely_resolved:
        summary += " (likely resolved)"

    # Add confidence
    summary += f" [{confidence} confidence]"

    # Truncate to ~200 chars
    if len(summary) > 200:
        summary = summary[:197] + "..."

    return summary
