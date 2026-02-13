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
  // biome-ignore lint/suspicious/noExplicitAny: test mock requires flexible callback type
  onEnrichmentError: vi.fn((_cb?: any) => vi.fn()),
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
  removeIssueLabels: vi.fn().mockResolvedValue({ success: true }),
  loadPendingReview: vi.fn().mockResolvedValue([]),
  savePendingReview: vi.fn().mockResolvedValue(true),
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
    lastError: null,
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

  it('enrichment error sets lastError in store', () => {
    // biome-ignore lint/suspicious/noEmptyBlockStatements: placeholder until mock captures callback
    let errorCallback: (projId: string, error: { error: string }) => void = () => {};
    mockGitHub.onEnrichmentError.mockImplementation((cb: (projId: string, error: { error: string }) => void) => {
      errorCallback = cb;
      return vi.fn();
    });

    renderHook(() => useAITriage('proj-1'));

    act(() => {
      errorCallback('proj-1', { error: 'API rate limit exceeded' });
    });

    expect(useAITriageStore.getState().lastError).toBe('API rate limit exceeded');
  });

  it('exposes lastError from store', () => {
    useAITriageStore.getState().setLastError('Test error');
    const { result } = renderHook(() => useAITriage('proj-1'));
    expect(result.current.lastError).toBe('Test error');
  });

  it('applyProgressiveTrust fetches config and auto-applies high-confidence items', async () => {
    mockGitHub.getProgressiveTrust.mockResolvedValue({
      autoApply: {
        type: { enabled: false, threshold: 0.9 },
        priority: { enabled: false, threshold: 0.9 },
        labels: { enabled: true, threshold: 0.85 },
        duplicate: { enabled: false, threshold: 0.9 },
      },
      batchSize: 50,
      confirmAbove: 10,
    });

    useAITriageStore.getState().addReviewItems([
      {
        issueNumber: 1,
        issueTitle: 'High confidence bug',
        result: {
          category: 'bug',
          confidence: 0.95,
          labelsToAdd: ['bug'],
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
      {
        issueNumber: 2,
        issueTitle: 'Low confidence feature',
        result: {
          category: 'feature',
          confidence: 0.6,
          labelsToAdd: ['feature'],
          labelsToRemove: [],
          isDuplicate: false,
          isSpam: false,
          isFeatureCreep: false,
          suggestedBreakdown: [],
          priority: 'low',
          triagedAt: '2026-01-01T00:00:00Z',
        },
        status: 'pending',
      },
    ]);

    const { result } = renderHook(() => useAITriage('proj-1'));

    await act(async () => {
      await result.current.applyProgressiveTrust();
    });

    expect(mockGitHub.getProgressiveTrust).toHaveBeenCalledWith('proj-1');

    const items = useAITriageStore.getState().reviewItems;
    expect(items[0].status).toBe('auto-applied');
    expect(items[1].status).toBe('pending');
  });

  it('loads persisted review items on mount', async () => {
    const persistedItems = [
      {
        issueNumber: 99,
        issueTitle: 'Persisted issue',
        result: {
          category: 'bug',
          confidence: 0.8,
          labelsToAdd: ['bug'],
          labelsToRemove: [],
          isDuplicate: false,
          isSpam: false,
          isFeatureCreep: false,
          suggestedBreakdown: [],
          priority: 'medium' as const,
          triagedAt: '2026-01-01T00:00:00Z',
        },
        status: 'pending' as const,
      },
    ];
    mockGitHub.loadPendingReview.mockResolvedValue(persistedItems);

    await act(async () => {
      renderHook(() => useAITriage('proj-1'));
    });

    expect(mockGitHub.loadPendingReview).toHaveBeenCalledWith('proj-1');
    expect(useAITriageStore.getState().reviewItems).toHaveLength(1);
    expect(useAITriageStore.getState().reviewItems[0].issueNumber).toBe(99);
  });

  it('saves review items when they change', async () => {
    mockGitHub.loadPendingReview.mockResolvedValue([]);

    await act(async () => {
      renderHook(() => useAITriage('proj-1'));
    });

    // Add review items
    act(() => {
      useAITriageStore.getState().addReviewItems([
        {
          issueNumber: 50,
          issueTitle: 'New issue',
          result: {
            category: 'feature',
            confidence: 0.7,
            labelsToAdd: ['feature'],
            labelsToRemove: [],
            isDuplicate: false,
            isSpam: false,
            isFeatureCreep: false,
            suggestedBreakdown: [],
            priority: 'low' as const,
            triagedAt: '2026-01-01T00:00:00Z',
          },
          status: 'pending' as const,
        },
      ]);
    });

    // Wait for the effect to trigger
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(mockGitHub.savePendingReview).toHaveBeenCalledWith(
      'proj-1',
      expect.arrayContaining([expect.objectContaining({ issueNumber: 50 })]),
    );
  });

  it('undoLastBatchWithGitHub removes applied labels from GitHub and restores snapshot', async () => {
    useAITriageStore.getState().addReviewItems([
      {
        issueNumber: 10,
        issueTitle: 'Accepted bug',
        result: {
          category: 'bug',
          confidence: 0.9,
          labelsToAdd: ['bug', 'priority:high'],
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
      {
        issueNumber: 11,
        issueTitle: 'Rejected feature',
        result: {
          category: 'feature',
          confidence: 0.5,
          labelsToAdd: ['feature'],
          labelsToRemove: [],
          isDuplicate: false,
          isSpam: false,
          isFeatureCreep: false,
          suggestedBreakdown: [],
          priority: 'low',
          triagedAt: '2026-01-01T00:00:00Z',
        },
        status: 'pending',
      },
    ]);

    // Snapshot and accept issue 10, reject issue 11
    useAITriageStore.getState().snapshotBeforeApply();
    useAITriageStore.getState().acceptReviewItem(10);
    useAITriageStore.getState().rejectReviewItem(11);

    const { result } = renderHook(() => useAITriage('proj-1'));

    await act(async () => {
      await result.current.undoLastBatchWithGitHub();
    });

    // Should have called removeIssueLabels for the accepted item
    expect(mockGitHub.removeIssueLabels).toHaveBeenCalledWith(
      'proj-1',
      10,
      ['bug', 'priority:high'],
    );

    // Should NOT have called removeIssueLabels for the rejected item
    expect(mockGitHub.removeIssueLabels).not.toHaveBeenCalledWith(
      'proj-1',
      11,
      expect.anything(),
    );

    // Local state should be restored to pending
    const items = useAITriageStore.getState().reviewItems;
    expect(items[0].status).toBe('pending');
    expect(items[1].status).toBe('pending');
  });
});
