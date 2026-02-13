/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkOperations } from '../useBulkOperations';
import { useMutationStore } from '../../../../stores/github/mutation-store';
import type { BulkOperationResult } from '@shared/types/mutations';

// Mock electronAPI.github
const mockGitHub = {
  executeBulk: vi.fn(),
  onBulkProgress: vi.fn(() => vi.fn()),
  onBulkComplete: vi.fn(() => vi.fn()),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as { electronAPI?: unknown }).electronAPI = { github: mockGitHub };
  useMutationStore.setState({
    mutatingIssues: new Set(),
    mutationErrors: new Map(),
    isBulkOperating: false,
    bulkProgress: null,
    bulkResult: null,
  });
});

describe('useBulkOperations', () => {
  it('executeBulk calls IPC and starts bulk operation in store', async () => {
    mockGitHub.executeBulk.mockResolvedValue({
      action: 'close',
      totalItems: 3,
      succeeded: 3,
      failed: 0,
      skipped: 0,
      results: [],
    });

    const { result } = renderHook(() => useBulkOperations('proj-1'));

    await act(async () => {
      await result.current.executeBulk('close', [1, 2, 3]);
    });

    expect(mockGitHub.executeBulk).toHaveBeenCalledWith({
      projectId: 'proj-1',
      action: 'close',
      issueNumbers: [1, 2, 3],
      payload: undefined,
    });
  });

  it('retryFailed extracts failed items and re-executes', async () => {
    mockGitHub.executeBulk.mockResolvedValue({
      action: 'close',
      totalItems: 1,
      succeeded: 1,
      failed: 0,
      skipped: 0,
      results: [{ issueNumber: 2, status: 'success' }],
    });

    const previousResult: BulkOperationResult = {
      action: 'close',
      totalItems: 3,
      succeeded: 1,
      failed: 2,
      skipped: 0,
      results: [
        { issueNumber: 1, status: 'success' },
        { issueNumber: 2, status: 'failed', error: 'rate limit' },
        { issueNumber: 3, status: 'failed', error: 'rate limit' },
      ],
    };

    const { result } = renderHook(() => useBulkOperations('proj-1'));

    await act(async () => {
      await result.current.retryFailed(previousResult);
    });

    expect(mockGitHub.executeBulk).toHaveBeenCalledWith(
      expect.objectContaining({
        issueNumbers: [2, 3],
        action: 'close',
      }),
    );
  });

  it('isOperating reflects bulk state', () => {
    const { result } = renderHook(() => useBulkOperations('proj-1'));
    expect(result.current.isOperating).toBe(false);

    act(() => {
      useMutationStore.getState().startBulkOperation('close', 5);
    });

    expect(result.current.isOperating).toBe(true);
  });

  it('cannot start second bulk while first is running', async () => {
    useMutationStore.setState({ isBulkOperating: true });
    mockGitHub.executeBulk.mockResolvedValue({});

    const { result } = renderHook(() => useBulkOperations('proj-1'));

    await act(async () => {
      await result.current.executeBulk('close', [1, 2]);
    });

    expect(mockGitHub.executeBulk).not.toHaveBeenCalled();
  });

  it('empty issue list is a no-op', async () => {
    const { result } = renderHook(() => useBulkOperations('proj-1'));

    await act(async () => {
      await result.current.executeBulk('close', []);
    });

    expect(mockGitHub.executeBulk).not.toHaveBeenCalled();
  });
});
