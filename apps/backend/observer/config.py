"""
Observer Memory System Configuration
=====================================

Configuration for the observer memory system that captures insights during agent sessions.

Environment Variables:
    OBSERVER_ENABLED: Enable observer system (default: true)
    OBSERVER_MODEL: Model for observer calls (default: gemini-2.0-flash)
    OBSERVER_MAX_CALLS_PER_SESSION: Max observer calls per session (default: 20)
    OBSERVER_TIMEOUT_SECONDS: Timeout for observer calls (default: 30)
    OBSERVER_MIN_BUFFER: Minimum buffer size before observing (default: 5000)
    OBSERVATION_MAX_IN_PROMPT: Max observations injected in prompt (default: 30)
    OBSERVATION_SCOPE: Scope of observations - project or global (default: project)
    OBSERVATION_AUTO_ARCHIVE_DAYS: Days before auto-archiving observations (default: 28)
"""

import logging
import os
from dataclasses import dataclass

logger = logging.getLogger(__name__)


def _parse_bool(value: str, default: bool) -> bool:
    """Parse a boolean from an environment variable string."""
    lower = value.strip().lower()
    if lower in ("true", "1", "yes"):
        return True
    if lower in ("false", "0", "no"):
        return False
    logger.warning("Invalid boolean value '%s', using default %s", value, default)
    return default


def _parse_int(value: str, default: int, name: str) -> int:
    """Parse an integer from an environment variable string."""
    try:
        return int(value)
    except ValueError:
        logger.warning(
            "Invalid integer value '%s' for %s, using default %d", value, name, default
        )
        return default


# Default configuration values
DEFAULT_MODEL = "gemini-2.0-flash"
DEFAULT_MAX_CALLS_PER_SESSION = 20
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_MIN_BUFFER = 5000
DEFAULT_MAX_IN_PROMPT = 30
DEFAULT_SCOPE = "project"
DEFAULT_AUTO_ARCHIVE_DAYS = 28


@dataclass
class ObserverConfig:
    """Configuration for the observer memory system."""

    enabled: bool = True
    model: str = DEFAULT_MODEL
    max_calls_per_session: int = DEFAULT_MAX_CALLS_PER_SESSION
    timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS
    min_buffer: int = DEFAULT_MIN_BUFFER
    max_in_prompt: int = DEFAULT_MAX_IN_PROMPT
    scope: str = DEFAULT_SCOPE
    auto_archive_days: int = DEFAULT_AUTO_ARCHIVE_DAYS

    @classmethod
    def from_env(cls) -> "ObserverConfig":
        """Create config from environment variables.

        Reads OBSERVER_* and OBSERVATION_* environment variables with sensible defaults.
        Logs warnings for invalid values and falls back to defaults.
        """
        enabled_str = os.environ.get("OBSERVER_ENABLED", "")
        enabled = _parse_bool(enabled_str, True) if enabled_str else True

        model = os.environ.get("OBSERVER_MODEL", DEFAULT_MODEL)

        max_calls_str = os.environ.get("OBSERVER_MAX_CALLS_PER_SESSION", "")
        max_calls = (
            _parse_int(
                max_calls_str,
                DEFAULT_MAX_CALLS_PER_SESSION,
                "OBSERVER_MAX_CALLS_PER_SESSION",
            )
            if max_calls_str
            else DEFAULT_MAX_CALLS_PER_SESSION
        )

        timeout_str = os.environ.get("OBSERVER_TIMEOUT_SECONDS", "")
        timeout = (
            _parse_int(timeout_str, DEFAULT_TIMEOUT_SECONDS, "OBSERVER_TIMEOUT_SECONDS")
            if timeout_str
            else DEFAULT_TIMEOUT_SECONDS
        )

        min_buffer_str = os.environ.get("OBSERVER_MIN_BUFFER", "")
        min_buffer = (
            _parse_int(min_buffer_str, DEFAULT_MIN_BUFFER, "OBSERVER_MIN_BUFFER")
            if min_buffer_str
            else DEFAULT_MIN_BUFFER
        )

        max_in_prompt_str = os.environ.get("OBSERVATION_MAX_IN_PROMPT", "")
        max_in_prompt = (
            _parse_int(
                max_in_prompt_str, DEFAULT_MAX_IN_PROMPT, "OBSERVATION_MAX_IN_PROMPT"
            )
            if max_in_prompt_str
            else DEFAULT_MAX_IN_PROMPT
        )

        scope = os.environ.get("OBSERVATION_SCOPE", DEFAULT_SCOPE)
        if scope not in ("project", "global"):
            logger.warning(
                "Invalid OBSERVATION_SCOPE '%s', using default '%s'",
                scope,
                DEFAULT_SCOPE,
            )
            scope = DEFAULT_SCOPE

        auto_archive_str = os.environ.get("OBSERVATION_AUTO_ARCHIVE_DAYS", "")
        auto_archive_days = (
            _parse_int(
                auto_archive_str,
                DEFAULT_AUTO_ARCHIVE_DAYS,
                "OBSERVATION_AUTO_ARCHIVE_DAYS",
            )
            if auto_archive_str
            else DEFAULT_AUTO_ARCHIVE_DAYS
        )

        return cls(
            enabled=enabled,
            model=model,
            max_calls_per_session=max_calls,
            timeout_seconds=timeout,
            min_buffer=min_buffer,
            max_in_prompt=max_in_prompt,
            scope=scope,
            auto_archive_days=auto_archive_days,
        )
