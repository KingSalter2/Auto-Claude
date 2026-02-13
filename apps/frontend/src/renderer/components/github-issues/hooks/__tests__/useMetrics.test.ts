/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMetrics } from '../useMetrics';
import { usePhase4Store } from '../../../../stores/github/phase4-store';
import { createEmptyMetrics } from '../../../../../shared/types/metrics';

// Mock project store
vi.mock('../../../../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'test-project' }),
  ),
}));

// Mock window.electronAPI on jsdom window
const mockGithub = {
  computeMetrics: vi.fn(),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = { github: mockGithub };
});

describe('useMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePhase4Store.getState().setMetrics(createEmptyMetrics());
    usePhase4Store.getState().setMetricsError(null);
    usePhase4Store.getState().setMetricsTimeWindow('30d');
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useMetrics());
    expect(result.current.metrics.totalTransitions).toBe(0);
    expect(result.current.timeWindow).toBe('30d');
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('computeMetrics fetches from API', async () => {
    const mockMetrics = {
      ...createEmptyMetrics(),
      totalTransitions: 42,
      computedAt: '2026-02-12T00:00:00Z',
    };
    mockGithub.computeMetrics.mockResolvedValue(mockMetrics);

    const { result } = renderHook(() => useMetrics());
    await act(async () => {
      await result.current.computeMetrics();
    });

    expect(mockGithub.computeMetrics).toHaveBeenCalledWith('test-project', '30d');
    expect(result.current.metrics.totalTransitions).toBe(42);
    expect(result.current.isLoading).toBe(false);
  });

  it('computeMetrics with override window', async () => {
    mockGithub.computeMetrics.mockResolvedValue(createEmptyMetrics());

    const { result } = renderHook(() => useMetrics());
    await act(async () => {
      await result.current.computeMetrics('7d');
    });

    expect(mockGithub.computeMetrics).toHaveBeenCalledWith('test-project', '7d');
  });

  it('handles compute error', async () => {
    mockGithub.computeMetrics.mockRejectedValue(new Error('Timeout'));

    const { result } = renderHook(() => useMetrics());
    await act(async () => {
      await result.current.computeMetrics();
    });

    expect(result.current.error).toBe('Timeout');
    expect(result.current.isLoading).toBe(false);
  });

  it('setTimeWindow updates window and auto-recomputes', async () => {
    mockGithub.computeMetrics.mockResolvedValue(createEmptyMetrics());

    const { result } = renderHook(() => useMetrics());
    act(() => {
      result.current.setTimeWindow('all');
    });

    expect(usePhase4Store.getState().metricsTimeWindow).toBe('all');
    expect(mockGithub.computeMetrics).toHaveBeenCalledWith('test-project', 'all');
  });
});
