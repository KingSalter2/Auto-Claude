"""
Observer Agent
==============

Runs alongside agent sessions, buffering events and periodically extracting
structured observations via a cheap LLM (Google Gemini). Falls back to
rule-based extraction on LLM failure. Never propagates exceptions.
"""

import asyncio
import json
import logging
import os
import time
from pathlib import Path

from .config import ObserverConfig
from .event_bus import SessionEventBus
from .models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    SessionEvent,
)
from .reflector import SimpleReflector
from .store import ObservationStore

logger = logging.getLogger(__name__)

# Trigger event types that cause immediate extraction
_TRIGGER_TYPES = frozenset(
    {
        "subtask_completed",
        "subtask_failed",
        "phase_transition",
        "session_end",
    }
)

# Minimum interval between LLM calls in seconds
_MIN_CALL_INTERVAL = 30.0


class RuleBasedExtractor:
    """Fallback extractor using simple heuristics (no LLM)."""

    @staticmethod
    def extract(events: list[SessionEvent], spec_id: str) -> list[Observation]:
        """Extract observations from events using keyword heuristics."""
        observations: list[Observation] = []

        for event in events:
            data = event.data
            event_type = event.event_type

            # Extract error resolutions
            if event_type in ("tool_error", "error"):
                content = str(data.get("error", data.get("message", "")))[:200]
                if content:
                    observations.append(
                        Observation(
                            category=ObservationCategory.ERROR_RESOLUTION,
                            content=content,
                            source=f"session:{spec_id}",
                            priority=ObservationPriority.MEDIUM,
                            file_path=data.get("file"),
                            metadata={"session_event_type": event_type},
                        )
                    )

            # Extract file relationships from multi-file edits
            if event_type == "file_edit" and data.get("file"):
                file_path = data["file"]
                observations.append(
                    Observation(
                        category=ObservationCategory.FILE_RELATIONSHIP,
                        content=f"File modified during session: {file_path}"[:200],
                        source=f"session:{spec_id}",
                        priority=ObservationPriority.LOW,
                        file_path=file_path,
                        metadata={"session_event_type": event_type},
                    )
                )

        # Cap at 7 observations, prioritising higher-priority ones
        priority_order = {
            ObservationPriority.CRITICAL: 0,
            ObservationPriority.HIGH: 1,
            ObservationPriority.MEDIUM: 2,
            ObservationPriority.LOW: 3,
        }
        observations.sort(key=lambda o: priority_order.get(o.priority, 4))
        return observations[:7]


