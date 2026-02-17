"""
Base Engine Class
=================

Shared functionality for GitHub runner engines (enrichment, split, etc.).
"""

from __future__ import annotations

from pathlib import Path


class EngineBase:
    """Base class for GitHub analysis engines."""

    def __init__(
        self,
        project_dir: Path,
        github_dir: Path,
        config,
        progress_callback=None,
    ):
        self.project_dir = Path(project_dir)
        self.github_dir = Path(github_dir)
        self.config = config
        self.progress_callback = progress_callback

    def _report_progress(self, phase: str, progress: int, message: str, **kwargs):
        """Report progress if callback is set.

        Args:
            phase: Current phase name (e.g., "analyzing", "generating")
            progress: Progress percentage (0-100)
            message: Human-readable progress message
            **kwargs: Additional context data
        """
        if self.progress_callback:
            import sys

            if "orchestrator" in sys.modules:
                ProgressCallback = sys.modules["orchestrator"].ProgressCallback
            else:
                try:
                    from ..orchestrator import ProgressCallback
                except ImportError:
                    from orchestrator import ProgressCallback

            self.progress_callback(
                ProgressCallback(
                    phase=phase, progress=progress, message=message, **kwargs
                )
            )
