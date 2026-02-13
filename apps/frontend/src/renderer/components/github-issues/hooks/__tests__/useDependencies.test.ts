/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDependencies } from '../useDependencies';
import { usePhase4Store } from '../../../../stores/github/phase4-store';

// Mock project store
vi.mock('../../../../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'test-project' }),
  ),
}));

// Mock window.electronAPI on the jsdom window
const mockGithub = {
  fetchDependencies: vi.fn(),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = { github: mockGithub };
});

describe('useDependencies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePhase4Store.getState().clearDependencies();
  });

  it('returns empty dependencies for null issue', () => {
    const { result } = renderHook(() => useDependencies(null));
    expect(result.current.dependencies.tracks).toEqual([]);
    expect(result.current.dependencies.trackedBy).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('auto-fetches dependencies when issue number provided', async () => {
    mockGithub.fetchDependencies.mockResolvedValue({
      tracks: [{ issueNumber: 10, title: 'Sub-task', state: 'open' }],
      trackedBy: [],
    });

    const { result } = renderHook(() => useDependencies(42));

    await waitFor(() => {
      expect(result.current.dependencies.tracks).toHaveLength(1);
    });

    expect(mockGithub.fetchDependencies).toHaveBeenCalledWith('test-project', 42);
  });

  it('handles API error', async () => {
    mockGithub.fetchDependencies.mockResolvedValue({
      error: 'GraphQL unavailable',
      tracks: [],
      trackedBy: [],
    });

    const { result } = renderHook(() => useDependencies(42));

    await waitFor(() => {
      expect(result.current.error).toBe('GraphQL unavailable');
    });
  });

  it('handles fetch exception', async () => {
    mockGithub.fetchDependencies.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDependencies(42));

    await waitFor(() => {
      expect(result.current.error).toBe('Network error');
    });
  });

  it('refetch reloads dependencies', async () => {
    mockGithub.fetchDependencies.mockResolvedValue({ tracks: [], trackedBy: [] });

    const { result } = renderHook(() => useDependencies(42));

    await waitFor(() => {
      expect(mockGithub.fetchDependencies).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      await result.current.refetch();
    });

    expect(mockGithub.fetchDependencies).toHaveBeenCalledTimes(2);
  });
});
