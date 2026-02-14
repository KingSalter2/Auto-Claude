"""
Issue Investigation Orchestrator
==================================

Runs 4 specialist agents in two phases to investigate a GitHub issue:

Phase 1 (parallel): root_cause + reproducer
Phase 2 (parallel): impact + fix_advisor (with root cause context injected)

Specialists:
- Root Cause Analyzer: trace bug to source code paths
- Impact Assessor: blast radius and affected components
- Fix Advisor: concrete fix approaches with files and patterns
- Reproducer: reproducibility and test coverage

Inherits from ParallelAgentOrchestrator for shared SDK session
infrastructure. Uses structured output via Pydantic model schemas.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from ...phase_config import (
        get_thinking_budget,
        resolve_model_id,
    )
    from .investigation_hooks import emit_json_event
    from .investigation_models import (
        FixAdvice,
        ImpactAssessment,
        InvestigationReport,
        ReproductionAnalysis,
        RootCauseAnalysis,
    )
    from .investigation_persistence import (
        save_agent_log,
        save_investigation_report,
        save_specialist_session,
    )
    from .io_utils import safe_print
    from .parallel_agent_base import ParallelAgentOrchestrator, SpecialistConfig
    from .sdk_utils import _get_tool_detail
except (ImportError, ValueError, SystemError):
    try:
        from services.investigation_hooks import emit_json_event
        from services.investigation_models import (
            FixAdvice,
            ImpactAssessment,
            InvestigationReport,
            ReproductionAnalysis,
            RootCauseAnalysis,
        )
        from services.investigation_persistence import (
            save_agent_log,
            save_investigation_report,
            save_specialist_session,
        )
        from services.io_utils import safe_print
        from services.parallel_agent_base import ParallelAgentOrchestrator, SpecialistConfig
        from services.sdk_utils import _get_tool_detail
    except (ImportError, ModuleNotFoundError):
        from investigation_hooks import emit_json_event
        from investigation_models import (
            FixAdvice,
            ImpactAssessment,
            InvestigationReport,
            ReproductionAnalysis,
            RootCauseAnalysis,
        )
        from investigation_persistence import (
            save_agent_log,
            save_investigation_report,
            save_specialist_session,
        )
        from io_utils import safe_print
        from parallel_agent_base import ParallelAgentOrchestrator, SpecialistConfig
        from sdk_utils import _get_tool_detail
    from phase_config import (
        get_thinking_budget,
        resolve_model_id,
    )


logger = logging.getLogger(__name__)

# =============================================================================
# Specialist Configurations
# =============================================================================

INVESTIGATION_SPECIALISTS: list[SpecialistConfig] = [
    SpecialistConfig(
        name="root_cause",
        prompt_file="investigation_root_cause.md",
        tools=["Read", "Grep", "Glob", "Bash"],
        description="Trace the bug/issue to its source code paths and identify the root cause",
    ),
    SpecialistConfig(
        name="impact",
        prompt_file="investigation_impact.md",
        tools=["Read", "Grep", "Glob", "Bash"],
        description="Determine blast radius, affected components, and user impact",
    ),
    SpecialistConfig(
        name="fix_advisor",
        prompt_file="investigation_fix_advice.md",
        tools=["Read", "Grep", "Glob", "Bash"],
        description="Suggest concrete fix approaches with files to modify and patterns to follow",
    ),
    SpecialistConfig(
        name="reproducer",
        prompt_file="investigation_reproduction.md",
        tools=["Read", "Grep", "Glob", "Bash"],
        description="Determine reproducibility, check test coverage, and suggest test approaches",
    ),
]

# Map specialist name → Pydantic model for structured output
_SPECIALIST_SCHEMAS: dict[str, type] = {
    "root_cause": RootCauseAnalysis,
    "impact": ImpactAssessment,
    "fix_advisor": FixAdvice,
    "reproducer": ReproductionAnalysis,
}


class IssueInvestigationOrchestrator(ParallelAgentOrchestrator):
    """
    Orchestrator for two-phase issue investigation.

    Runs 4 specialist agents in two sequential phases, each with their own
    SDK session and structured output schema. Phase 1 runs root_cause and
    reproducer in parallel. Phase 2 runs impact and fix_advisor in parallel,
    with root cause findings injected as context. Results are combined into
    an InvestigationReport.

    Inherits from ParallelAgentOrchestrator:
    - _report_progress() — progress callback
    - _load_prompt() — loads from prompts/github/ directory
    - _run_specialist_session() — generic SDK session runner
    - _run_parallel_specialists() — asyncio.gather wrapper
    """

    async def investigate(
        self,
        issue_number: int,
        issue_title: str,
        issue_body: str,
        issue_labels: list[str] | None = None,
        issue_comments: list[str] | None = None,
        project_root: Path | None = None,
        resume_sessions: dict[str, str] | None = None,
    ) -> InvestigationReport:
        """
        Run a full investigation on a GitHub issue.

        Args:
            issue_number: GitHub issue number
            issue_title: Issue title
            issue_body: Issue body text
            issue_labels: Issue labels (optional)
            issue_comments: Issue comments (optional)
            project_root: Working directory for agents (worktree path).
                         Defaults to self.project_dir.

        Returns:
            InvestigationReport combining all specialist results
        """
        working_dir = project_root or self.project_dir
        investigation_id = f"inv-{uuid.uuid4().hex[:12]}"

        logger.info(
            f"[Investigation] Starting investigation {investigation_id} "
            f"for issue #{issue_number}: {issue_title}"
        )

        self._report_progress(
            "investigating",
            10,
            f"Starting investigation for issue #{issue_number}...",
            issue_number=issue_number,
        )

        # Build issue context for all specialists
        issue_context = self._build_issue_context(
            issue_number=issue_number,
            issue_title=issue_title,
            issue_body=issue_body,
            issue_labels=issue_labels or [],
            issue_comments=issue_comments or [],
        )

        # Resolve per-specialist config
        specialist_config = self.config.specialist_config or {}

        # Fallback model/thinking for specialists not in config
        fallback_model_shorthand = self.config.model or "sonnet"
        fallback_model = resolve_model_id(fallback_model_shorthand)
        fallback_thinking_level = self.config.thinking_level or "medium"

        logger.info(
            f"[Investigation] Using fallback model={fallback_model}, "
            f"thinking_level={fallback_thinking_level}, "
            f"specialist_config={specialist_config}"
        )

        self._report_progress(
            "investigating",
            20,
            "Launching investigation...",
            issue_number=issue_number,
        )

        # Run specialists in two phases (root_cause+reproducer, then impact+fix_advisor)
        specialist_results = await self._run_investigation_specialists(
            issue_context=issue_context,
            project_root=working_dir,
            specialist_config=specialist_config,
            fallback_model=fallback_model,
            fallback_thinking_level=fallback_thinking_level,
            issue_number=issue_number,
            resume_sessions=resume_sessions,
        )

        self._report_progress(
            "investigating",
            80,
            "Combining specialist results...",
            issue_number=issue_number,
        )

        # Build the combined report
        report = self._build_report(
            issue_number=issue_number,
            issue_title=issue_title,
            investigation_id=investigation_id,
            specialist_results=specialist_results,
        )

        # Save agent logs
        for name, result in specialist_results.items():
            log_text = result.get("result_text", "")
            if log_text:
                save_agent_log(self.project_dir, issue_number, name, log_text)

        # Save report
        save_investigation_report(self.project_dir, issue_number, report)

        self._report_progress(
            "investigating",
            100,
            "Investigation complete!",
            issue_number=issue_number,
        )

        logger.info(
            f"[Investigation] Investigation {investigation_id} complete. "
            f"Severity: {report.severity}, likely_resolved: {report.likely_resolved}"
        )

        return report

    def _build_issue_context(
        self,
        issue_number: int,
        issue_title: str,
        issue_body: str,
        issue_labels: list[str],
        issue_comments: list[str],
    ) -> str:
        """Build the issue context string injected into all specialist prompts."""
        labels_str = ", ".join(issue_labels) if issue_labels else "(none)"

        comments_section = ""
        if issue_comments:
            comments_list = []
            for i, comment in enumerate(issue_comments[:10], 1):
                # Truncate long comments
                truncated = comment[:500] + "..." if len(comment) > 500 else comment
                comments_list.append(f"**Comment {i}:**\n{truncated}")
            comments_section = f"""
