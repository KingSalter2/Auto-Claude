"""Tests for ObservationStore CRUD and persistence."""

import json
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "backend"))

from observer.models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    ObservationStatus,
)
from observer.store import ObservationStore


@pytest.fixture
def store_dir():
    """Create a temporary directory for store tests."""
    d = tempfile.mkdtemp()
    yield Path(d)


@pytest.fixture
def store(store_dir):
    """Create an ObservationStore backed by a temp directory."""
    return ObservationStore(store_dir)


def _make_obs(**kwargs) -> Observation:
    """Helper to create an observation with defaults."""
    defaults = {
        "category": ObservationCategory.CODE_PATTERN,
        "content": "test content",
        "source": "test_agent",
    }
    defaults.update(kwargs)
    return Observation(**defaults)


class TestCRUD:
    """Test create, read, list, update, delete operations."""

    def test_save_and_get(self, store):
        obs = _make_obs(content="save me")
        store.save(obs)
        loaded = store.get(obs.id)
        assert loaded is not None
        assert loaded.content == "save me"
        assert loaded.id == obs.id

    def test_get_nonexistent_returns_none(self, store):
        assert store.get("nonexistent-id") is None

    def test_list_empty(self, store):
        assert store.list() == []

    def test_list_returns_saved(self, store):
        obs1 = _make_obs(content="first")
        obs2 = _make_obs(content="second")
        store.save(obs1)
        store.save(obs2)
        results = store.list()
        assert len(results) == 2

    def test_update(self, store):
        obs = _make_obs(content="original")
        store.save(obs)
        updated = store.update(obs.id, {"content": "modified"})
        assert updated is not None
        assert updated.content == "modified"
        # Verify persistence
        reloaded = store.get(obs.id)
        assert reloaded.content == "modified"

    def test_update_redacts_secrets(self, store):
        obs = _make_obs(content="clean content", context="clean context")
        store.save(obs)
        updated = store.update(obs.id, {
            "content": "has password=secret123 inside",
            "context": "api_key=AKIAIOSFODNN7EXAMPLE here",
        })
        assert updated is not None
        assert "secret123" not in updated.content
        assert "[REDACTED]" in updated.content
        assert "AKIAIOSFODNN7EXAMPLE" not in updated.context
        assert "[REDACTED]" in updated.context
        # Verify persistence
        reloaded = store.get(obs.id)
        assert "secret123" not in reloaded.content
        assert "AKIAIOSFODNN7EXAMPLE" not in reloaded.context

    def test_update_nonexistent_returns_none(self, store):
        assert store.update("no-such-id", {"content": "x"}) is None

    def test_delete(self, store):
        obs = _make_obs()
        store.save(obs)
        assert store.delete(obs.id) is True
        assert store.get(obs.id) is None

    def test_delete_nonexistent_returns_false(self, store):
        assert store.delete("no-such-id") is False


class TestPersistence:
    """Test file persistence across store instances."""

    def test_data_survives_new_instance(self, store_dir):
        store1 = ObservationStore(store_dir)
        obs = _make_obs(content="persistent")
        store1.save(obs)

        store2 = ObservationStore(store_dir)
        loaded = store2.get(obs.id)
        assert loaded is not None
        assert loaded.content == "persistent"

    def test_json_validity(self, store, store_dir):
        obs = _make_obs(content="valid json check")
        store.save(obs)
        json_path = store_dir / "observations" / f"{obs.id}.json"
        assert json_path.exists()
        with open(json_path, encoding="utf-8") as f:
            data = json.load(f)
        assert data["content"] == "valid json check"
        assert data["category"] == "code_pattern"


class TestSearch:
    """Test search by query string."""

    def test_search_content(self, store):
        store.save(_make_obs(content="use factory pattern"))
        store.save(_make_obs(content="singleton is fine"))
        results = store.search("factory")
        assert len(results) == 1
        assert "factory" in results[0].content

    def test_search_tags(self, store):
        store.save(_make_obs(content="something", tags=["perf", "cache"]))
        store.save(_make_obs(content="other"))
        results = store.search("cache")
        assert len(results) == 1

    def test_search_case_insensitive(self, store):
        store.save(_make_obs(content="Use Factory Pattern"))
        results = store.search("factory")
        assert len(results) == 1

    def test_search_no_results(self, store):
        store.save(_make_obs(content="hello"))
        assert store.search("zzzzz") == []


