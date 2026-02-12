/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMutations } from '../useMutations';
import { useMutationStore } from '../../../../stores/github/mutation-store';

// Mock electronAPI.github
const mockGitHub = {
  editIssueTitle: vi.fn(),
  editIssueBody: vi.fn(),
  closeIssue: vi.fn(),
  reopenIssue: vi.fn(),
  addIssueComment: vi.fn(),
  addIssueLabels: vi.fn(),
  removeIssueLabels: vi.fn(),
  addIssueAssignees: vi.fn(),
  removeIssueAssignees: vi.fn(),
};

// Setup window.electronAPI mock
beforeEach(() => {
  vi.clearAllMocks();
  (window as { electronAPI?: unknown }).electronAPI = { github: mockGitHub };
  useMutationStore.setState({
    mutatingIssues: new Set(),
    mutationErrors: new Map(),
    isBulkOperating: false,
    bulkProgress: null,
    bulkResult: null,
    selectedIssues: new Set(),
  });
});

describe('useMutations', () => {
  it('editTitle calls IPC and updates store on success', async () => {
    mockGitHub.editIssueTitle.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    let mutationResult: unknown;
    await act(async () => {
      mutationResult = await result.current.editTitle(42, 'New Title');
    });

    expect(mockGitHub.editIssueTitle).toHaveBeenCalledWith('proj-1', 42, 'New Title');
    expect(mutationResult).toEqual({ success: true, issueNumber: 42 });
    expect(useMutationStore.getState().mutatingIssues.has(42)).toBe(false);
  });

  it('editTitle returns validation error for empty string', async () => {
    const { result } = renderHook(() => useMutations('proj-1'));

    let mutationResult: unknown;
    await act(async () => {
      mutationResult = await result.current.editTitle(42, '');
    });

    expect(mockGitHub.editIssueTitle).not.toHaveBeenCalled();
    expect(mutationResult).toEqual(
      expect.objectContaining({ success: false }),
    );
  });

  it('editBody calls IPC on success', async () => {
    mockGitHub.editIssueBody.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.editBody(42, 'Updated body');
    });

    expect(mockGitHub.editIssueBody).toHaveBeenCalledWith('proj-1', 42, 'Updated body');
  });

  it('closeIssue calls IPC', async () => {
    mockGitHub.closeIssue.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.closeIssue(42);
    });

    expect(mockGitHub.closeIssue).toHaveBeenCalledWith('proj-1', 42);
  });

  it('reopenIssue calls IPC', async () => {
    mockGitHub.reopenIssue.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.reopenIssue(42);
    });

    expect(mockGitHub.reopenIssue).toHaveBeenCalledWith('proj-1', 42);
  });

  it('addComment calls IPC', async () => {
    mockGitHub.addIssueComment.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.addComment(42, 'Some comment');
    });

    expect(mockGitHub.addIssueComment).toHaveBeenCalledWith('proj-1', 42, 'Some comment');
  });

  it('addLabels calls IPC', async () => {
    mockGitHub.addIssueLabels.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.addLabels(42, ['bug']);
    });

    expect(mockGitHub.addIssueLabels).toHaveBeenCalledWith('proj-1', 42, ['bug']);
  });

  it('removeLabels calls IPC', async () => {
    mockGitHub.removeIssueLabels.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.removeLabels(42, ['bug']);
    });

    expect(mockGitHub.removeIssueLabels).toHaveBeenCalledWith('proj-1', 42, ['bug']);
  });

  it('addAssignees calls IPC', async () => {
    mockGitHub.addIssueAssignees.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.addAssignees(42, ['octocat']);
    });

    expect(mockGitHub.addIssueAssignees).toHaveBeenCalledWith('proj-1', 42, ['octocat']);
  });

  it('removeAssignees calls IPC', async () => {
    mockGitHub.removeIssueAssignees.mockResolvedValue({ success: true, issueNumber: 42 });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.removeAssignees(42, ['octocat']);
    });

    expect(mockGitHub.removeIssueAssignees).toHaveBeenCalledWith('proj-1', 42, ['octocat']);
  });

  it('sets mutation error on IPC failure', async () => {
    mockGitHub.editIssueTitle.mockResolvedValue({ success: false, issueNumber: 42, error: 'gh failed' });

    const { result } = renderHook(() => useMutations('proj-1'));

    await act(async () => {
      await result.current.editTitle(42, 'Title');
    });

    expect(useMutationStore.getState().mutationErrors.get(42)).toBe('gh failed');
  });

  it('isMutating returns true during operation', async () => {
    let resolveIpc: (value: unknown) => void;
    mockGitHub.editIssueTitle.mockReturnValue(
      new Promise((resolve) => { resolveIpc = resolve; }),
    );

    const { result } = renderHook(() => useMutations('proj-1'));

    // Start mutation
    let promise: Promise<unknown>;
    act(() => {
      promise = result.current.editTitle(42, 'Title');
    });

    // While pending, isMutating should be true
    expect(result.current.isMutating(42)).toBe(true);

    // Resolve
    await act(async () => {
      resolveIpc!({ success: true, issueNumber: 42 });
      await promise!;
    });

    expect(result.current.isMutating(42)).toBe(false);
  });
});
