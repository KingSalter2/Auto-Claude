import { describe, it, expect, beforeEach } from 'vitest';
import { usePhase4Store } from '../phase4-store';

describe('usePhase4Store', () => {
  beforeEach(() => {
    const state = usePhase4Store.getState();
    state.clearDependencies();
    state.setMetrics({
      stateCounts: { new: 0, triage: 0, ready: 0, in_progress: 0, review: 0, done: 0, blocked: 0 },
      avgTimeInState: { new: 0, triage: 0, ready: 0, in_progress: 0, review: 0, done: 0, blocked: 0 },
      weeklyThroughput: [],
      completenessDistribution: { low: 0, medium: 0, high: 0, excellent: 0 },
      avgBacklogAge: 0,
      totalTransitions: 0,
      computedAt: '',
    });
    state.setMetricsError(null);
    state.setTriageModeEnabled(false);
  });

  describe('dependencies', () => {
    it('returns empty dependencies for unknown issue', () => {
      const deps = usePhase4Store.getState().getDependencies(999);
      expect(deps.tracks).toEqual([]);
      expect(deps.trackedBy).toEqual([]);
    });

    it('setDependencies stores per-issue data', () => {
      const deps = {
        tracks: [{ issueNumber: 10, title: 'Sub', state: 'open' as const }],
        trackedBy: [],
      };
      usePhase4Store.getState().setDependencies(42, deps);

      expect(usePhase4Store.getState().getDependencies(42)).toEqual(deps);
    });

    it('setDependencyLoading tracks loading state', () => {
      usePhase4Store.getState().setDependencyLoading(42, true);
      expect(usePhase4Store.getState().isDependencyLoading(42)).toBe(true);

      usePhase4Store.getState().setDependencyLoading(42, false);
      expect(usePhase4Store.getState().isDependencyLoading(42)).toBe(false);
    });

    it('setDependencyError stores error and clears loading', () => {
      usePhase4Store.getState().setDependencyLoading(42, true);
      usePhase4Store.getState().setDependencyError(42, 'API unavailable');

      const state = usePhase4Store.getState();
      expect(state.dependencyErrors[42]).toBe('API unavailable');
      expect(state.isDependencyLoading(42)).toBe(false);
    });

    it('clearDependencies removes all cached data', () => {
      usePhase4Store.getState().setDependencies(1, { tracks: [], trackedBy: [] });
      usePhase4Store.getState().setDependencies(2, { tracks: [], trackedBy: [] });

      usePhase4Store.getState().clearDependencies();

      expect(Object.keys(usePhase4Store.getState().dependencies)).toHaveLength(0);
    });
  });

  describe('metrics', () => {
    it('has default empty metrics', () => {
      const state = usePhase4Store.getState();
      expect(state.metrics.totalTransitions).toBe(0);
      expect(state.metricsTimeWindow).toBe('30d');
    });

    it('setMetrics updates metrics and clears loading/error', () => {
      usePhase4Store.getState().setMetricsLoading(true);
      usePhase4Store.getState().setMetrics({
        stateCounts: { new: 5, triage: 3, ready: 0, in_progress: 0, review: 0, done: 0, blocked: 0 },
        avgTimeInState: { new: 0, triage: 0, ready: 0, in_progress: 0, review: 0, done: 0, blocked: 0 },
        weeklyThroughput: [{ week: '2026-02-10', count: 8 }],
        completenessDistribution: { low: 1, medium: 2, high: 3, excellent: 2 },
        avgBacklogAge: 86400000,
        totalTransitions: 15,
        computedAt: '2026-02-12T00:00:00Z',
      });

      const state = usePhase4Store.getState();
      expect(state.metrics.totalTransitions).toBe(15);
      expect(state.metrics.stateCounts.new).toBe(5);
      expect(state.metricsLoading).toBe(false);
      expect(state.metricsError).toBeNull();
    });

    it('setMetricsTimeWindow updates window', () => {
      usePhase4Store.getState().setMetricsTimeWindow('7d');
      expect(usePhase4Store.getState().metricsTimeWindow).toBe('7d');
    });

    it('setMetricsError stores error and clears loading', () => {
      usePhase4Store.getState().setMetricsLoading(true);
      usePhase4Store.getState().setMetricsError('Computation failed');

      const state = usePhase4Store.getState();
      expect(state.metricsError).toBe('Computation failed');
      expect(state.metricsLoading).toBe(false);
    });
  });

  describe('triage mode', () => {
    it('defaults to disabled', () => {
      expect(usePhase4Store.getState().triageModeEnabled).toBe(false);
    });

    it('setTriageModeEnabled toggles triage mode', () => {
      usePhase4Store.getState().setTriageModeEnabled(true);
      expect(usePhase4Store.getState().triageModeEnabled).toBe(true);

      usePhase4Store.getState().setTriageModeEnabled(false);
      expect(usePhase4Store.getState().triageModeEnabled).toBe(false);
    });
  });
});
