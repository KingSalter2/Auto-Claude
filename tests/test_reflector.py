"""Tests for observer.reflector — SimpleReflector."""

from datetime import datetime, timedelta

import pytest

from observer.models import (
    Observation,
    ObservationCategory,
    ObservationStatus,
)
from observer.reflector import SimpleReflector


def _make_obs(
    content: str = "test observation",
    category: ObservationCategory = ObservationCategory.CODE_PATTERN,
    timestamp: str | None = None,
    pinned: bool = False,
    status: ObservationStatus = ObservationStatus.ACTIVE,
    obs_id: str | None = None,
) -> Observation:
    meta = {"pinned": True} if pinned else {}
    return Observation(
        category=category,
        content=content,
        source="test",
        status=status,
        timestamp=timestamp or datetime.utcnow().isoformat(),
        metadata=meta,
        **({"id": obs_id} if obs_id else {}),
    )


@pytest.fixture
def reflector():
    return SimpleReflector()


# ── jaccard_similarity ────────────────────────────────────────


class TestJaccardSimilarity:
    def test_identical_strings(self):
        assert SimpleReflector.jaccard_similarity("hello world", "hello world") == 1.0

    def test_very_similar_strings(self):
        score = SimpleReflector.jaccard_similarity(
            "the quick brown fox jumps over the lazy dog today",
            "the quick brown fox jumps over the lazy dog yesterday",
        )
        assert score >= 0.8

    def test_dissimilar_strings(self):
        score = SimpleReflector.jaccard_similarity(
            "python backend server database",
            "react frontend component styling",
        )
        assert score < 0.5

    def test_empty_strings(self):
        assert SimpleReflector.jaccard_similarity("", "") == 1.0

    def test_one_empty(self):
        assert SimpleReflector.jaccard_similarity("hello", "") == 0.0


# ── is_duplicate ──────────────────────────────────────────────


class TestIsDuplicate:
    def test_duplicate_same_category_high_similarity(self, reflector):
        a = _make_obs("the quick brown fox jumps over the lazy dog today")
        b = _make_obs("the quick brown fox jumps over the lazy dog yesterday")
        assert reflector.is_duplicate(a, b) is True

    def test_not_duplicate_different_category(self, reflector):
        a = _make_obs("same content here", category=ObservationCategory.CODE_PATTERN)
        b = _make_obs("same content here", category=ObservationCategory.ERROR_RESOLUTION)
        assert reflector.is_duplicate(a, b) is False

    def test_not_duplicate_low_similarity(self, reflector):
        a = _make_obs("python backend server")
        b = _make_obs("react frontend component")
        assert reflector.is_duplicate(a, b) is False


# ── deduplicate ───────────────────────────────────────────────


class TestDeduplicate:
    def test_removes_duplicates_keeps_newest(self, reflector):
        old_time = (datetime.utcnow() - timedelta(hours=2)).isoformat()
        new_time = datetime.utcnow().isoformat()

        old = _make_obs("the quick brown fox jumps over the lazy dog today", timestamp=old_time, obs_id="old")
        new = _make_obs("the quick brown fox jumps over the lazy dog yesterday", timestamp=new_time, obs_id="new")

        result = reflector.deduplicate([old, new])
        assert len(result) == 1
        assert result[0].id == "new"

    def test_no_duplicates_keeps_all(self, reflector):
        a = _make_obs("python backend server")
        b = _make_obs("react frontend component")
        result = reflector.deduplicate([a, b])
        assert len(result) == 2


# ── enforce_limits ────────────────────────────────────────────


class TestEnforceLimits:
    def test_keeps_only_n_per_category(self):
        obs_list = [
            _make_obs(f"observation {i}", timestamp=(datetime.utcnow() - timedelta(minutes=i)).isoformat())
            for i in range(10)
        ]
        result = SimpleReflector.enforce_limits(obs_list, max_per_category=3)
        assert len(result) == 3

    def test_pinned_always_kept(self):
        pinned = [_make_obs(f"pinned {i}", pinned=True) for i in range(5)]
        unpinned = [
            _make_obs(f"unpinned {i}", timestamp=(datetime.utcnow() - timedelta(minutes=i)).isoformat())
            for i in range(5)
        ]
        result = SimpleReflector.enforce_limits(pinned + unpinned, max_per_category=3)
        pinned_in_result = [o for o in result if o.metadata.get("pinned")]
        assert len(pinned_in_result) == 5  # all pinned kept


# ── auto_archive ──────────────────────────────────────────────


class TestAutoArchive:
    def test_archives_old_observations(self):
        old_time = (datetime.utcnow() - timedelta(days=35)).isoformat()
        old_obs = _make_obs("old observation", timestamp=old_time)
        new_obs = _make_obs("new observation")

        kept, to_archive = SimpleReflector.auto_archive([old_obs, new_obs])
        assert len(to_archive) == 1
        assert to_archive[0].content == "old observation"
        assert len(kept) == 1

    def test_pinned_never_archived(self):
        old_time = (datetime.utcnow() - timedelta(days=35)).isoformat()
        pinned_old = _make_obs("pinned old", timestamp=old_time, pinned=True)

        kept, to_archive = SimpleReflector.auto_archive([pinned_old])
        assert len(to_archive) == 0
        assert len(kept) == 1
        assert kept[0].content == "pinned old"

    def test_already_archived_stays_kept(self):
        old_time = (datetime.utcnow() - timedelta(days=35)).isoformat()
        archived = _make_obs("archived", timestamp=old_time, status=ObservationStatus.ARCHIVED)

        kept, to_archive = SimpleReflector.auto_archive([archived])
        assert len(to_archive) == 0
        assert len(kept) == 1
