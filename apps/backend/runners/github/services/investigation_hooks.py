"""
Investigation Safety Hooks
===========================

PreToolUse hooks for investigation specialist agents.

investigation_bash_guard() validates Bash commands against a strict
allowlist of read-only, investigation-safe commands. This lets
specialists run git history commands, test runners, and dependency
queries without risking destructive operations.

The allowlist uses prefix matching: a command is allowed if it starts
with any entry in INVESTIGATION_BASH_ALLOWLIST. This means "git log"
also allows "git log --oneline -10".
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any

try:
    from .io_utils import safe_print
except (ImportError, ValueError, SystemError):
    try:
        from services.io_utils import safe_print
    except (ImportError, ModuleNotFoundError):
        from io_utils import safe_print

logger = logging.getLogger(__name__)

# Commands that investigation agents are allowed to run.
# Uses prefix matching: "git log" also allows "git log --oneline -10".
INVESTIGATION_BASH_ALLOWLIST: list[str] = [
    # Git history (read-only)
    "git log",
    "git show",
    "git blame",
    "git diff",
    "git status",
    # Test runners
    "pytest",
    "python -m pytest",
    "npm test",
    "npm run test",
    "npx vitest",
    "vitest",
    "cargo test",
    # Dependency inspection
    "pip list",
    "pip show",
    "npm ls",
    "node -v",
    "node --version",
    "python -V",
    "python --version",
    "python3 --version",
    # Filesystem exploration
    "ls",
    "find",
    "wc",
    "cat",
    "head",
    "tail",
    "file",
]


async def investigation_bash_guard(
    input_data: dict[str, Any],
    tool_use_id: str | None = None,
    context: Any | None = None,
) -> dict[str, Any]:
    """
    PreToolUse hook: validate Bash commands for investigation safety.

    Allows only commands that start with an entry in
    INVESTIGATION_BASH_ALLOWLIST. All other commands are denied.

    Args:
        input_data: Dict with tool_name and tool_input from SDK
        tool_use_id: Tool use ID (unused)
        context: Hook context (unused)

    Returns:
        Empty dict to allow, or hookSpecificOutput with deny decision
    """
    tool_input = input_data.get("tool_input")
    if not isinstance(tool_input, dict):
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Bash tool_input is missing or malformed",
            }
        }

    command = tool_input.get("command", "").strip()
    if not command:
        return {
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": "Empty Bash command",
            }
        }

    # Check against allowlist (prefix match)
    if any(command.startswith(allowed) for allowed in INVESTIGATION_BASH_ALLOWLIST):
        logger.debug(f"[InvestigationHook] Allowed: {command[:80]}")
        return {}

    # Deny with reason
    logger.info(f"[InvestigationHook] Blocked: {command[:100]}")
    return {
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"Command not allowed during investigation: {command[:100]}"
            ),
        }
    }


def emit_json_event(event: str, agent: str, **kwargs: Any) -> None:
    """Emit a structured JSON event to stdout for the frontend to parse.

    Args:
        event: Event type (tool_start, tool_end, thinking)
        agent: Specialist agent name (root_cause, impact, etc.)
        **kwargs: Additional event data
    """
    payload = {
        "event": event,
        "agent": agent,
        "ts": datetime.now(timezone.utc).isoformat(),
        **kwargs,
    }
    safe_print(json.dumps(payload, default=str))
