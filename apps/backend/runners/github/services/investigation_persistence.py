"""
Investigation Persistence Layer
================================

Read/write operations for .auto-claude/issues/{issueNumber}/ directory.

All writes use write_json_atomic() to prevent corruption from concurrent
access or crashes. Directory structure:

    .auto-claude/issues/
      {issueNumber}/
        investigation_report.json    # Full findings from all 4 agents
        investigation_state.json     # Status, timestamps, linked spec ID
        agent_logs/                  # Per-agent log files
          root_cause.log
          impact.log
          fix_advisor.log
          reproducer.log
        suggested_labels.json        # AI-suggested labels with accept/reject
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

try:
    from ...core.file_utils import write_json_atomic
except (ImportError, ValueError, SystemError):
    from core.file_utils import write_json_atomic

from .investigation_models import InvestigationReport, InvestigationState

logger = logging.getLogger(__name__)


def _issues_dir(project_dir: Path) -> Path:
    """Get the base issues directory."""
    return project_dir / ".auto-claude" / "issues"


def _issue_dir(project_dir: Path, issue_number: int) -> Path:
    """Get the directory for a specific issue."""
    return _issues_dir(project_dir) / str(issue_number)


# =============================================================================
# Investigation State
# =============================================================================


def save_investigation_state(
    project_dir: Path,
    issue_number: int,
    state: InvestigationState,
) -> Path:
    """Save investigation state to disk.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number
        state: Investigation state to save

    Returns:
        Path to the saved state file
    """
    issue_path = _issue_dir(project_dir, issue_number)
    state_file = issue_path / "investigation_state.json"
    write_json_atomic(state_file, state.model_dump(mode="json"))
    logger.debug(f"Saved investigation state for issue #{issue_number}: {state.status}")
    return state_file


def load_investigation_state(
    project_dir: Path,
    issue_number: int,
) -> InvestigationState | None:
    """Load investigation state from disk.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number

    Returns:
        InvestigationState if found, None otherwise
    """
    state_file = _issue_dir(project_dir, issue_number) / "investigation_state.json"
    if not state_file.exists():
        return None

    try:
        data = json.loads(state_file.read_text(encoding="utf-8"))
        return InvestigationState.model_validate(data)
    except Exception as e:
        logger.error(f"Failed to load investigation state for issue #{issue_number}: {e}")
        return None


# =============================================================================
# Investigation Report
# =============================================================================


def save_investigation_report(
    project_dir: Path,
    issue_number: int,
    report: InvestigationReport,
) -> Path:
    """Save investigation report to disk.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number
        report: Investigation report to save

    Returns:
        Path to the saved report file
    """
    issue_path = _issue_dir(project_dir, issue_number)
    report_file = issue_path / "investigation_report.json"
    write_json_atomic(report_file, report.model_dump(mode="json"))
    logger.debug(f"Saved investigation report for issue #{issue_number}")
    return report_file


def load_investigation_report(
    project_dir: Path,
    issue_number: int,
) -> InvestigationReport | None:
    """Load investigation report from disk.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number

    Returns:
        InvestigationReport if found, None otherwise
    """
    report_file = _issue_dir(project_dir, issue_number) / "investigation_report.json"
    if not report_file.exists():
        return None

    try:
        data = json.loads(report_file.read_text(encoding="utf-8"))
        return InvestigationReport.model_validate(data)
    except Exception as e:
        logger.error(f"Failed to load investigation report for issue #{issue_number}: {e}")
        return None


# =============================================================================
# Agent Logs
# =============================================================================


def save_agent_log(
    project_dir: Path,
    issue_number: int,
    agent_name: str,
    log_content: str,
) -> Path:
    """Save an agent's log output to disk.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number
        agent_name: Name of the agent (e.g., 'root_cause', 'impact')
        log_content: Log text to save

    Returns:
        Path to the saved log file
    """
    logs_dir = _issue_dir(project_dir, issue_number) / "agent_logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    log_file = logs_dir / f"{agent_name}.log"
    log_file.write_text(log_content, encoding="utf-8")
    logger.debug(f"Saved agent log for issue #{issue_number}/{agent_name}")
    return log_file


# =============================================================================
# GitHub Comment Tracking
# =============================================================================


def save_github_comment_id(
    project_dir: Path,
    issue_number: int,
    comment_id: int,
) -> None:
    """Save the GitHub comment ID for the posted investigation results.

    Also updates the investigation state with the comment ID.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number
        comment_id: GitHub comment ID
    """
    # Save to dedicated file for quick lookup
    issue_path = _issue_dir(project_dir, issue_number)
    issue_path.mkdir(parents=True, exist_ok=True)
    comment_file = issue_path / "github_comment_id"
    comment_file.write_text(str(comment_id), encoding="utf-8")

    # Also update state if it exists
    state = load_investigation_state(project_dir, issue_number)
    if state:
        state.github_comment_id = comment_id
        save_investigation_state(project_dir, issue_number, state)

    logger.debug(f"Saved GitHub comment ID {comment_id} for issue #{issue_number}")


def load_github_comment_id(
    project_dir: Path,
    issue_number: int,
) -> int | None:
    """Load the GitHub comment ID for posted investigation results.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number

    Returns:
        Comment ID if found, None otherwise
    """
    comment_file = _issue_dir(project_dir, issue_number) / "github_comment_id"
    if not comment_file.exists():
        return None

    try:
        return int(comment_file.read_text(encoding="utf-8").strip())
    except (ValueError, OSError) as e:
        logger.warning(f"Failed to load GitHub comment ID for issue #{issue_number}: {e}")
        return None


# =============================================================================
# Suggested Labels
# =============================================================================


def save_suggested_labels(
    project_dir: Path,
    issue_number: int,
    labels: list[dict[str, Any]],
) -> None:
    """Save AI-suggested labels for the issue.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number
        labels: List of label dicts with name, reason, confidence, accepted status
    """
    labels_file = _issue_dir(project_dir, issue_number) / "suggested_labels.json"
    write_json_atomic(labels_file, labels)
    logger.debug(f"Saved {len(labels)} suggested labels for issue #{issue_number}")


def load_suggested_labels(
    project_dir: Path,
    issue_number: int,
) -> list[dict[str, Any]]:
    """Load AI-suggested labels for the issue.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number

    Returns:
        List of label dicts, empty list if not found
    """
    labels_file = _issue_dir(project_dir, issue_number) / "suggested_labels.json"
    if not labels_file.exists():
        return []

    try:
        data = json.loads(labels_file.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except Exception as e:
        logger.warning(f"Failed to load suggested labels for issue #{issue_number}: {e}")
        return []


# =============================================================================
# Listing & Querying
# =============================================================================


def list_investigated_issues(
    project_dir: Path,
) -> list[int]:
    """List all issue numbers that have investigation data.

    Args:
        project_dir: Project root directory

    Returns:
        Sorted list of issue numbers
    """
    issues_dir = _issues_dir(project_dir)
    if not issues_dir.exists():
        return []

    issue_numbers = []
    for entry in issues_dir.iterdir():
        if entry.is_dir():
            try:
                issue_numbers.append(int(entry.name))
            except ValueError:
                continue

    return sorted(issue_numbers)


def has_investigation(
    project_dir: Path,
    issue_number: int,
) -> bool:
    """Check if an issue has any investigation data.

    Args:
        project_dir: Project root directory
        issue_number: GitHub issue number

    Returns:
        True if investigation data exists
    """
    return _issue_dir(project_dir, issue_number).exists()
