"""
Session event bus for the observer memory system.

Provides an asyncio-based event bus for routing agent session events
to the observer system. Uses a bounded queue to prevent memory issues
and includes source tagging to prevent observer feedback loops.
"""

import asyncio
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Any

from .models import SessionEvent

logger = logging.getLogger(__name__)

OBSERVER_SOURCE = "observer"


@dataclass
class EventBusStats:
    """Tracks event bus throughput statistics."""

    events_published: int = 0
    events_dropped: int = 0


class SessionEventBus:
    """Async event bus for routing agent session events.

    Wraps an asyncio.Queue with non-blocking publish semantics,
    observer-loop prevention via source tagging, and basic stats tracking.

    Args:
        maxsize: Maximum number of buffered events. Defaults to 10000.
    """

    def __init__(self, maxsize: int = 10000) -> None:
        self._queue: asyncio.Queue[SessionEvent] = asyncio.Queue(maxsize=maxsize)
        self._stats = EventBusStats()
        # Shadow list for peek semantics without relying on asyncio.Queue internals
        self._buffered: list[SessionEvent] = []

    async def publish(self, event: dict[str, Any] | SessionEvent) -> None:
        """Publish an event to the bus (non-blocking).

        Events with source='observer' are silently ignored to prevent
        feedback loops. If the queue is full, the event is dropped
        and a debug message is logged.

        Args:
            event: A SessionEvent instance or a dict with event_type, data, source.
        """
        if isinstance(event, dict):
            event = SessionEvent.from_dict(event)

        if event.source == OBSERVER_SOURCE:
            return

        try:
            self._queue.put_nowait(event)
            self._buffered.append(event)
            self._stats.events_published += 1
        except asyncio.QueueFull:
            self._stats.events_dropped += 1
            logger.debug(
                "Event bus full, dropping event: type=%s source=%s",
                event.event_type,
                event.source,
            )

    async def subscribe(self) -> AsyncIterator[SessionEvent]:
        """Yield events from the bus as they arrive.

        Returns an async iterator that blocks waiting for the next event.
        Intended for long-running consumer tasks.
        """
        while True:
            event = await self._queue.get()
            # Remove from shadow list (first matching instance)
            try:
                self._buffered.remove(event)
            except ValueError:
                pass
            yield event

    async def drain(self) -> list[SessionEvent]:
        """Flush all currently buffered events and return them.

        Returns:
            List of all events that were in the queue.
        """
        events: list[SessionEvent] = []
        while not self._queue.empty():
            try:
                events.append(self._queue.get_nowait())
            except asyncio.QueueEmpty:
                break
        self._buffered.clear()
        return events

    def get_buffered_events(self) -> list[SessionEvent]:
        """Peek at all currently buffered events without removing them.

        Returns a snapshot of events currently in the queue using
        a shadow list (avoids accessing private asyncio.Queue internals).

        Returns:
            List of events currently in the queue.
        """
        return list(self._buffered)

    def qsize(self) -> int:
        """Return the number of events currently in the queue."""
        return self._queue.qsize()

    @property
    def stats(self) -> EventBusStats:
        """Return current event bus statistics."""
        return self._stats