class TestFiltering:
    """Test filter by category and priority."""

    def test_filter_by_category(self, store):
        store.save(_make_obs(category=ObservationCategory.CODE_PATTERN))
        store.save(_make_obs(category=ObservationCategory.SECURITY_CONCERN))
        results = store.list(category=ObservationCategory.CODE_PATTERN)
        assert len(results) == 1
        assert results[0].category == ObservationCategory.CODE_PATTERN

    def test_filter_by_category_string(self, store):
        store.save(_make_obs(category=ObservationCategory.SECURITY_CONCERN))
        results = store.list(category="security_concern")
        assert len(results) == 1

    def test_filter_by_priority(self, store):
        store.save(_make_obs(priority=ObservationPriority.CRITICAL))
        store.save(_make_obs(priority=ObservationPriority.LOW))
        results = store.list(priority=ObservationPriority.CRITICAL)
        assert len(results) == 1
        assert results[0].priority == ObservationPriority.CRITICAL

    def test_filter_by_priority_string(self, store):
        store.save(_make_obs(priority=ObservationPriority.HIGH))
        results = store.list(priority="high")
        assert len(results) == 1


class TestPromote:
    """Test promote from spec-level to project-level."""

    def test_promote_sets_metadata(self, store):
        obs = _make_obs(metadata={"spec_id": "042"})
        store.save(obs)
        promoted = store.promote(obs.id)
        assert promoted is not None
        assert promoted.metadata["promoted"] is True
        assert promoted.metadata["promoted_from"] == "042"

    def test_promote_persists(self, store):
        obs = _make_obs(metadata={"spec_id": "007"})
        store.save(obs)
        store.promote(obs.id)
        reloaded = store.get(obs.id)
        assert reloaded.metadata["promoted"] is True

    def test_promote_nonexistent_returns_none(self, store):
        assert store.promote("nope") is None


class TestArchiveRestore:
    """Test archive and restore operations."""

    def test_archive_removes_from_active(self, store):
        obs = _make_obs()
        store.save(obs)
        assert store.archive(obs.id) is True
        assert store.get(obs.id) is None

    def test_archive_nonexistent_returns_false(self, store):
        assert store.archive("no-id") is False

    def test_restore_returns_observation(self, store):
        obs = _make_obs(content="restore me")
        store.save(obs)
        store.archive(obs.id)
        restored = store.restore(obs.id)
        assert restored is not None
        assert restored.content == "restore me"
        assert restored.status == ObservationStatus.ACTIVE

    def test_restore_makes_gettable(self, store):
        obs = _make_obs()
        store.save(obs)
        store.archive(obs.id)
        store.restore(obs.id)
        assert store.get(obs.id) is not None

    def test_restore_nonexistent_returns_none(self, store):
        assert store.restore("no-id") is None


class TestStats:
    """Test get_stats returns correct counts."""

    def test_empty_stats(self, store):
        stats = store.get_stats()
        assert stats["total"] == 0
        assert stats["by_category"] == {}

    def test_stats_counts(self, store):
        store.save(_make_obs(category=ObservationCategory.CODE_PATTERN))
        store.save(_make_obs(category=ObservationCategory.CODE_PATTERN))
        store.save(_make_obs(category=ObservationCategory.SECURITY_CONCERN))
        stats = store.get_stats()
        assert stats["total"] == 3
        assert stats["by_category"]["code_pattern"] == 2
        assert stats["by_category"]["security_concern"] == 1


class TestCorruptedFileRecovery:
    """Test graceful handling of corrupted data."""

    def test_corrupted_json_returns_none(self, store, store_dir):
        obs = _make_obs()
        store.save(obs)
        # Corrupt the file
        json_path = store_dir / "observations" / f"{obs.id}.json"
        json_path.write_text("NOT VALID JSON {{{", encoding="utf-8")
        assert store.get(obs.id) is None

    def test_corrupted_file_skipped_in_list(self, store, store_dir):
        good = _make_obs(content="good")
        bad = _make_obs(content="bad")
        store.save(good)
        store.save(bad)
        # Corrupt one file
        bad_path = store_dir / "observations" / f"{bad.id}.json"
        bad_path.write_text("{invalid", encoding="utf-8")
        results = store.list()
        assert len(results) == 1
        assert results[0].content == "good"

    def test_corrupted_file_skipped_in_search(self, store, store_dir):
        good = _make_obs(content="findable")
        store.save(good)
        # Write a corrupt file directly
        corrupt_path = store_dir / "observations" / "corrupt.json"
        corrupt_path.write_text("broken!", encoding="utf-8")
        results = store.search("findable")
        assert len(results) == 1

    def test_corrupted_file_skipped_in_stats(self, store, store_dir):
        store.save(_make_obs())
        corrupt_path = store_dir / "observations" / "bad.json"
        corrupt_path.write_text("nope", encoding="utf-8")
        stats = store.get_stats()
        assert stats["total"] == 1
