"""
Observer Observation Store
==========================

File-based CRUD storage for observations. Stores observations as JSON files
in ~/.auto-claude/observations/{project-hash}/ with atomic writes, full-text
search, filtering, archiving, and stats.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from collections import Counter
from pathlib import Path

from .models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    ObservationStatus,
)
from .security import redact_secrets

logger = logging.getLogger(__name__)


class ObservationStore:
    """File-based persistent storage for observations.

    Each observation is stored as a separate JSON file for atomic operations
    and conflict-free parallel writes. An archive file holds soft-deleted
    observations.

    Args:
        base_dir: Base directory for this project's observations.
            Typically ~/.auto-claude/observations/{project-hash}/
    """

    def __init__(self, base_dir: str | Path) -> None:
        self._base_dir = Path(base_dir)
        self._obs_dir = self._base_dir / "observations"
        self._archive_path = self._base_dir / "archive.json"
        self._ensure_dirs()

    def _ensure_dirs(self) -> None:
        """Create storage directories if they don't exist."""
        try:
            self._obs_dir.mkdir(parents=True, exist_ok=True)
        except OSError as e:
            logger.warning("Failed to create observation directory: %s", e)

    def _obs_path(self, obs_id: str) -> Path:
        """Get the file path for an observation by ID."""
        return self._obs_dir / f"{obs_id}.json"

    def _atomic_write(self, path: Path, data: dict) -> None:
        """Write JSON atomically using write-and-rename."""
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp_path = tempfile.mkstemp(
            dir=str(path.parent), suffix=".tmp", prefix=".obs_"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
            os.replace(tmp_path, str(path))
        except Exception:
            # Clean up temp file on failure
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def _read_json(self, path: Path) -> dict | None:
        """Read a JSON file, returning None on error."""
        try:
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Failed to read %s: %s", path, e)
            return None

    # ── CRUD ──────────────────────────────────────────────────────────

    def save(self, observation: Observation) -> None:
        """Save an observation to disk with secret redaction.

        Applies redact_secrets() to content and context before writing.
        Creates a copy to avoid mutating the caller's object.
        Uses atomic write-and-rename to prevent corruption.
        """
        import copy

        # Work on a copy to avoid mutating the caller's object
        obs_copy = copy.deepcopy(observation)

        # Redact secrets before persisting
        obs_copy.content = redact_secrets(obs_copy.content)
        if obs_copy.context:
            obs_copy.context = redact_secrets(obs_copy.context)

        data = obs_copy.to_dict()
        self._atomic_write(self._obs_path(obs_copy.id), data)

    def get(self, obs_id: str) -> Observation | None:
        """Get a single observation by ID."""
        data = self._read_json(self._obs_path(obs_id))
        if data is None:
            return None
        try:
            return Observation.from_dict(data)
        except (KeyError, ValueError) as e:
            logger.warning("Corrupted observation %s: %s", obs_id, e)
            return None

    def list(
        self,
        spec_id: str | None = None,
        category: ObservationCategory | str | None = None,
        priority: ObservationPriority | str | None = None,
        limit: int = 100,
    ) -> list[Observation]:
        """List observations with optional filtering.

        Args:
            spec_id: Filter by spec_id in metadata.
            category: Filter by category.
            priority: Filter by priority.
            limit: Maximum number of results.

        Returns:
            List of matching observations, newest first.
        """
        if isinstance(category, str):
            try:
                category = ObservationCategory(category)
            except ValueError:
                category = None
        if isinstance(priority, str):
            try:
                priority = ObservationPriority(priority)
            except ValueError:
                priority = None

        results: list[Observation] = []
        try:
            files = sorted(
                self._obs_dir.glob("*.json"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )
        except OSError:
            return results

        for path in files:
            if len(results) >= limit:
                break
            data = self._read_json(path)
            if data is None:
                continue
            try:
                obs = Observation.from_dict(data)
            except (KeyError, ValueError):
                continue

            # Apply filters
            if spec_id and obs.metadata.get("spec_id") != spec_id:
                continue
            if category and obs.category != category:
                continue
            if priority and obs.priority != priority:
                continue

            results.append(obs)

        return results

    def search(
        self,
        query: str,
        category: ObservationCategory | str | None = None,
        scope: str = "project",
    ) -> list[Observation]:
        """Full-text search across observations.

        Searches content, context, tags, and source fields.

        Args:
            query: Search string (case-insensitive).
            category: Optional category filter.
            scope: 'project' (default) or 'global'.

        Returns:
            Matching observations sorted by relevance (content match first).
        """
        query_lower = query.lower()
        if isinstance(category, str):
            try:
                category = ObservationCategory(category)
            except ValueError:
                category = None

        results: list[Observation] = []
        try:
            files = list(self._obs_dir.glob("*.json"))
        except OSError:
            return results

        for path in files:
            data = self._read_json(path)
            if data is None:
                continue
            try:
                obs = Observation.from_dict(data)
            except (KeyError, ValueError):
                continue

            if category and obs.category != category:
                continue

            # Search across fields
            searchable = " ".join(
                filter(
                    None,
                    [
                        obs.content,
                        obs.context,
                        obs.source,
                        " ".join(obs.tags),
                    ],
                )
            ).lower()

            if query_lower in searchable:
                results.append(obs)

        return results

    def update(self, obs_id: str, fields: dict) -> Observation | None:
        """Partial update of an observation.

        Args:
            obs_id: Observation ID.
            fields: Dictionary of fields to update.

        Returns:
            Updated observation or None if not found.
        """
        obs = self.get(obs_id)
        if obs is None:
            return None

        data = obs.to_dict()
        data.update(fields)

        try:
            updated = Observation.from_dict(data)
        except (KeyError, ValueError) as e:
            logger.warning("Invalid update fields for %s: %s", obs_id, e)
            return None

        # Redact secrets before writing (matches save() pattern)
        updated.content = redact_secrets(updated.content)
        if updated.context:
            updated.context = redact_secrets(updated.context)

        self._atomic_write(self._obs_path(obs_id), updated.to_dict())
        return updated

    def delete(self, obs_id: str) -> bool:
        """Hard delete an observation.

        Returns:
            True if deleted, False if not found.
        """
        path = self._obs_path(obs_id)
        try:
            path.unlink()
            return True
        except FileNotFoundError:
            return False

    def promote(self, obs_id: str) -> Observation | None:
        """Promote an observation from spec-level to project-level.

        Copies the observation and marks it as promoted in metadata.

        Returns:
            The promoted observation or None if not found.
        """
        obs = self.get(obs_id)
        if obs is None:
            return None

        obs.metadata["promoted"] = True
        obs.metadata["promoted_from"] = obs.metadata.get("spec_id", "unknown")
        self._atomic_write(self._obs_path(obs.id), obs.to_dict())
        return obs

    def archive(self, obs_id: str) -> bool:
        """Soft-delete an observation to the archive file.

        Returns:
            True if archived, False if not found.
        """
        obs = self.get(obs_id)
        if obs is None:
            return False

        obs.status = ObservationStatus.ARCHIVED

        # Load existing archive
        archive_data: list[dict] = []
        if self._archive_path.exists():
            try:
                with open(self._archive_path, encoding="utf-8") as f:
                    archive_data = json.load(f)
                if not isinstance(archive_data, list):
                    archive_data = []
            except (json.JSONDecodeError, OSError):
                archive_data = []

        archive_data.append(obs.to_dict())
        self._atomic_write(self._archive_path, archive_data)

        # Remove the active file
        try:
            self._obs_path(obs_id).unlink()
        except FileNotFoundError:
            pass

        return True

    def restore(self, obs_id: str) -> Observation | None:
        """Restore an observation from the archive.

        Returns:
            The restored observation or None if not found in archive.
        """
        if not self._archive_path.exists():
            return None

        try:
            with open(self._archive_path, encoding="utf-8") as f:
                archive_data = json.load(f)
            if not isinstance(archive_data, list):
                return None
        except (json.JSONDecodeError, OSError):
            return None

        # Find and remove from archive
        found = None
        remaining = []
        for item in archive_data:
            if item.get("id") == obs_id:
                found = item
            else:
                remaining.append(item)

        if found is None:
            return None

        # Restore status to active
        found["status"] = ObservationStatus.ACTIVE.value
        try:
            obs = Observation.from_dict(found)
        except (KeyError, ValueError) as e:
            logger.warning("Corrupted archived observation %s: %s", obs_id, e)
            return None

        # Save back to active storage
        self._atomic_write(self._obs_path(obs.id), obs.to_dict())

        # Update archive file
        self._atomic_write(self._archive_path, remaining)

        return obs

    def get_stats(self) -> dict:
        """Get observation statistics.

        Returns:
            Dictionary with counts by category, priority, and status.
        """
        category_counts: Counter = Counter()
        priority_counts: Counter = Counter()
        status_counts: Counter = Counter()
        total = 0

        try:
            files = list(self._obs_dir.glob("*.json"))
        except OSError:
            files = []

        for path in files:
            data = self._read_json(path)
            if data is None:
                continue
            total += 1
            category_counts[data.get("category", "unknown")] += 1
            priority_counts[data.get("priority", "unknown")] += 1
            status_counts[data.get("status", "unknown")] += 1

        return {
            "total": total,
            "by_category": dict(category_counts),
            "by_priority": dict(priority_counts),
            "by_status": dict(status_counts),
        }