class ObserverAgent:
    """Observes agent sessions and extracts structured observations.

    Subscribes to a :class:`SessionEventBus`, buffers events, and triggers
    extraction (via LLM or fallback) when significant milestones occur.

    Args:
        config: Observer configuration.
        event_bus: The session event bus to subscribe to.
        store: Persistent observation store.
        spec_id: Current spec identifier.
        project_id: Current project identifier.
        session_num: Current session number.
        project_dir: Absolute path to the project root.
    """

    def __init__(
        self,
        config: ObserverConfig,
        event_bus: SessionEventBus,
        store: ObservationStore,
        spec_id: str,
        project_id: str,
        session_num: int,
        project_dir: str,
    ) -> None:
        self.config = config
        self.event_bus = event_bus
        self.store = store
        self.spec_id = spec_id
        self.project_id = project_id
        self.session_num = session_num
        self.project_dir = project_dir

        self._call_count = 0
        self._last_call_time = 0.0
        self._buffer: list[SessionEvent] = []
        self._reflector = SimpleReflector()
        self._running = False

    # ── Public API ────────────────────────────────────────────────

    async def run(self) -> None:
        """Main loop: subscribe to events, buffer, and extract on triggers.

        This coroutine runs until the event bus yields a ``session_end``
        event or the task is cancelled. Exceptions are logged but never
        propagated.
        """
        self._running = True
        try:
            async for event in self.event_bus.subscribe():
                if not self._running:
                    break
                self._buffer.append(event)

                should_extract = event.event_type in _TRIGGER_TYPES or (
                    event.event_type == "error"
                    and self._buffer_token_estimate() >= self.config.min_buffer
                )

                if should_extract:
                    await self._try_extract()

                if event.event_type == "session_end":
                    break
        except asyncio.CancelledError:
            # Graceful shutdown — do a final extraction with remaining buffer
            if self._buffer:
                await self._try_extract()
        except Exception:
            try:
                import sentry_sdk

                sentry_sdk.capture_exception()
            except ImportError:
                pass
            logger.exception("Observer agent crashed")

    def stop(self) -> None:
        """Signal the observer to stop after processing the current event."""
        self._running = False

    # ── Extraction ────────────────────────────────────────────────

    async def _try_extract(self) -> None:
        """Attempt extraction, respecting rate limits. Never raises."""
        try:
            if not self._buffer:
                return

            # Rate limiting
            if self._call_count >= self.config.max_calls_per_session:
                logger.debug(
                    "Observer hit max calls per session (%d)", self._call_count
                )
                return

            now = time.monotonic()
            if now - self._last_call_time < _MIN_CALL_INTERVAL:
                logger.debug(
                    "Observer rate-limited (%.1fs since last call)",
                    now - self._last_call_time,
                )
                return

            events_snapshot = list(self._buffer)
            self._buffer.clear()

            observations = await self._extract_via_llm(events_snapshot)
            if observations is None:
                # LLM failed — fall back to rule-based
                observations = RuleBasedExtractor.extract(events_snapshot, self.spec_id)

            if not observations:
                return

            # Deduplicate against existing observations
            existing = self.store.list(spec_id=self.spec_id, limit=500)
            combined = observations + existing
            deduped = self._reflector.deduplicate(combined)
            # Keep only new observations (not in existing)
            existing_ids = {o.id for o in existing}
            new_obs = [o for o in deduped if o.id not in existing_ids]

            for obs in new_obs:
                self.store.save(obs)

            if new_obs:
                logger.info(
                    "Observer extracted %d new observations (call %d/%d)",
                    len(new_obs),
                    self._call_count,
                    self.config.max_calls_per_session,
                )

        except Exception:
            try:
                import sentry_sdk

                sentry_sdk.capture_exception()
            except ImportError:
                pass
            logger.exception("Observer extraction failed")

    async def _extract_via_llm(
        self, events: list[SessionEvent]
    ) -> list[Observation] | None:
        """Call the LLM to extract observations. Returns None on failure."""
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        if not api_key:
            logger.debug("No GOOGLE_API_KEY set, skipping LLM extraction")
            return None

        try:
            import google.generativeai as genai
        except ImportError:
            logger.debug("google-generativeai not installed, skipping LLM extraction")
            return None

        try:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(self.config.model)

            # Build prompt
            prompt = self._build_prompt(events)

            # Track the call
            self._call_count += 1
            self._last_call_time = time.monotonic()

            # Call with timeout
            loop = asyncio.get_running_loop()
            response = await asyncio.wait_for(
                loop.run_in_executor(
                    None,
                    lambda: model.generate_content(
                        prompt,
                        generation_config=genai.GenerationConfig(
                            response_mime_type="application/json",
                        ),
                    ),
                ),
                timeout=self.config.timeout_seconds,
            )

            return self._parse_llm_response(response.text)

        except asyncio.TimeoutError:
            logger.warning(
                "Observer LLM call timed out after %ds", self.config.timeout_seconds
            )
            return None
        except Exception:
            logger.warning("Observer LLM call failed", exc_info=True)
            return None

    # ── Prompt building ───────────────────────────────────────────

    def _build_prompt(self, events: list[SessionEvent]) -> str:
        """Build the full prompt for the observer LLM."""
        # Load system prompt
        prompt_path = Path(__file__).parent.parent / "prompts" / "observer.md"
        try:
            system_prompt = prompt_path.read_text(encoding="utf-8")
        except OSError:
            system_prompt = "Extract structured observations from the session events below as a JSON array."

        # Format events
        event_lines = []
        for ev in events[-100:]:  # Cap to last 100 events
            event_lines.append(
                f"[{ev.timestamp}] {ev.event_type}: {json.dumps(ev.data, default=str)[:500]}"
            )

        # Previous observations for dedup context
        existing = self.store.list(
            spec_id=self.spec_id, limit=self.config.max_in_prompt
        )
        prev_lines = [f"- [{o.category.value}] {o.content}" for o in existing]

        parts = [
            system_prompt,
            "\n## SESSION CONTEXT\n",
            f"- Spec: {self.spec_id}",
            f"- Project: {self.project_id}",
            f"- Session: {self.session_num}",
            "\n## SESSION EVENTS\n",
            "\n".join(event_lines) if event_lines else "(no events)",
            "\n## PREVIOUS OBSERVATIONS\n",
            "\n".join(prev_lines) if prev_lines else "(none)",
        ]

        return "\n".join(parts)

    # ── Response parsing ──────────────────────────────────────────

    def _parse_llm_response(self, text: str) -> list[Observation] | None:
        """Parse LLM JSON response into Observation objects."""
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            logger.warning("Observer LLM returned invalid JSON")
            return None

        if not isinstance(data, list):
            logger.warning("Observer LLM response is not a JSON array")
            return None

        observations: list[Observation] = []
        for item in data[:7]:  # Cap at 7 per prompt contract
            try:
                category = ObservationCategory(item.get("category", "code_pattern"))
                priority = ObservationPriority(item.get("priority", "medium"))
                content = str(item.get("content", ""))[:200]
                if not content:
                    continue

                observations.append(
                    Observation(
                        category=category,
                        content=content,
                        source=f"session:{self.spec_id}:s{self.session_num}",
                        priority=priority,
                        file_path=item.get("source_file"),
                        metadata={
                            "session_event_type": item.get(
                                "session_event_type", "unknown"
                            ),
                            "extracted_by": "llm",
                            "model": self.config.model,
                        },
                    )
                )
            except (ValueError, KeyError) as e:
                logger.debug("Skipping malformed observation item: %s", e)

        return observations if observations else None

    # ── Helpers ────────────────────────────────────────────────────

    def _buffer_token_estimate(self) -> int:
        """Rough token estimate of current buffer (4 chars ≈ 1 token)."""
        total_chars = sum(
            len(ev.event_type) + len(json.dumps(ev.data, default=str))
            for ev in self._buffer
        )
        return total_chars // 4