### Comments ({len(issue_comments)} total)
{chr(10).join(comments_list)}
"""

        return f"""
## GitHub Issue #{issue_number}

**Title:** {issue_title}
**Labels:** {labels_str}

### Description
{issue_body or "(No description provided)"}
{comments_section}
"""

    def _build_specialist_prompt(
        self,
        config: SpecialistConfig,
        issue_context: str,
        project_root: Path,
        root_cause_context: str = "",
    ) -> str:
        """Build the full prompt for a specialist agent.

        Args:
            config: Specialist configuration
            issue_context: Pre-built issue context string
            project_root: Working directory for the agent
            root_cause_context: Optional root cause context from Phase 1
                               (injected into Phase 2 prompts)

        Returns:
            Full system prompt with context injected
        """
        base_prompt = self._load_prompt(config.prompt_file)
        if not base_prompt:
            base_prompt = (
                f"You are an issue investigation specialist ({config.name}). "
                f"Analyze the issue and provide findings for: {config.description}."
            )

        # Inject working directory
        working_dir_section = f"""
## Working Directory

All file paths are relative to: `{project_root}`
Use Read, Grep, and Glob tools to explore the codebase.
"""

        return base_prompt + working_dir_section + issue_context + root_cause_context

    def _build_root_cause_context(self, root_cause: RootCauseAnalysis | None) -> str:
        """Build root cause context string for injection into Phase 2 prompts."""
        if not root_cause:
            return ""

        code_paths_str = ""
        if hasattr(root_cause, 'code_paths') and root_cause.code_paths:
            if isinstance(root_cause.code_paths, list):
                code_paths_str = "\n".join(f"- {p}" for p in root_cause.code_paths)
            else:
                code_paths_str = str(root_cause.code_paths)

        return f"""
