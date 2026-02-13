"""
Observer Memory Integration
============================

Integration with the observer memory system for injecting observations into context.
"""

import os


def is_observer_enabled() -> bool:
    """Check if the observer memory system is enabled via environment variable."""
    value = os.environ.get("OBSERVER_ENABLED", "true").strip().lower()
    return value in ("true", "1", "yes")


def get_observations_context(
    project_id: str,
    spec_id: str,
    project_dir: str,
    subtask: dict | None = None,
) -> str:
    """
    Get observation block from the observer memory system.

    Args:
        project_id: Project identifier for resolving the observation store.
        spec_id: Spec ID to filter spec-level observations.
        project_dir: Project directory path.
        subtask: Optional subtask dict for complexity-based budget sizing.

    Returns:
        Markdown string with observation block, or empty string if unavailable.
    """
    try:
        from observer.prompt_builder import build_observation_block

        return build_observation_block(
            project_id=project_id,
            spec_id=spec_id,
            project_dir=project_dir,
            subtask=subtask,
        )
    except ImportError:
        return ""
    except Exception:
        # Observer is optional - fail gracefully
        return ""
