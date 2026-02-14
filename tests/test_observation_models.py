"""Tests for observer memory system data models."""

import sys
import uuid
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "backend"))

from observer.models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    ObservationStatus,
    SessionEvent,
)


class TestObservationCategory:
    """Tests for ObservationCategory enum."""

    def test_has_exactly_12_values(self):
        assert len(ObservationCategory) == 12

    def test_expected_values(self):
        expected = [
            "architecture_decision",
            "code_pattern",
            "error_resolution",
            "dependency_insight",
            "testing_insight",
            "performance_finding",
            "security_concern",
            "api_behavior",
            "configuration_gotcha",
            "workflow_preference",
            "file_relationship",
            "build_system",
        ]
        assert sorted(e.value for e in ObservationCategory) == sorted(expected)


class TestObservationPriority:
    """Tests for ObservationPriority enum."""

    def test_has_4_values(self):
        assert len(ObservationPriority) == 4

    def test_values(self):
        assert set(e.value for e in ObservationPriority) == {
            "critical", "high", "medium", "low"
        }


class TestObservationStatus:
    """Tests for ObservationStatus enum."""

    def test_has_4_values(self):
        assert len(ObservationStatus) == 4

    def test_values(self):
        assert set(e.value for e in ObservationStatus) == {
            "active", "merged", "pruned", "archived"
        }


class TestObservation:
    """Tests for Observation dataclass."""

    def test_creation_with_required_fields(self):
        obs = Observation(
            category=ObservationCategory.CODE_PATTERN,
            content="Use factory pattern for services",
            source="coder_agent",
        )
        assert obs.category == ObservationCategory.CODE_PATTERN
        assert obs.content == "Use factory pattern for services"
        assert obs.source == "coder_agent"

    def test_default_priority_is_medium(self):
        obs = Observation(
            category=ObservationCategory.CODE_PATTERN,
            content="test",
            source="test",
        )
        assert obs.priority == ObservationPriority.MEDIUM

    def test_default_status_is_active(self):
        obs = Observation(
            category=ObservationCategory.CODE_PATTERN,
            content="test",
            source="test",
        )
        assert obs.status == ObservationStatus.ACTIVE

    def test_default_optional_fields(self):
        obs = Observation(
            category=ObservationCategory.CODE_PATTERN,
            content="test",
            source="test",
        )
        assert obs.context is None
        assert obs.file_path is None
        assert obs.tags == []
        assert obs.metadata == {}

    def test_uuid_generation(self):
        obs = Observation(
            category=ObservationCategory.CODE_PATTERN,
            content="test",
            source="test",
        )
        # Should be a valid UUID
        parsed = uuid.UUID(obs.id)
        assert str(parsed) == obs.id

    def test_unique_ids(self):
        obs1 = Observation(category=ObservationCategory.CODE_PATTERN, content="a", source="s")
        obs2 = Observation(category=ObservationCategory.CODE_PATTERN, content="b", source="s")
        assert obs1.id != obs2.id

    def test_iso_timestamp_generation(self):
        obs = Observation(
            category=ObservationCategory.CODE_PATTERN,
            content="test",
            source="test",
        )
        # Should be parseable as ISO format
        from datetime import datetime
        datetime.fromisoformat(obs.timestamp)

    def test_to_dict(self):
        obs = Observation(
            category=ObservationCategory.SECURITY_CONCERN,
            content="SQL injection risk",
            source="qa_agent",
            priority=ObservationPriority.CRITICAL,
            tags=["security"],
        )
        d = obs.to_dict()
        assert d["category"] == "security_concern"
        assert d["priority"] == "critical"
        assert d["status"] == "active"
        assert d["content"] == "SQL injection risk"
        assert d["tags"] == ["security"]

    def test_from_dict(self):
        data = {
            "category": "error_resolution",
            "content": "Fixed by clearing cache",
            "source": "coder",
            "priority": "high",
            "id": "test-id-123",
            "tags": ["cache"],
        }
        obs = Observation.from_dict(data)
        assert obs.category == ObservationCategory.ERROR_RESOLUTION
        assert obs.priority == ObservationPriority.HIGH
        assert obs.id == "test-id-123"
        assert obs.tags == ["cache"]

    def test_round_trip_serialization(self):
        obs = Observation(
            category=ObservationCategory.ARCHITECTURE_DECISION,
            content="Use event sourcing",
            source="planner",
            priority=ObservationPriority.HIGH,
            context="Design review",
            file_path="apps/backend/core/events.py",
            tags=["architecture", "events"],
            metadata={"reviewed": True},
        )
        restored = Observation.from_dict(obs.to_dict())
        assert restored.category == obs.category
        assert restored.content == obs.content
        assert restored.source == obs.source
        assert restored.priority == obs.priority
        assert restored.status == obs.status
        assert restored.id == obs.id
        assert restored.timestamp == obs.timestamp
        assert restored.context == obs.context
        assert restored.file_path == obs.file_path
        assert restored.tags == obs.tags
        assert restored.metadata == obs.metadata


class TestSessionEvent:
    """Tests for SessionEvent dataclass."""

    def test_creation(self):
        event = SessionEvent(
            event_type="file_read",
            data={"path": "src/main.py"},
            source="coder_agent",
        )
        assert event.event_type == "file_read"
        assert event.data == {"path": "src/main.py"}
        assert event.source == "coder_agent"

    def test_timestamp_generation(self):
        from datetime import datetime
        event = SessionEvent(event_type="test", data={}, source="test")
        datetime.fromisoformat(event.timestamp)

    def test_to_dict(self):
        event = SessionEvent(event_type="error", data={"msg": "fail"}, source="qa")
        d = event.to_dict()
        assert d["event_type"] == "error"
        assert d["data"] == {"msg": "fail"}
        assert d["source"] == "qa"

    def test_round_trip_serialization(self):
        event = SessionEvent(
            event_type="tool_call",
            data={"tool": "grep", "args": ["pattern"]},
            source="coder",
        )
        restored = SessionEvent.from_dict(event.to_dict())
        assert restored.event_type == event.event_type
        assert restored.data == event.data
        assert restored.source == event.source
        assert restored.timestamp == event.timestamp
