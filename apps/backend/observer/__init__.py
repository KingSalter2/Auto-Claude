"""
Observer Memory System for Auto-Claude
=======================================

Provides passive observation of agent sessions, capturing patterns,
discoveries, and insights into a persistent memory layer.

Core components:
- ObserverConfig: Configuration for observer behavior
- Observation/ObservationCategory/ObservationPriority: Data models
- SessionEventBus: Event routing for agent session events
- ObserverAgent: AI-powered observation and analysis
- ObservationStore: Persistent storage for observations
- redact_secrets: Security utility for sanitizing sensitive content

Usage:
    from observer import ObserverConfig, Observation, ObservationCategory

    config = ObserverConfig()
    observation = Observation(
        category=ObservationCategory.PATTERN,
        content="Agent prefers small focused commits",
    )
"""

from .config import ObserverConfig
from .models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    ObservationStatus,
    SessionEvent,
)
from .security import redact_secrets


def __getattr__(name: str):
    """Lazy imports for modules that may not exist yet or have heavy dependencies."""
    if name == "SessionEventBus":
        from .event_bus import SessionEventBus

        return SessionEventBus
    if name == "ObserverAgent":
        from .agent import ObserverAgent

        return ObserverAgent
    if name == "ObservationStore":
        from .store import ObservationStore

        return ObservationStore
    raise AttributeError(f"module 'observer' has no attribute {name!r}")


__all__ = [
    # Configuration
    "ObserverConfig",
    # Data models
    "Observation",
    "ObservationCategory",
    "ObservationPriority",
    "ObservationStatus",
    "SessionEvent",
    # Security
    "redact_secrets",
    # Lazy-loaded components
    "SessionEventBus",
    "ObserverAgent",
    "ObservationStore",
]
