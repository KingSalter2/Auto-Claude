import { useCallback } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { usePhase4Store } from '../../../stores/github/phase4-store';
import type { MetricsTimeWindow } from '../../../../shared/types/metrics';

// Stable reference to getState — never changes, safe outside of hooks
const getPhase4State = usePhase4Store.getState;

export function useMetrics() {
  const projectId = useProjectStore((s) => s.activeProject?.id ?? null);
  const metrics = usePhase4Store((s) => s.metrics);
  const timeWindow = usePhase4Store((s) => s.metricsTimeWindow);
  const isLoading = usePhase4Store((s) => s.metricsLoading);
  const error = usePhase4Store((s) => s.metricsError);

  const computeMetrics = useCallback(async (overrideWindow?: MetricsTimeWindow) => {
    if (!projectId) return;

    const tw = overrideWindow ?? timeWindow;
    if (overrideWindow) {
      getPhase4State().setMetricsTimeWindow(tw);
    }

    getPhase4State().setMetricsLoading(true);
    try {
      const result = await globalThis.window.electronAPI.github.computeMetrics(projectId, tw);
      getPhase4State().setMetrics(result);
    } catch (err) {
      getPhase4State().setMetricsError(
        err instanceof Error ? err.message : 'Failed to compute metrics',
      );
    }
  }, [projectId, timeWindow]);

  const setTimeWindow = useCallback((tw: MetricsTimeWindow) => {
    getPhase4State().setMetricsTimeWindow(tw);
    // Auto-recompute on window change
    if (projectId) {
      getPhase4State().setMetricsLoading(true);
      globalThis.window.electronAPI.github.computeMetrics(projectId, tw)
        .then((result) => getPhase4State().setMetrics(result))
        .catch((err: unknown) => getPhase4State().setMetricsError(
          err instanceof Error ? err.message : 'Failed to compute metrics',
        ));
    }
  }, [projectId]);

  return {
    metrics,
    timeWindow,
    isLoading,
    error,
    computeMetrics,
    setTimeWindow,
  };
}
