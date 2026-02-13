"""Observation validator — checks file references and updates staleness scores."""

from __future__ import annotations

import logging
import os
from pathlib import Path

from observer.models import Observation, ObservationStatus

logger = logging.getLogger(__name__)


def validate_observations(
    observations: list[Observation],
    project_dir: str | Path,
) -> list[Observation]:
    """Validate observations and update staleness scores.

    For each observation:
    - If file_path references a deleted file -> staleness_score = 1.0
    - If file modified since last validation -> staleness_score += 0.1
    - If age > 30 sessions -> staleness_score += 0.02 per session beyond 30
    - If retrieved by agent -> staleness_score = 0.0
    - Auto-archive if staleness_score >= 1.0 (unless pinned)

    Returns the list of validated observations with updated scores.
    """
    project_dir = Path(project_dir)
    validated: list[Observation] = []

    for obs in observations:
        try:
            _update_staleness(obs, project_dir)
        except Exception:
            logger.warning("Failed to validate observation %s", obs.id, exc_info=True)

        validated.append(obs)

    return validated


def _update_staleness(obs: Observation, project_dir: Path) -> None:
    """Update staleness_score for a single observation."""
    meta = obs.metadata
    score = float(meta.get("staleness_score", 0.0))

    # Reset if recently retrieved by an agent
    if meta.get("retrieved_by_agent"):
        meta["staleness_score"] = 0.0
        meta["retrieved_by_agent"] = False
        return

    # Check file reference
    if obs.file_path:
        full_path = project_dir / obs.file_path
        if not os.path.exists(full_path):
            score = 1.0
        else:
            last_validated = meta.get("last_validated_mtime")
            try:
                current_mtime = os.path.getmtime(full_path)
            except OSError:
                current_mtime = None

            if last_validated is not None and current_mtime is not None:
                if current_mtime > float(last_validated):
                    score += 0.1

            if current_mtime is not None:
                meta["last_validated_mtime"] = current_mtime

    # Age-based staleness
    session_count = int(meta.get("session_count", 0))
    if session_count > 30:
        score += 0.02 * (session_count - 30)

    # Clamp to [0, 1]
    score = min(max(score, 0.0), 1.0)
    meta["staleness_score"] = score

    # Auto-archive if stale (unless pinned)
    is_pinned = "pinned" in obs.tags or meta.get("pinned", False)
    if score >= 1.0 and not is_pinned:
        obs.status = ObservationStatus.ARCHIVED