## Root Cause Analysis (from prior investigation phase)

**Root Cause:** {root_cause.identified_root_cause}

**Confidence:** {root_cause.confidence}

**Code Paths:**
{code_paths_str}

**Evidence:** {root_cause.evidence}

**Likely Already Fixed:** {root_cause.likely_already_fixed}

Use this root cause analysis to inform your assessment. Do NOT re-investigate
the root cause — focus on your specialty using these findings as ground truth.
"""

    async def _run_investigation_specialists(
        self,
        issue_context: str,
        project_root: Path,
        specialist_config: dict[str, dict[str, str]],
        fallback_model: str,
        fallback_thinking_level: str,
        issue_number: int | None = None,
        resume_sessions: dict[str, str] | None = None,
    ) -> dict[str, dict[str, Any]]:
        """Run investigation specialists in two phases.

        Phase 1 (parallel): root_cause + reproducer
        Phase 2 (parallel): impact + fix_advisor (with root cause context)

        Args:
            issue_context: Pre-built issue context
            project_root: Working directory
            specialist_config: Per-specialist model/thinking overrides
            fallback_model: Default model ID for specialists without overrides
            fallback_thinking_level: Default thinking level for specialists
                                    without overrides
            issue_number: GitHub issue number (for session persistence)
            resume_sessions: Optional dict mapping specialist name to SDK
                           session ID for resuming interrupted sessions.

        Returns:
            Dict mapping specialist name -> stream result dict
        """
        PHASE_1_NAMES = {"root_cause", "reproducer"}

        phase_1_specs = [s for s in INVESTIGATION_SPECIALISTS if s.name in PHASE_1_NAMES]
        phase_2_specs = [s for s in INVESTIGATION_SPECIALISTS if s.name not in PHASE_1_NAMES]

        # Shared completion counter for incremental progress reporting
        _agents_done = 0
        _agents_lock = asyncio.Lock()

        def _resolve_specialist(cfg_name: str):
            """Resolve model, thinking budget, and thinking level for a specialist."""
            sc = specialist_config.get(cfg_name, {})
            model_str = sc.get("model", fallback_model)
            # If model_str is a shorthand, resolve it
            if not model_str.startswith("claude-"):
                model_str = resolve_model_id(model_str)
            thinking_lvl = sc.get("thinking", fallback_thinking_level)
            budget = get_thinking_budget(thinking_lvl)
            return model_str, budget, thinking_lvl

        # Build coroutine factories so failed specialists can be retried
        def _make_specialist_factory(cfg: SpecialistConfig, model: str, budget: int | None, thinking_lvl: str = "medium", root_cause_ctx: str = ""):
            """Create a 0-arg callable that returns a fresh coroutine."""

            def factory():
                _prompt = self._build_specialist_prompt(
                    cfg, issue_context, project_root, root_cause_context=root_cause_ctx
                )
                _schema_class = _SPECIALIST_SCHEMAS.get(cfg.name)
                _output_schema = (
                    _schema_class.model_json_schema() if _schema_class else None
                )
                # Look up resume session ID for this specialist
                _resume_id = (
                    resume_sessions.get(cfg.name) if resume_sessions else None
                )
                # Track tool_id -> tool_name so on_tool_result can include the tool name
                _tool_names: dict[str, str] = {}

                def _on_tool_use(name, tid, inp, _name=cfg.name, _map=_tool_names):
                    _map[tid] = name
                    # StructuredOutput is an internal SDK tool — don't show in UI
                    if name == "StructuredOutput":
                        return
                    emit_json_event(
                        "tool_start",
                        _name,
                        tool=name,
                        detail=_get_tool_detail(name, inp),
                    )

                def _on_tool_result(tid, err, content, _name=cfg.name, _map=_tool_names):
                    tool = _map.pop(tid, None)
                    # StructuredOutput is an internal SDK tool — don't show in UI
                    if tool == "StructuredOutput":
                        return
                    kwargs = {"tool": tool, "success": not err}
                    if err and content:
                        # Include truncated error detail for failed tools
                        kwargs["error"] = str(content)[:200]
                    emit_json_event("tool_end", _name, **kwargs)

                return self._run_specialist_session(
                    config=cfg,
                    prompt=_prompt,
                    project_root=project_root,
                    model=model,
                    thinking_budget=budget,
                    output_schema=_output_schema,
                    agent_type="investigation_specialist",
                    context_name=f"Investigation:{cfg.name}",
                    resume_session_id=_resume_id,
                    thinking_level=thinking_lvl,
                    effort_level="high",
                    on_thinking=lambda text, _name=cfg.name: emit_json_event(
                        "thinking",
                        _name,
                        chars=len(text),
                        preview=text[:200].replace("\n", " "),
                    ),
                    on_tool_use=_on_tool_use,
                    on_tool_result=_on_tool_result,
                )

            return factory

        async def _agent_lifecycle_wrapper(
            cfg: SpecialistConfig,
            coro,
            progress_base: int,
            progress_step: int,
        ):
            """Wrap a specialist coroutine with agent_started/agent_done events."""
            nonlocal _agents_done

            emit_json_event("agent_started", cfg.name)

            try:
                result = await coro
                success = not (result and result.get("error"))
                emit_json_event(
                    "agent_done",
                    cfg.name,
                    success=success,
                    error=result.get("error") if not success else None,
                )
            except Exception as e:
                emit_json_event(
                    "agent_done",
                    cfg.name,
                    success=False,
                    error=str(e)[:200],
                )
                raise

            # Bump incremental progress (thread-safe via asyncio lock)
            async with _agents_lock:
                _agents_done += 1
                self._report_progress(
                    "investigating",
                    progress_base + (_agents_done * progress_step),
                    f"{cfg.name} complete",
                    issue_number=issue_number,
                )

            return result

        # === Phase 1: root_cause + reproducer ===
        self._report_progress(
            "investigating", 20,
            "Phase 1: Root Cause Agent + Reproducer Agent...",
            issue_number=issue_number,
        )

        _agents_done = 0
        phase_1_coroutines = []
        phase_1_retry_factories = []
        for cfg in phase_1_specs:
            model, budget, thinking_lvl = _resolve_specialist(cfg.name)
            factory = _make_specialist_factory(cfg, model, budget, thinking_lvl=thinking_lvl)
            phase_1_coroutines.append(
                _agent_lifecycle_wrapper(cfg, factory(), 20, 15)
            )
            phase_1_retry_factories.append(factory)

        phase_1_results = await self._run_parallel_specialists(
            tasks=phase_1_coroutines,
            orchestrator_name="IssueInvestigation:Phase1",
            retry_tasks=phase_1_retry_factories,
        )

        # Map phase 1 results
        phase_1_result_map: dict[str, dict[str, Any]] = {}
        for i, cfg in enumerate(phase_1_specs):
            result = phase_1_results[i] if i < len(phase_1_results) else None
            phase_1_result_map[cfg.name] = result if result is not None else {
                "result_text": "", "structured_output": None,
                "error": "Specialist did not complete", "msg_count": 0,
            }

        # Parse root cause for context injection into Phase 2
        root_cause_parsed = self._parse_specialist_result(
            "root_cause", phase_1_result_map, RootCauseAnalysis
        )
        root_cause_ctx = self._build_root_cause_context(root_cause_parsed)

        # === Phase 2: impact + fix_advisor (with root cause context) ===
        self._report_progress(
            "investigating", 55,
            "Phase 2: Impact Agent + Fix Advisor Agent...",
            issue_number=issue_number,
        )

        _agents_done = 0
        phase_2_coroutines = []
        phase_2_retry_factories = []
        for cfg in phase_2_specs:
            model, budget, thinking_lvl = _resolve_specialist(cfg.name)
            factory = _make_specialist_factory(cfg, model, budget, thinking_lvl=thinking_lvl, root_cause_ctx=root_cause_ctx)
            phase_2_coroutines.append(
                _agent_lifecycle_wrapper(cfg, factory(), 55, 13)
            )
            phase_2_retry_factories.append(factory)

        phase_2_results = await self._run_parallel_specialists(
            tasks=phase_2_coroutines,
            orchestrator_name="IssueInvestigation:Phase2",
            retry_tasks=phase_2_retry_factories,
        )

        # Map phase 2 results
        phase_2_result_map: dict[str, dict[str, Any]] = {}
        for i, cfg in enumerate(phase_2_specs):
            result = phase_2_results[i] if i < len(phase_2_results) else None
            phase_2_result_map[cfg.name] = result if result is not None else {
                "result_text": "", "structured_output": None,
                "error": "Specialist did not complete", "msg_count": 0,
            }

        # Combine all results
        all_results = {**phase_1_result_map, **phase_2_result_map}

        # Save session IDs for resume support (both phases)
        if issue_number is not None:
            for config in INVESTIGATION_SPECIALISTS:
                result = all_results.get(config.name)
                if result and result.get("session_id"):
                    try:
                        save_specialist_session(
                            self.project_dir,
                            issue_number,
                            config.name,
                            result["session_id"],
                        )
                    except Exception as e:
                        logger.warning(f"Failed to save session ID for {config.name}: {e}")

        return all_results

    def _build_report(
        self,
        issue_number: int,
        issue_title: str,
        investigation_id: str,
        specialist_results: dict[str, dict[str, Any]],
    ) -> InvestigationReport:
        """Combine specialist results into an InvestigationReport.

        Parses structured output from each specialist and falls back to
        defaults if parsing fails.

        Args:
            issue_number: GitHub issue number
            issue_title: Issue title
            investigation_id: Unique investigation ID
            specialist_results: Dict mapping specialist name → stream result

        Returns:
            Combined InvestigationReport
        """
        # Parse each specialist's structured output
        root_cause = self._parse_specialist_result(
            "root_cause", specialist_results, RootCauseAnalysis
        )
        impact = self._parse_specialist_result(
            "impact", specialist_results, ImpactAssessment
        )
        fix_advice = self._parse_specialist_result(
            "fix_advisor", specialist_results, FixAdvice
        )
        reproduction = self._parse_specialist_result(
            "reproducer", specialist_results, ReproductionAnalysis
        )

        # Compute overall severity from impact assessment
        severity = impact.severity if impact else "medium"

        # Check if likely already resolved
        likely_resolved = root_cause.likely_already_fixed if root_cause else False

        # Build AI summary
        ai_summary = self._generate_summary(
            root_cause=root_cause,
            impact=impact,
            fix_advice=fix_advice,
            reproduction=reproduction,
        )

        # Use defaults for any missing specialist results
        if not root_cause:
            root_cause = RootCauseAnalysis(
                identified_root_cause="Unable to determine root cause (specialist failed)",
                confidence="low",
                evidence="Investigation specialist did not complete successfully",
            )
        if not impact:
            impact = ImpactAssessment(
                severity="medium",
                blast_radius="Unable to assess (specialist failed)",
                user_impact="Unable to assess (specialist failed)",
                regression_risk="Unknown",
            )
        if not fix_advice:
            fix_advice = FixAdvice()
        if not reproduction:
            reproduction = ReproductionAnalysis(
                reproducible="unlikely",
                test_coverage={
                    "has_existing_tests": False,
                    "test_files": [],
                    "coverage_assessment": "Unable to assess (specialist failed)",
                },
                suggested_test_approach="Unable to determine (specialist failed)",
            )

        return InvestigationReport(
            issue_number=issue_number,
            issue_title=issue_title,
            investigation_id=investigation_id,
            timestamp=datetime.now(timezone.utc).isoformat(),
            root_cause=root_cause,
            impact=impact,
            fix_advice=fix_advice,
            reproduction=reproduction,
            ai_summary=ai_summary,
            severity=severity,
            likely_resolved=likely_resolved,
        )

    def _parse_specialist_result(
        self,
        name: str,
        specialist_results: dict[str, dict[str, Any]],
        model_class: type,
    ) -> Any | None:
        """Parse structured output from a specialist into a Pydantic model.

        Args:
            name: Specialist name
            specialist_results: Dict of all specialist results
            model_class: Pydantic model class to validate against

        Returns:
            Parsed model instance, or None if parsing failed
        """
        result = specialist_results.get(name)
        if not result:
            return None

        structured_output = result.get("structured_output")
        if not structured_output:
            error = result.get("error", "unknown")
            msg_count = result.get("msg_count", 0)
            logger.warning(
                f"[Investigation] No structured output from {name} "
                f"(error={error}, msgs={msg_count})"
            )
            safe_print(
                f"[Investigation] {name}: no structured output "
                f"(error={error}, msgs={msg_count})"
            )
            return None

        try:
            return model_class.model_validate(structured_output)
        except Exception as e:
            logger.error(
                f"[Investigation] Failed to parse {name} output: {e}",
                exc_info=True,
            )
            safe_print(
                f"[Investigation] {name}: schema validation failed: {e}"
            )
            return None

    def _generate_summary(
        self,
        root_cause: RootCauseAnalysis | None,
        impact: ImpactAssessment | None,
        fix_advice: FixAdvice | None,
        reproduction: ReproductionAnalysis | None,
    ) -> str:
        """Generate a human-readable summary from specialist results."""
        parts = []

        if root_cause:
            parts.append(
                f"Root cause ({root_cause.confidence} confidence): "
                f"{root_cause.identified_root_cause}"
            )

        if impact:
            parts.append(f"Severity: {impact.severity}. {impact.user_impact}")

        if fix_advice and fix_advice.approaches:
            rec_idx = fix_advice.recommended_approach
            if 0 <= rec_idx < len(fix_advice.approaches):
                approach = fix_advice.approaches[rec_idx]
                parts.append(
                    f"Recommended fix ({approach.complexity}): {approach.description}"
                )

        if reproduction:
            parts.append(f"Reproducible: {reproduction.reproducible}.")

        return (
            " ".join(parts)
            if parts
            else "Investigation completed but no specialist produced results."
        )
