"""Tests for observer prompt builder."""

import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "backend"))

from observer.models import (
    Observation,
    ObservationCategory,
    ObservationPriority,
    ObservationStatus,
)
from observer.prompt_builder import (
    _BUDGET_COMPLEX,
    _BUDGET_SIMPLE,
    _TOKENS_PER_OBSERVATION,
    _estimate_complexity,
    build_observation_block,
)
from observer.store import ObservationStore


@pytest.fixture
def store_dir():
    """Create a temporary directory for store tests."""
    d = tempfile.mkdtemp()
    yield Path(d)


def _make_obs(
    content="test obs",
    priority=ObservationPriority.MEDIUM,
    status=ObservationStatus.ACTIVE,
    pinned=False,
    staleness=0.0,
    spec_id=None,
    category=ObservationCategory.CODE_PATTERN,
) -> Observation:
    """Helper to create an observation with common defaults."""
    metadata = {"staleness_score": staleness}
    if pinned:
        metadata["pinned"] = True
    return Observation(
        category=category,
        content=content,
        source="test",
        priority=priority,
        status=status,
        metadata=metadata,
    )


def _save_to_store(store_dir, observations, spec_id="spec-1"):
    """Save observations into a store."""
    store = ObservationStore(store_dir)
    for obs in observations:
        obs.metadata["spec_id"] = spec_id
        store.save(obs)


@patch("observer.prompt_builder.ObserverConfig")
@patch("observer.prompt_builder._get_observations_dir")
class TestBuildObservationBlock:
    """Tests for build_observation_block()."""

    def _enable_config(self, mock_config):
        cfg = mock_config.from_env.return_value
        cfg.enabled = True
        cfg.max_in_prompt = 100
        return cfg

    def test_empty_store_returns_empty_string(self, mock_get_dir, mock_config):
        """Empty store produces empty string."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert result == ""

    def test_disabled_observer_returns_empty(self, mock_get_dir, mock_config):
        """Disabled observer returns empty string."""
        cfg = mock_config.from_env.return_value
        cfg.enabled = False

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert result == ""

    def test_returns_markdown_with_header(self, mock_get_dir, mock_config):
        """Result contains ## Memory Observations header."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d
        _save_to_store(d, [_make_obs("important finding")])

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert result.startswith("## Memory Observations\n")

    def test_priority_ordering_critical_first(self, mock_get_dir, mock_config):
        """Critical observations appear before high, medium, low."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        _save_to_store(d, [
            _make_obs("low item", priority=ObservationPriority.LOW),
            _make_obs("critical item", priority=ObservationPriority.CRITICAL),
            _make_obs("high item", priority=ObservationPriority.HIGH),
            _make_obs("medium item", priority=ObservationPriority.MEDIUM),
        ])

        result = build_observation_block("proj", "spec-1", "/tmp")

        # Critical section should appear before High Priority section
        assert "### Critical" in result
        assert "### High Priority" in result
        crit_pos = result.index("### Critical")
        high_pos = result.index("### High Priority")
        assert crit_pos < high_pos

        # critical item in Critical section, high item in High Priority section
        assert "critical item" in result
        assert "high item" in result

    def test_pinned_always_included(self, mock_get_dir, mock_config):
        """Pinned observations are always included regardless of budget."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        obs_list = [_make_obs("pinned obs", pinned=True, priority=ObservationPriority.LOW)]
        _save_to_store(d, obs_list)

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert "pinned obs" in result
        assert "📌" in result

    def test_pinned_included_even_with_high_staleness(self, mock_get_dir, mock_config):
        """Pinned observations bypass staleness filter."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        # Pinned with high staleness should still be included
        _save_to_store(d, [_make_obs("stale pinned", pinned=True, staleness=0.95)])

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert "stale pinned" in result

    def test_stale_observations_excluded(self, mock_get_dir, mock_config):
        """Observations with staleness >= 0.8 are excluded."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        _save_to_store(d, [
            _make_obs("fresh", staleness=0.0),
            _make_obs("stale", staleness=0.9),
        ])

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert "fresh" in result
        assert "stale" not in result

    def test_token_budget_drops_low_priority(self, mock_get_dir, mock_config):
        """When many observations, low-priority ones are dropped to fit budget."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        # Simple budget = 3000 tokens / 50 per obs = 60 max
        # Create more than 60 observations
        obs_list = []
        for i in range(40):
            obs_list.append(_make_obs(f"critical-{i}", priority=ObservationPriority.CRITICAL))
        for i in range(40):
            obs_list.append(_make_obs(f"low-{i}", priority=ObservationPriority.LOW))

        _save_to_store(d, obs_list)

        result = build_observation_block("proj", "spec-1", "/tmp")
        # All 40 critical should be included, only 20 of 40 low should fit
        assert "critical-0" in result
        assert "critical-39" in result
        # Some low-priority should be dropped
        assert result.count("[code_pattern] low-") < 40

    def test_dynamic_budget_simple(self, mock_get_dir, mock_config):
        """Simple subtask gets smaller budget (3k tokens)."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        _save_to_store(d, [_make_obs("obs")])

        # No subtask = simple
        result = build_observation_block("proj", "spec-1", "/tmp", subtask=None)
        assert result != ""

    def test_dynamic_budget_complex(self, mock_get_dir, mock_config):
        """Complex subtask gets larger budget (8k tokens = 160 obs)."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        # Create enough obs to exceed simple budget but fit complex
        max_simple = _BUDGET_SIMPLE // _TOKENS_PER_OBSERVATION  # 60
        max_complex = _BUDGET_COMPLEX // _TOKENS_PER_OBSERVATION  # 160
        obs_list = [_make_obs(f"obs-{i}") for i in range(max_simple + 10)]
        _save_to_store(d, obs_list)

        # With complex subtask, all should fit
        subtask = {"complexity": "high", "description": "x"}
        result = build_observation_block("proj", "spec-1", "/tmp", subtask=subtask)

        # Count how many observations appear
        count = result.count("[code_pattern] obs-")
        assert count == max_simple + 10

        # With simple (no subtask), some should be dropped
        result_simple = build_observation_block("proj", "spec-1", "/tmp", subtask=None)
        count_simple = result_simple.count("[code_pattern] obs-")
        assert count_simple == max_simple

    def test_inactive_observations_excluded(self, mock_get_dir, mock_config):
        """Non-active observations are excluded."""
        self._enable_config(mock_config)
        d = Path(tempfile.mkdtemp())
        mock_get_dir.return_value = d

        _save_to_store(d, [
            _make_obs("active one"),
            _make_obs("archived one", status=ObservationStatus.ARCHIVED),
        ])

        result = build_observation_block("proj", "spec-1", "/tmp")
        assert "active one" in result
        assert "archived one" not in result


class TestEstimateComplexity:
    """Tests for _estimate_complexity helper."""

    def test_none_subtask_is_simple(self):
        assert _estimate_complexity(None) == "simple"

    def test_explicit_high_complexity(self):
        assert _estimate_complexity({"complexity": "high"}) == "complex"

    def test_explicit_complex_complexity(self):
        assert _estimate_complexity({"complexity": "complex"}) == "complex"

    def test_long_description_is_complex(self):
        assert _estimate_complexity({"description": "x" * 301}) == "complex"

    def test_many_files_is_complex(self):
        subtask = {"files_to_create": ["a", "b"], "files_to_modify": ["c", "d"]}
        assert _estimate_complexity(subtask) == "complex"

    def test_short_simple_subtask(self):
        assert _estimate_complexity({"description": "short"}) == "simple"
