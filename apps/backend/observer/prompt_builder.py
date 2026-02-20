"""
Observer Prompt Builder
=======================

Builds a markdown observation block for injection into agent prompts.
Loads observations from ObservationStore, filters by status and staleness,
sorts by priority, and applies a dynamic token budget.
"""

import hashlib
import logging
from pathlib import Path

from .config import ObserverConfig
from .models import Observation, ObservationPriority, ObservationStatus
from .store import ObservationStore

logger = logging.getLogger(__name__)

# Priority ordering for sorting (lower index = higher priority)
_PRIORITY_ORDER = {
    ObservationPriority.CRITICAL: 0,
    ObservationPriority.HIGH: 1,
    ObservationPriority.MEDIUM: 2,
    ObservationPriority.LOW: 3,
}

# Approximate tokens per observation for budget estimation
_TOKENS_PER_OBSERVATION = 50

# Token budgets by complexity
_BUDGET_SIMPLE = 3_000
_BUDGET_COMPLEX = 8_000

# Staleness threshold — observations above this are excluded
_STALENESS_THRESHOLD = 0.8


def _get_observations_dir(project_id: str) -> Path:
    """Resolve the observations base directory for a project."""
    project_hash = hashlib.sha256(project_id.encode()).hexdigest()[:12]
    return Path.home() / ".auto-claude" / "observations" / project_hash


def _estimate_complexity(subtask: dict | None) -> str:
    """Estimate subtask complexity from metadata. Returns 'simple' or 'complex'."""
    if subtask is None:
        return "simple"
    # Check explicit complexity field
    complexity = subtask.get("complexity", "")
    if complexity in ("high", "complex"):
        return "complex"
    # Check description length as heuristic
    desc = subtask.get("description", "")
    if len(desc) > 300:
        return "complex"
    # Check number of files
    files = subtask.get("files_to_create", []) + subtask.get("files_to_modify", [])
    if len(files) > 3:
        return "complex"
    return "simple"


def _get_staleness(obs: Observation) -> float:
    """Get staleness score from observation metadata. Defaults to 0.0 (fresh)."""
    return float(obs.metadata.get("staleness_score", 0.0))


def _is_pinned(obs: Observation) -> bool:
    """Check if an observation is pinned."""
    return bool(obs.metadata.get("pinned", False))


def _priority_sort_key(obs: Observation) -> tuple[int, str]:
    """Sort key: pinned first, then by priority, then by timestamp (newest first)."""
    pinned = 0 if _is_pinned(obs) else 1
    priority = _PRIORITY_ORDER.get(obs.priority, 3)
    # Negate timestamp by using reverse string sort (ISO timestamps sort lexically)
    return (pinned, priority)


def _format_observation(obs: Observation) -> str:
    """Format a single observation as a markdown bullet."""
    pin_marker = " 📌" if _is_pinned(obs) else ""
    prefix = f"[{obs.category.value}]"
    return f"- {prefix} {obs.content}{pin_marker}"


def build_observation_block(
    project_id: str,
    spec_id: str,
    project_dir: str,
    subtask: dict | None = None,
) -> str:
    """Build a markdown observation block for agent prompt injection.

    Loads observations from the store, filters active non-stale ones,
    sorts by priority, applies a token budget, and formats as markdown.

    Args:
        project_id: Project identifier for resolving the observation store.
        spec_id: Spec ID to filter spec-level observations.
        project_dir: Project directory path (used for config resolution).
        subtask: Optional subtask dict for complexity-based budget sizing.

    Returns:
        Markdown string with observation block, or empty string if
        no observations exist or observer is disabled.
    """
    # Check if observer is enabled
    config = ObserverConfig.from_env()
    if not config.enabled:
        return ""

    # Load observations
    try:
        base_dir = _get_observations_dir(project_id)
        store = ObservationStore(base_dir)

        # Get spec-level observations
        spec_obs = store.list(spec_id=spec_id, limit=config.max_in_prompt)
        # Get project-level observations (no spec filter, promoted ones)
        project_obs = store.list(spec_id=None, limit=config.max_in_prompt)
    except Exception as e:
        logger.warning("Failed to load observations: %s", e)
        return ""

    # Merge and deduplicate by ID
    seen_ids: set[str] = set()
    all_obs: list[Observation] = []
    for obs in spec_obs + project_obs:
        if obs.id not in seen_ids:
            seen_ids.add(obs.id)
            all_obs.append(obs)

    # Filter: active only, staleness below threshold
    filtered: list[Observation] = []
    pinned: list[Observation] = []
    for obs in all_obs:
        if obs.status != ObservationStatus.ACTIVE:
            continue
        if _is_pinned(obs):
            pinned.append(obs)
            continue
        if _get_staleness(obs) >= _STALENESS_THRESHOLD:
            continue
        filtered.append(obs)

    # Sort non-pinned by priority
    filtered.sort(key=_priority_sort_key)

    # Combine: pinned always included, then priority-sorted
    ordered = pinned + filtered

    if not ordered:
        return ""

    # Determine token budget
    complexity = _estimate_complexity(subtask)
    budget = _BUDGET_COMPLEX if complexity == "complex" else _BUDGET_SIMPLE
    max_observations = budget // _TOKENS_PER_OBSERVATION

    # Group by priority tier, respecting budget
    critical: list[str] = []
    high: list[str] = []
    context: list[str] = []
    count = 0

    for obs in ordered:
        if count >= max_observations:
            break
        line = _format_observation(obs)
        if _is_pinned(obs) or obs.priority == ObservationPriority.CRITICAL:
            critical.append(line)
        elif obs.priority == ObservationPriority.HIGH:
            high.append(line)
        else:
            context.append(line)
        count += 1

    # Build markdown block
    sections: list[str] = ["## Memory Observations\n"]

    if critical:
        sections.append("### Critical\n")
        sections.extend(critical)
        sections.append("")

    if high:
        sections.append("### High Priority\n")
        sections.extend(high)
        sections.append("")

    if context:
        sections.append("### Context for Current Task\n")
        sections.extend(context)
        sections.append("")

    return "\n".join(sections).rstrip("\n") + "\n"
