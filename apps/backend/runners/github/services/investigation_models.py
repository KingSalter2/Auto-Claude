"""
Investigation Pydantic Models
==============================

Structured output models for the AI issue investigation system.

Each specialist agent (root cause, impact, fix advisor, reproducer) returns
a structured response validated against these schemas. The combined results
form an InvestigationReport.

Usage with Claude Agent SDK structured output:
    from .investigation_models import RootCauseResponse

    client = create_client(
        ...,
        output_format={
            "type": "json_schema",
            "schema": RootCauseResponse.model_json_schema(),
        },
    )
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


# =============================================================================
# Shared Sub-Models
# =============================================================================


class CodeReference(BaseModel):
    """A reference to a specific location in the codebase."""

    file: str = Field(description="File path relative to project root")
    line: int = Field(0, description="Line number (0 if unknown)")
    end_line: int | None = Field(None, description="End line for multi-line references")
    snippet: str | None = Field(
        None, description="Relevant code snippet from this location"
    )
    explanation: str = Field(
        description="Why this code location is relevant to the analysis"
    )


class SuggestedLabel(BaseModel):
    """An AI-suggested label for the GitHub issue."""

    name: str = Field(description="Label name (e.g., 'bug', 'security', 'performance')")
    reason: str = Field(description="Why this label is appropriate for the issue")
    confidence: float = Field(
        ge=0.0, le=1.0, description="Confidence in the suggestion (0.0-1.0)"
    )


class LinkedPR(BaseModel):
    """A pull request linked to or referenced by the issue."""

    number: int = Field(description="PR number")
    title: str = Field(description="PR title")
    status: Literal["open", "closed", "merged"] = Field(description="PR status")
    relevance: str = Field(
        description="How this PR relates to the issue (fixes, partially addresses, etc.)"
    )


# =============================================================================
# Per-Specialist Response Models
# =============================================================================


class RootCauseAnalysis(BaseModel):
    """Structured output from the Root Cause Analyzer agent."""

    summary: str = Field(
        description="One-paragraph summary of the root cause"
    )
    confidence: Literal["high", "medium", "low"] = Field(
        description="Confidence in the root cause identification"
    )
    root_cause_description: str = Field(
        description="Detailed description of the root cause"
    )
    code_paths: list[CodeReference] = Field(
        default_factory=list,
        description="Code paths involved in the issue, ordered from entry point to root cause",
    )
    related_issues: list[str] = Field(
        default_factory=list,
        description="Patterns or known issue categories this matches (e.g., 'race condition', 'null reference')",
    )


class RootCauseResponse(BaseModel):
    """Full response schema for the root cause agent's SDK session."""

    specialist_name: str = Field(
        default="root_cause",
        description="Always 'root_cause' for this specialist",
    )
    analysis: RootCauseAnalysis = Field(
        description="The root cause analysis results"
    )
    files_examined: list[str] = Field(
        default_factory=list,
        description="Files that were examined during analysis",
    )


class ImpactAssessment(BaseModel):
    """Structured output from the Impact Assessor agent."""

    summary: str = Field(
        description="One-paragraph summary of the impact"
    )
    severity: Literal["critical", "high", "medium", "low"] = Field(
        description="Overall severity of the issue based on impact"
    )
    affected_components: list[str] = Field(
        default_factory=list,
        description="List of components/modules affected by this issue",
    )
    affected_code: list[CodeReference] = Field(
        default_factory=list,
        description="Code locations that would be affected if this issue is not fixed",
    )
    user_impact: str = Field(
        description="How end users are affected by this issue"
    )
    risk_if_unfixed: str = Field(
        description="What happens if this issue is not addressed"
    )


class ImpactResponse(BaseModel):
    """Full response schema for the impact agent's SDK session."""

    specialist_name: str = Field(
        default="impact",
        description="Always 'impact' for this specialist",
    )
    assessment: ImpactAssessment = Field(
        description="The impact assessment results"
    )
    files_examined: list[str] = Field(
        default_factory=list,
        description="Files that were examined during analysis",
    )


class FixApproach(BaseModel):
    """A concrete approach to fixing the issue."""

    description: str = Field(description="Description of the fix approach")
    files_to_modify: list[str] = Field(
        default_factory=list,
        description="Files that need to be modified for this fix",
    )
    complexity: Literal["trivial", "simple", "moderate", "complex"] = Field(
        description="Estimated complexity of implementing this fix"
    )
    risks: list[str] = Field(
        default_factory=list,
        description="Potential risks or gotchas with this approach",
    )
    code_references: list[CodeReference] = Field(
        default_factory=list,
        description="Existing code patterns to follow when implementing the fix",
    )


class FixAdvice(BaseModel):
    """Structured output from the Fix Advisor agent."""

    summary: str = Field(
        description="One-paragraph summary of the recommended fix"
    )
    recommended_approach: FixApproach = Field(
        description="The primary recommended fix approach"
    )
    alternative_approaches: list[FixApproach] = Field(
        default_factory=list,
        description="Alternative approaches if the primary one is not feasible",
    )
    patterns_to_follow: list[CodeReference] = Field(
        default_factory=list,
        description="Existing codebase patterns the fix should follow for consistency",
    )
    likely_already_fixed: bool = Field(
        False,
        description="True if evidence suggests this issue has already been resolved",
    )
    already_fixed_evidence: str | None = Field(
        None,
        description="Evidence that the issue is already fixed (if likely_already_fixed is True)",
    )


