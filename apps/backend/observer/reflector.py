"""
Observer Reflector
==================

Heuristic-based observation maintenance: deduplication, limit enforcement,
and auto-archiving of stale observations. This is the v1 "simple" reflector;
a full LLM-based reflector is planned for Phase 3.
"""

import logging
from datetime import datetime, timedelta

from .models import Observation, ObservationStatus

logger = logging.getLogger(__name__)


class SimpleReflector:
    """Maintains observation quality through deduplication and pruning.

    All methods are pure functions operating on observation lists, except
    ``run()`` which orchestrates the full maintenance pass on a store.
    """

    # ── Similarity ─────────────────────────────────────────────────

    @staticmethod
    def jaccard_similarity(text_a: str, text_b: str) -> float:
        """Word-level Jaccard similarity between two texts.

        Returns a float in [0.0, 1.0].
        """
        words_a = set(text_a.lower().split())
        words_b = set(text_b.lower().split())
        if not words_a and not words_b:
            return 1.0
        if not words_a or not words_b:
            return 0.0
        intersection = words_a & words_b
        union = words_a | words_b
        return len(intersection) / len(union)

    # ── Deduplication ──────────────────────────────────────────────

    def is_duplicate(
        self,
        obs_a: Observation,
        obs_b: Observation,
        threshold: float = 0.8,
    ) -> bool:
        """Check if two observations are duplicates.

        Two observations are considered duplicates when they share the same
        category **and** their content similarity exceeds *threshold*.
        """
        if obs_a.category != obs_b.category:
            return False
        return self.jaccard_similarity(obs_a.content, obs_b.content) >= threshold

    def deduplicate(self, observations: list[Observation]) -> list[Observation]:
        """Remove duplicate observations, keeping the newest of each group.

        Observations are compared pairwise within the same category. When a
        duplicate pair is found the older observation is dropped.

        Returns a new list (input is not mutated).
        """
        # Sort newest-first so the first occurrence we keep is the newest
        sorted_obs = sorted(observations, key=lambda o: o.timestamp, reverse=True)
        kept: list[Observation] = []

        for obs in sorted_obs:
            if not any(self.is_duplicate(obs, existing) for existing in kept):
                kept.append(obs)

        return kept

    # ── Limit enforcement ──────────────────────────────────────────

    @staticmethod
    def enforce_limits(
        observations: list[Observation],
        max_per_category: int = 50,
    ) -> list[Observation]:
        """Keep at most *max_per_category* observations per category.

        Within each category the most recent observations are retained.
        Pinned observations (``metadata.get("pinned")``) are always kept.

        Returns a new list.
        """
        from collections import defaultdict

        by_category: dict[str, list[Observation]] = defaultdict(list)
        for obs in observations:
            by_category[obs.category.value].append(obs)

        result: list[Observation] = []
        for _cat, cat_obs in by_category.items():
            # Pinned always survive
            pinned = [o for o in cat_obs if o.metadata.get("pinned")]
            unpinned = [o for o in cat_obs if not o.metadata.get("pinned")]
            unpinned.sort(key=lambda o: o.timestamp, reverse=True)

            remaining_slots = max(0, max_per_category - len(pinned))
            result.extend(pinned)
            result.extend(unpinned[:remaining_slots])

        return result

    # ── Auto-archive ───────────────────────────────────────────────

    @staticmethod
    def auto_archive(
        observations: list[Observation],
        max_sessions: int = 30,
        max_days: int = 28,
    ) -> tuple[list[Observation], list[Observation]]:
        """Identify observations that should be archived.

        An observation is archived if:
        - It is older than *max_days*, **and**
        - It is not pinned.

        *max_sessions* is accepted for API compatibility but session-based
        archiving requires session tracking not yet available in v1.

        Returns:
            (kept, to_archive) — two disjoint lists.
        """
        cutoff = datetime.utcnow() - timedelta(days=max_days)
        kept: list[Observation] = []
        to_archive: list[Observation] = []

        for obs in observations:
            if obs.metadata.get("pinned"):
                kept.append(obs)
                continue
            if obs.status == ObservationStatus.ARCHIVED:
                kept.append(obs)
                continue
            try:
                obs_time = datetime.fromisoformat(obs.timestamp)
            except (ValueError, TypeError):
                kept.append(obs)
                continue

            if obs_time < cutoff:
                to_archive.append(obs)
            else:
                kept.append(obs)

        return kept, to_archive

    # ── Orchestrator ───────────────────────────────────────────────

    def run(
        self,
        store: "ObservationStore",  # noqa: F821 — forward ref
        spec_id: str | None = None,
        current_session: str | None = None,
    ) -> dict:
        """Run a full maintenance pass on the store.

        Steps:
        1. Load all active observations (optionally filtered by *spec_id*).
        2. Deduplicate.
        3. Enforce per-category limits.
        4. Auto-archive stale observations.
        5. Persist changes (archive old, delete pruned duplicates).

        Returns a summary dict with counts of actions taken.
        """
        observations = store.list(spec_id=spec_id, limit=10_000)
        original_count = len(observations)

        # 1. Deduplicate
        deduped = self.deduplicate(observations)
        duplicates_removed = original_count - len(deduped)

        # 2. Enforce limits
        limited = self.enforce_limits(deduped)
        limits_pruned = len(deduped) - len(limited)

        # 3. Auto-archive
        kept, to_archive = self.auto_archive(limited)
        archived_count = len(to_archive)

        # Determine IDs to keep
        kept_ids = {o.id for o in kept}

        # Archive stale observations
        for obs in to_archive:
            try:
                store.archive(obs.id)
            except Exception as e:
                logger.warning("Failed to archive observation %s: %s", obs.id, e)

        # Delete observations that were pruned (duplicates or over-limit)
        all_original_ids = {o.id for o in observations}
        kept_after_dedup_ids = {o.id for o in limited}
        pruned_ids = (
            all_original_ids - kept_after_dedup_ids - {o.id for o in to_archive}
        )

        for obs_id in pruned_ids:
            try:
                store.delete(obs_id)
            except Exception as e:
                logger.warning("Failed to delete pruned observation %s: %s", obs_id, e)

        summary = {
            "original_count": original_count,
            "duplicates_removed": duplicates_removed,
            "limits_pruned": limits_pruned,
            "archived": archived_count,
            "remaining": len(kept),
        }
        logger.info("Reflector pass complete: %s", summary)
        return summary
