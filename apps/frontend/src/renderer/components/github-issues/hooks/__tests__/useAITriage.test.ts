/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAITriage } from '../useAITriage';
import { useAITriageStore } from '../../../../stores/github/ai-triage-store';

// Mock electronAPI.github
const mockGitHub = {
  runEnrichment: vi.fn(),
  onEnrichmentProgress: vi.fn(() => vi.fn()),
  onEnrichmentError: vi.fn(() => vi.fn()),
  onEnrichmentComplete: vi.fn(() => vi.fn()),
  runSplitSuggestion: vi.fn(),
  onSplitProgress: vi.fn(() => vi.fn()),
  onSplitError: vi.fn(() => vi.fn()),
  onSplitComplete: vi.fn(() => vi.fn()),
  createIssue: vi.fn(),
  closeIssue: vi.fn(),
  applyTriageResults: vi.fn(),
  onApplyResultsProgress: vi.fn(() => vi.fn()),
  onApplyResultsComplete: vi.fn(() => vi.fn()),
  saveProgressiveTrust: vi.fn(),
  getProgressiveTrust: vi.fn(),
  transitionWorkflowState: vi.fn(),
  addIssueComment: vi.fn(),
  saveEnrichment: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as { electronAPI?: unknown }).electronAPI = { github: mockGitHub };
  useAITriageStore.setState({
    isTriaging: false,
    triageProgress: null,
    reviewItems: [],
    enrichmentProgress: null,
    splitSuggestion: null,
    splitProgress: null,
  });
});

