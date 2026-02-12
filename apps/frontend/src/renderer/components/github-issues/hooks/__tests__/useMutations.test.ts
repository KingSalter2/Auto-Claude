/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMutations } from '../useMutations';
import { useMutationStore } from '../../../../stores/github/mutation-store';
import { useIssuesStore } from '../../../../stores/github/issues-store';
import type { GitHubIssue } from '../../../../../shared/types';

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

const baseIssue: GitHubIssue = {
  id: 1, number: 42, title: 'Test', body: 'Body', state: 'open',
  htmlUrl: '', author: { login: 'u' }, labels: [{ id: 1, name: 'bug', color: 'ff0000' }],
  assignees: [{ login: 'dev1' }], commentsCount: 3,
  createdAt: '', updatedAt: '', milestone: null,
} as GitHubIssue;

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
  useIssuesStore.setState({ issues: [baseIssue] });
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

  it('editTitle updates issues-store on success', async () => {
    mockGitHub.editIssueTitle.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.editTitle(42, 'New Title'); });
    expect(useIssuesStore.getState().issues[0].title).toBe('New Title');
  });

  it('closeIssue updates state to closed in issues-store', async () => {
    mockGitHub.closeIssue.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.closeIssue(42); });
    expect(useIssuesStore.getState().issues[0].state).toBe('closed');
  });

  it('reopenIssue updates state to open in issues-store', async () => {
    useIssuesStore.setState({ issues: [{ ...baseIssue, state: 'closed' }] });
    mockGitHub.reopenIssue.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.reopenIssue(42); });
    expect(useIssuesStore.getState().issues[0].state).toBe('open');
  });

  it('addComment increments commentsCount in issues-store', async () => {
    mockGitHub.addIssueComment.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.addComment(42, 'Hello'); });
    expect(useIssuesStore.getState().issues[0].commentsCount).toBe(4);
  });

  it('addLabels merges new labels into issues-store', async () => {
    mockGitHub.addIssueLabels.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.addLabels(42, ['feature']); });
    const labels = useIssuesStore.getState().issues[0].labels.map(l => l.name);
    expect(labels).toContain('bug');
    expect(labels).toContain('feature');
  });

  it('removeLabels removes labels from issues-store', async () => {
    mockGitHub.removeIssueLabels.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.removeLabels(42, ['bug']); });
    expect(useIssuesStore.getState().issues[0].labels).toHaveLength(0);
  });

  it('addAssignees merges new assignees into issues-store', async () => {
    mockGitHub.addIssueAssignees.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.addAssignees(42, ['dev2']); });
    const assignees = useIssuesStore.getState().issues[0].assignees.map(a => a.login);
    expect(assignees).toContain('dev1');
    expect(assignees).toContain('dev2');
  });

  it('removeAssignees removes assignees from issues-store', async () => {
    mockGitHub.removeIssueAssignees.mockResolvedValue({ success: true, issueNumber: 42 });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.removeAssignees(42, ['dev1']); });
    expect(useIssuesStore.getState().issues[0].assignees).toHaveLength(0);
  });

  it('does not update issues-store on mutation failure', async () => {
    mockGitHub.editIssueTitle.mockResolvedValue({ success: false, issueNumber: 42, error: 'failed' });
    const { result } = renderHook(() => useMutations('proj-1'));
    await act(async () => { await result.current.editTitle(42, 'New'); });
    expect(useIssuesStore.getState().issues[0].title).toBe('Test');
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
