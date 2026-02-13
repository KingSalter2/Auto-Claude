"""
Investigation Label Manager
============================

Manages GitHub lifecycle labels for issue investigations.
Labels are synced one-way (app -> GitHub) with graceful error handling
so label failures never crash the investigation pipeline.

Includes debounce logic (5s) on set_investigation_label() to avoid
rapid-fire GitHub API calls during fast state transitions.
"""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..gh_client import GHClient

logger = logging.getLogger(__name__)

# Debounce window in seconds for label changes per issue
_LABEL_DEBOUNCE_SECONDS = 5.0


class InvestigationLabelManager:
    """Manages GitHub lifecycle labels for issue investigations.

    Labels are synced one-way (app -> GitHub). Label API failures
    are logged but never propagated to callers.
    """

    LABELS = {
        "investigating": {
            "name": "auto-claude:investigating",
            "color": "1d76db",  # blue
            "description": "Auto-Claude is investigating this issue",
        },
        "findings_ready": {
            "name": "auto-claude:findings-ready",
            "color": "0e8a16",  # green
            "description": "Investigation complete, findings available",
        },
        "task_created": {
            "name": "auto-claude:task-created",
            "color": "5319e7",  # purple
            "description": "Kanban task created from investigation",
        },
        "building": {
            "name": "auto-claude:building",
            "color": "d93f0b",  # orange
            "description": "Task is being built by the pipeline",
        },
        "done": {
            "name": "auto-claude:done",
            "color": "0e8a16",  # green
            "description": "Investigation complete, issue resolved",
        },
    }

    # All managed label names for easy lookup
    ALL_LABEL_NAMES = [label["name"] for label in LABELS.values()]

    def __init__(self) -> None:
        # Track last label-change timestamp per issue for debounce
        self._last_label_time: dict[int, float] = {}

    # Map investigation states to label keys
    _STATE_MAP: dict[str, str] = {
        "investigating": "investigating",
        "findings_ready": "findings_ready",
        "task_created": "task_created",
        "building": "building",
        "done": "done",
        "completed": "done",
    }

    async def ensure_labels_exist(self, gh_client: GHClient) -> None:
        """Create labels in the repo if they don't already exist (idempotent).

        Called once when an investigation starts. Uses the GitHub API
        to create each label; existing labels are silently skipped.
        """
        for key, label_def in self.LABELS.items():
            try:
                await gh_client.run(
                    [
                        "api",
                        "--method",
                        "POST",
                        "repos/{owner}/{repo}/labels",
                        "-f",
                        f"name={label_def['name']}",
                        "-f",
                        f"color={label_def['color']}",
                        "-f",
                        f"description={label_def['description']}",
                    ],
                    raise_on_error=False,
                )
            except Exception as e:
                # 422 = label already exists, which is fine
                logger.debug(
                    "Label ensure for %s: %s (may already exist)", key, e
                )

    async def set_investigation_label(
        self,
        gh_client: GHClient,
        issue_number: int,
        state: str,
    ) -> None:
        """Set the lifecycle label for an issue, removing old ones first.

        Includes a debounce window to avoid rapid-fire GitHub API calls
        when state transitions happen in quick succession.

        Args:
            gh_client: GitHub CLI client
            issue_number: The issue number
            state: Investigation state (e.g. "investigating", "findings_ready")
        """
        label_name = self._state_to_label(state)
        if label_name is None:
            logger.warning(
                "Unknown investigation state %r, skipping label sync", state
            )
            return

        # Debounce: skip if we changed labels for this issue too recently
        now = time.monotonic()
        last_time = self._last_label_time.get(issue_number, 0.0)
        if now - last_time < _LABEL_DEBOUNCE_SECONDS:
            logger.debug(
                "Debounced label change for issue #%d (%.1fs since last change)",
                issue_number,
                now - last_time,
            )
            # Still update the timestamp so the final state wins
            self._last_label_time[issue_number] = now
            return

        try:
            # Remove all existing auto-claude: labels first
            await self.remove_all_investigation_labels(gh_client, issue_number)

            # Add the new label
            await gh_client.issue_add_labels(issue_number, [label_name])
            self._last_label_time[issue_number] = now
            logger.info(
                "Set label %s on issue #%d", label_name, issue_number
            )
        except Exception as e:
            logger.warning(
                "Failed to set label %s on issue #%d: %s",
                label_name,
                issue_number,
                e,
            )

    async def remove_all_investigation_labels(
        self,
        gh_client: GHClient,
        issue_number: int,
    ) -> None:
        """Remove all auto-claude: lifecycle labels from an issue."""
        try:
            await gh_client.issue_remove_labels(
                issue_number, self.ALL_LABEL_NAMES
            )
        except Exception as e:
            logger.debug(
                "Failed to remove investigation labels from #%d: %s",
                issue_number,
                e,
            )

    def _state_to_label(self, state: str) -> str | None:
        """Map an investigation state string to a GitHub label name."""
        key = self._STATE_MAP.get(state)
        if key is None:
            return None
        return self.LABELS[key]["name"]