describe('useAITriage', () => {
  it('runEnrichment calls IPC', () => {
    const { result } = renderHook(() => useAITriage('proj-1'));

    act(() => {
      result.current.runEnrichment(42);
    });

    expect(mockGitHub.runEnrichment).toHaveBeenCalledWith('proj-1', 42);
    expect(useAITriageStore.getState().isTriaging).toBe(true);
  });

  it('runSplitSuggestion calls IPC', () => {
    const { result } = renderHook(() => useAITriage('proj-1'));

    act(() => {
      result.current.runSplitSuggestion(42);
    });

    expect(mockGitHub.runSplitSuggestion).toHaveBeenCalledWith('proj-1', 42);
  });

  it('confirmSplit creates sub-issues and closes original', async () => {
    mockGitHub.createIssue
      .mockResolvedValueOnce({ number: 100, url: 'https://github.com/o/r/issues/100' })
      .mockResolvedValueOnce({ number: 101, url: 'https://github.com/o/r/issues/101' });
    mockGitHub.closeIssue.mockResolvedValue({ success: true, issueNumber: 42 });
    mockGitHub.addIssueComment.mockResolvedValue({ success: true });
    mockGitHub.saveEnrichment.mockResolvedValue(true);
    mockGitHub.transitionWorkflowState.mockResolvedValue({});

    const { result } = renderHook(() => useAITriage('proj-1'));

    const subIssues = [
      { title: 'Sub 1', body: 'Body 1', labels: ['bug'] },
      { title: 'Sub 2', body: 'Body 2', labels: [] },
    ];

    let splitResult: unknown;
    await act(async () => {
      splitResult = await result.current.confirmSplit(42, subIssues);
    });

    expect(mockGitHub.createIssue).toHaveBeenCalledTimes(2);
    expect(mockGitHub.closeIssue).toHaveBeenCalledWith('proj-1', 42);
    expect(splitResult).toEqual(
      expect.objectContaining({ createdIssues: [100, 101] }),
    );
  });

  it('confirmSplit posts linking comment on original issue', async () => {
    mockGitHub.createIssue
      .mockResolvedValueOnce({ number: 200, url: 'https://github.com/o/r/issues/200' })
      .mockResolvedValueOnce({ number: 201, url: 'https://github.com/o/r/issues/201' });
    mockGitHub.closeIssue.mockResolvedValue({ success: true, issueNumber: 10 });
    mockGitHub.addIssueComment.mockResolvedValue({ success: true });
    mockGitHub.saveEnrichment.mockResolvedValue(true);
    mockGitHub.transitionWorkflowState.mockResolvedValue({});

    const { result } = renderHook(() => useAITriage('proj-1'));

    const subIssues = [
      { title: 'Sub A', body: 'Body A', labels: [] },
      { title: 'Sub B', body: 'Body B', labels: [] },
    ];

    await act(async () => {
      await result.current.confirmSplit(10, subIssues);
    });

    expect(mockGitHub.addIssueComment).toHaveBeenCalledWith(
      'proj-1',
      10,
      expect.stringContaining('#200'),
    );
    expect(mockGitHub.addIssueComment).toHaveBeenCalledWith(
      'proj-1',
      10,
      expect.stringContaining('#201'),
    );
    expect(mockGitHub.addIssueComment).toHaveBeenCalledWith(
      'proj-1',
      10,
      expect.stringContaining('Split by Auto-Claude'),
    );
  });

  it('confirmSplit creates enrichment entries for sub-issues and updates original', async () => {
    mockGitHub.createIssue
      .mockResolvedValueOnce({ number: 300, url: 'https://github.com/o/r/issues/300' })
      .mockResolvedValueOnce({ number: 301, url: 'https://github.com/o/r/issues/301' });
    mockGitHub.closeIssue.mockResolvedValue({ success: true, issueNumber: 50 });
    mockGitHub.addIssueComment.mockResolvedValue({ success: true });
    mockGitHub.saveEnrichment.mockResolvedValue(true);
    mockGitHub.transitionWorkflowState.mockResolvedValue({});

    const { result } = renderHook(() => useAITriage('proj-1'));

    const subIssues = [
      { title: 'Sub X', body: 'Body X', labels: [] },
      { title: 'Sub Y', body: 'Body Y', labels: [] },
    ];

    await act(async () => {
      await result.current.confirmSplit(50, subIssues);
    });

    // Sub-issue enrichments: 2 sub-issues + 1 original = 3 calls
    expect(mockGitHub.saveEnrichment).toHaveBeenCalledTimes(3);

    // Sub-issue #300 should have splitFrom: 50
    expect(mockGitHub.saveEnrichment).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        issueNumber: 300,
        splitFrom: 50,
      }),
    );

    // Sub-issue #301 should have splitFrom: 50
    expect(mockGitHub.saveEnrichment).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        issueNumber: 301,
        splitFrom: 50,
      }),
    );

    // Original should have splitInto: [300, 301]
    expect(mockGitHub.saveEnrichment).toHaveBeenCalledWith(
      'proj-1',
      expect.objectContaining({
        issueNumber: 50,
        splitInto: [300, 301],
      }),
    );
  });

  it('applyTriageResults calls IPC with accepted items', () => {
    useAITriageStore.getState().addReviewItems([
      {
        issueNumber: 1,
        issueTitle: 'Bug',
        result: {
          category: 'bug',
          confidence: 0.9,
          labelsToAdd: ['bug'],
          labelsToRemove: [],
          isDuplicate: false,
          isSpam: false,
          isFeatureCreep: false,
          suggestedBreakdown: [],
          priority: 'high',
          triagedAt: '2026-01-01T00:00:00Z',
        },
        status: 'accepted',
      },
    ]);

    const { result } = renderHook(() => useAITriage('proj-1'));

    act(() => {
      result.current.applyTriageResults();
    });

    expect(mockGitHub.applyTriageResults).toHaveBeenCalledWith(
      'proj-1',
      expect.arrayContaining([expect.objectContaining({ issueNumber: 1 })]),
    );
  });

  it('acceptResult updates review item status', () => {
    useAITriageStore.getState().addReviewItems([
      {
        issueNumber: 1,
        issueTitle: 'Bug',
        result: {
          category: 'bug',
          confidence: 0.9,
          labelsToAdd: [],
          labelsToRemove: [],
          isDuplicate: false,
          isSpam: false,
          isFeatureCreep: false,
          suggestedBreakdown: [],
          priority: 'high',
          triagedAt: '2026-01-01T00:00:00Z',
        },
        status: 'pending',
      },
    ]);

    const { result } = renderHook(() => useAITriage('proj-1'));

    act(() => {
      result.current.acceptResult(1);
    });

    expect(useAITriageStore.getState().reviewItems[0].status).toBe('accepted');
  });

  it('rejectResult updates review item status', () => {
    useAITriageStore.getState().addReviewItems([
      {
        issueNumber: 1,
        issueTitle: 'Bug',
        result: {
          category: 'bug',
          confidence: 0.9,
          labelsToAdd: [],
          labelsToRemove: [],
          isDuplicate: false,
          isSpam: false,
          isFeatureCreep: false,
          suggestedBreakdown: [],
          priority: 'high',
          triagedAt: '2026-01-01T00:00:00Z',
        },
        status: 'pending',
      },
    ]);

    const { result } = renderHook(() => useAITriage('proj-1'));

    act(() => {
      result.current.rejectResult(1);
    });

    expect(useAITriageStore.getState().reviewItems[0].status).toBe('rejected');
  });

  it('sets up IPC listeners and cleans up on unmount', () => {
    const cleanupFn = vi.fn();
    mockGitHub.onEnrichmentProgress.mockReturnValue(cleanupFn);
    mockGitHub.onEnrichmentError.mockReturnValue(cleanupFn);
    mockGitHub.onEnrichmentComplete.mockReturnValue(cleanupFn);
    mockGitHub.onSplitProgress.mockReturnValue(cleanupFn);
    mockGitHub.onSplitError.mockReturnValue(cleanupFn);
    mockGitHub.onSplitComplete.mockReturnValue(cleanupFn);
    mockGitHub.onApplyResultsProgress.mockReturnValue(cleanupFn);
    mockGitHub.onApplyResultsComplete.mockReturnValue(cleanupFn);

    const { unmount } = renderHook(() => useAITriage('proj-1'));

    expect(mockGitHub.onEnrichmentProgress).toHaveBeenCalled();
    expect(mockGitHub.onEnrichmentComplete).toHaveBeenCalled();
    expect(mockGitHub.onSplitComplete).toHaveBeenCalled();
    expect(mockGitHub.onApplyResultsComplete).toHaveBeenCalled();

    unmount();

    expect(cleanupFn).toHaveBeenCalled();
  });

  it('exposes isTriaging from store', () => {
    useAITriageStore.getState().startTriage();
    const { result } = renderHook(() => useAITriage('proj-1'));
    expect(result.current.isTriaging).toBe(true);
  });
});
