/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLabelSync } from '../useLabelSync';
import { useLabelSyncStore } from '../../../../stores/github/label-sync-store';

// Mock project store
vi.mock('../../../../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: (s: { activeProjectId: string | null }) => unknown) =>
    selector({ activeProjectId: 'test-project' }),
  ),
}));

// Mock window.electronAPI on jsdom window
const mockGithub = {
  getLabelSyncStatus: vi.fn(),
  enableLabelSync: vi.fn(),
  disableLabelSync: vi.fn(),
  syncIssueLabel: vi.fn(),
  saveLabelSyncConfig: vi.fn(),
  bulkLabelSync: vi.fn(),
};

beforeEach(() => {
  (window as unknown as Record<string, unknown>).electronAPI = { github: mockGithub };
});

describe('useLabelSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useLabelSyncStore.getState().reset();
  });

  it('returns initial state', () => {
    const { result } = renderHook(() => useLabelSync());
    expect(result.current.config.enabled).toBe(false);
    expect(result.current.isLoaded).toBe(false);
    expect(result.current.isSyncing).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('loadStatus fetches config from API', async () => {
    mockGithub.getLabelSyncStatus.mockResolvedValue({
      enabled: true,
      lastSyncedAt: '2026-01-01T00:00:00Z',
    });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.loadStatus();
    });

    expect(result.current.config.enabled).toBe(true);
    expect(result.current.isLoaded).toBe(true);
  });

  it('enableSync calls API and updates store', async () => {
    mockGithub.enableLabelSync.mockResolvedValue({
      created: 7, updated: 0, removed: 0, errors: [],
    });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.enableSync();
    });

    expect(mockGithub.enableLabelSync).toHaveBeenCalledWith('test-project');
    expect(result.current.config.enabled).toBe(true);
    expect(result.current.lastResult?.created).toBe(7);
  });

  it('disableSync calls API with cleanup flag', async () => {
    mockGithub.disableLabelSync.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.disableSync(true);
    });

    expect(mockGithub.disableLabelSync).toHaveBeenCalledWith('test-project', true);
    expect(result.current.config.enabled).toBe(false);
  });

  it('syncIssueLabel calls API after debounce when sync is enabled', async () => {
    vi.useFakeTimers();
    mockGithub.syncIssueLabel.mockResolvedValue({ synced: true });
    useLabelSyncStore.getState().setConfig({ enabled: true, lastSyncedAt: 'now' });

    const { result } = renderHook(() => useLabelSync());
    act(() => {
      result.current.syncIssueLabel(42, 'triage', 'new');
    });

    // Not called yet — debounced
    expect(mockGithub.syncIssueLabel).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockGithub.syncIssueLabel).toHaveBeenCalledWith('test-project', 42, 'triage', 'new');
    vi.useRealTimers();
  });

  it('syncIssueLabel skips when sync is disabled', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useLabelSync());
    act(() => {
      result.current.syncIssueLabel(42, 'triage', 'new');
    });

    vi.advanceTimersByTime(2000);
    expect(mockGithub.syncIssueLabel).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('syncIssueLabel debounces rapid calls — only last fires', async () => {
    vi.useFakeTimers();
    mockGithub.syncIssueLabel.mockResolvedValue({ synced: true });
    useLabelSyncStore.getState().setConfig({ enabled: true, lastSyncedAt: 'now' });

    const { result } = renderHook(() => useLabelSync());
    act(() => {
      result.current.syncIssueLabel(42, 'triage', 'new');
      result.current.syncIssueLabel(42, 'ready', 'triage');
      result.current.syncIssueLabel(42, 'in_progress', 'ready');
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(mockGithub.syncIssueLabel).toHaveBeenCalledTimes(1);
    expect(mockGithub.syncIssueLabel).toHaveBeenCalledWith('test-project', 42, 'in_progress', 'ready');
    vi.useRealTimers();
  });

  it('saveConfig persists config', async () => {
    mockGithub.saveLabelSyncConfig.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useLabelSync());
    const config = { enabled: true, lastSyncedAt: '2026-01-01T00:00:00Z' };
    await act(async () => {
      await result.current.saveConfig(config);
    });

    expect(mockGithub.saveLabelSyncConfig).toHaveBeenCalledWith('test-project', config);
    expect(result.current.config.enabled).toBe(true);
  });

  it('bulkLabelSync calls API when sync is enabled', async () => {
    mockGithub.bulkLabelSync.mockResolvedValue({ synced: 3, errors: 0 });
    useLabelSyncStore.getState().setConfig({ enabled: true, lastSyncedAt: 'now' });

    const { result } = renderHook(() => useLabelSync());
    let bulkResult: { synced: number; errors: number } | undefined;
    await act(async () => {
      bulkResult = await result.current.bulkLabelSync([1, 2, 3]);
    });

    expect(mockGithub.bulkLabelSync).toHaveBeenCalledWith('test-project', [1, 2, 3]);
    expect(bulkResult?.synced).toBe(3);
    expect(result.current.isSyncing).toBe(false);
  });

  it('bulkLabelSync skips when sync is disabled', async () => {
    const { result } = renderHook(() => useLabelSync());
    let bulkResult: { synced: number; errors: number } | undefined;
    await act(async () => {
      bulkResult = await result.current.bulkLabelSync([1, 2, 3]);
    });

    expect(mockGithub.bulkLabelSync).not.toHaveBeenCalled();
    expect(bulkResult?.synced).toBe(0);
  });

  it('handles enable error gracefully', async () => {
    mockGithub.enableLabelSync.mockRejectedValue(new Error('Auth failed'));

    const { result } = renderHook(() => useLabelSync());
    await act(async () => {
      await result.current.enableSync();
    });

    expect(result.current.error).toBe('Auth failed');
    expect(result.current.isSyncing).toBe(false);
  });
});