class FixAdviceResponse(BaseModel):
    """Full response schema for the fix advisor agent's SDK session."""

    specialist_name: str = Field(
        default="fix_advisor",
        description="Always 'fix_advisor' for this specialist",
    )
    advice: FixAdvice = Field(
        description="The fix advice results"
    )
    files_examined: list[str] = Field(
        default_factory=list,
        description="Files that were examined during analysis",
    )


class ReproductionStep(BaseModel):
    """A step to reproduce the issue."""

    step_number: int = Field(description="Step number in the reproduction sequence")
    action: str = Field(description="What to do in this step")
    expected_result: str = Field(description="What should happen")
    actual_result: str | None = Field(
        None, description="What actually happens (if known from code analysis)"
    )


class ReproductionAnalysis(BaseModel):
    """Structured output from the Reproducer agent."""

    summary: str = Field(
        description="One-paragraph summary of reproducibility assessment"
    )
    reproducible: Literal["yes", "likely", "unlikely", "unknown"] = Field(
        description="Whether the issue can be reproduced"
    )
    reproduction_steps: list[ReproductionStep] = Field(
        default_factory=list,
        description="Steps to reproduce the issue (if reproducible)",
    )
    test_coverage: str = Field(
        description="Assessment of existing test coverage for the affected code"
    )
    related_test_files: list[str] = Field(
        default_factory=list,
        description="Existing test files that cover the affected code paths",
    )
    suggested_test_approach: str | None = Field(
        None,
        description="How to write a test that verifies the fix",
    )


class ReproductionResponse(BaseModel):
    """Full response schema for the reproducer agent's SDK session."""

    specialist_name: str = Field(
        default="reproducer",
        description="Always 'reproducer' for this specialist",
    )
    analysis: ReproductionAnalysis = Field(
        description="The reproduction analysis results"
    )
    files_examined: list[str] = Field(
        default_factory=list,
        description="Files that were examined during analysis",
    )


# =============================================================================
# Combined Investigation Report
# =============================================================================


class InvestigationReport(BaseModel):
    """Combined report from all 4 specialist agents.

    This is the authoritative investigation result saved to disk and
    displayed in the UI. It aggregates all agent outputs plus metadata.
    """

    issue_number: int = Field(description="GitHub issue number")
    issue_title: str = Field(description="GitHub issue title")
    issue_url: str = Field(default="", description="GitHub issue URL")

    # Agent results (None if agent failed or was skipped)
    root_cause: RootCauseAnalysis | None = Field(
        None, description="Root cause analysis results"
    )
    impact: ImpactAssessment | None = Field(
        None, description="Impact assessment results"
    )
    fix_advice: FixAdvice | None = Field(
        None, description="Fix advice results"
    )
    reproduction: ReproductionAnalysis | None = Field(
        None, description="Reproduction analysis results"
    )

    # Overall assessment
    overall_severity: Literal["critical", "high", "medium", "low"] = Field(
        description="Overall severity computed from agent assessments"
    )
    ai_summary: str = Field(
        description="AI-generated summary combining all agent findings"
    )
    likely_already_fixed: bool = Field(
        False,
        description="True if evidence suggests the issue has already been resolved",
    )

    # Metadata
    suggested_labels: list[SuggestedLabel] = Field(
        default_factory=list,
        description="AI-suggested labels for the issue",
    )
    linked_prs: list[LinkedPR] = Field(
        default_factory=list,
        description="Pull requests linked to this issue",
    )
    agents_completed: list[str] = Field(
        default_factory=list,
        description="Names of agents that completed successfully",
    )
    agents_failed: list[str] = Field(
        default_factory=list,
        description="Names of agents that failed",
    )
    files_examined: list[str] = Field(
        default_factory=list,
        description="All files examined across all agents (deduplicated)",
    )


# =============================================================================
# Investigation State
# =============================================================================


class InvestigationState(BaseModel):
    """Persistent state for an issue investigation.

    Saved to .auto-claude/issues/{issueNumber}/investigation_state.json.
    State is primarily derived from investigation data + linked task status,
    but we persist key fields for fast lookup without scanning all files.
    """

    issue_number: int = Field(description="GitHub issue number")
    spec_id: str | None = Field(
        None, description="Pre-allocated spec ID (e.g., '042-fix-login-bug')"
    )
    status: Literal[
        "investigating",
        "findings_ready",
        "resolved",
        "failed",
        "cancelled",
        "task_created",
    ] = Field(description="Current investigation status")
    started_at: str = Field(description="ISO 8601 timestamp when investigation started")
    completed_at: str | None = Field(
        None, description="ISO 8601 timestamp when investigation completed"
    )
    error: str | None = Field(
        None, description="Error message if investigation failed"
    )
    linked_spec_id: str | None = Field(
        None, description="Spec ID of the kanban task created from this investigation"
    )
    github_comment_id: int | None = Field(
        None, description="ID of the GitHub comment posted with results"
    )
    model_used: str | None = Field(
        None, description="Model used for investigation (e.g., 'sonnet')"
    )
