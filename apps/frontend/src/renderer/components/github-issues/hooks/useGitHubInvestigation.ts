import { useCallback, useMemo } from 'react';
import {
  useInvestigationStore,
  startIssueInvestigation,
  cancelIssueInvestigation,
} from '../../../stores/github';
import { loadTasks } from '../../../stores/task-store';
import type { InvestigationState, InvestigationDismissReason } from '@shared/types';
import type { IssueInvestigationState } from '../../../stores/github';
import type { GitHubInvestigationResult, GitHubInvestigationStatus } from '@shared/types';

/**
 * Hook for investigating a specific GitHub issue.
 * Uses the new multi-issue investigation store.
 *
 * Global IPC listeners are managed by initializeInvestigationListeners()
 * in the store (called at app startup), so this hook doesn't set up
 * per-component listeners.
 */
export function useGitHubInvestigation(projectId: string | undefined, issueNumber?: number) {
  const store = useInvestigationStore();

  // Get investigation state for this specific issue
  const entry: IssueInvestigationState | null = useMemo(() => {
    if (!projectId || issueNumber == null) return null;
    return store.getInvestigationState(projectId, issueNumber);
  }, [store, projectId, issueNumber]);

  // Compute derived state
  const investigationState: InvestigationState = useMemo(() => {
    if (!projectId || issueNumber == null) return 'new';
    return store.getDerivedState(projectId, issueNumber);
  }, [store, projectId, issueNumber]);

  // Get active investigations for this project
  const activeInvestigations = useMemo(() => {
    if (!projectId) return [];
    return store.getActiveInvestigations(projectId);
  }, [store, projectId]);

  const startInvestigation = useCallback((..._args: unknown[]) => {
    if (projectId && issueNumber != null) {
      startIssueInvestigation(projectId, issueNumber);
    }
  }, [projectId, issueNumber]);

  const cancelInvestigation = useCallback(() => {
    if (projectId && issueNumber != null) {
      cancelIssueInvestigation(projectId, issueNumber);
    }
  }, [projectId, issueNumber]);

  const createTask = useCallback(async () => {
    if (!projectId || issueNumber == null) return;
    const result = await window.electronAPI.github.createTaskFromInvestigation(projectId, issueNumber);
    if (result.success) {
      loadTasks(projectId);
    }
  }, [projectId, issueNumber]);

  const dismissIssue = useCallback(async (reason: InvestigationDismissReason) => {
    if (!projectId || issueNumber == null) return;
    await window.electronAPI.github.dismissIssue(projectId, issueNumber, reason);
    store.dismiss(projectId, issueNumber, reason);
  }, [projectId, issueNumber, store]);

  const postToGitHub = useCallback(async () => {
    if (!projectId || issueNumber == null) return;
    try {
      const result = await window.electronAPI.github.postInvestigationToGitHub(projectId, issueNumber);
      if (result?.success) {
        const commentId = result.data?.commentId ?? Date.now();
        store.setGithubCommentId(projectId, issueNumber, commentId);
      } else {
        console.error('[useGitHubInvestigation] Failed to post to GitHub:', result?.error);
      }
    } catch (err) {
      console.error('[useGitHubInvestigation] Error posting to GitHub:', err);
    }
  }, [projectId, issueNumber, store]);

  // --- Backwards-compat shims (consumed by GitHubIssues.tsx until F5/F6 rewires it) ---
  /** @deprecated Use investigationState instead. Will be removed in F6. */
  const investigationStatus: GitHubInvestigationStatus = useMemo(() => ({
    phase: investigationState === 'investigating' ? 'analyzing' : 'idle',
    progress: entry?.progress?.progress ?? 0,
    message: '',
  }), [investigationState, entry]);

  /** @deprecated Use report instead. Will be removed in F6. */
  const lastInvestigationResult = null as GitHubInvestigationResult | null;

  /** @deprecated No-op. Will be removed in F6. */
  const resetInvestigationStatus = useCallback(() => {}, []);

  return {
    /** Per-issue investigation state (null if no investigation started) */
    entry,
    /** Derived 8-state machine value */
    investigationState,
    /** All currently running investigations for this project */
    activeInvestigations,
    /** Progress data (shortcut from entry) */
    progress: entry?.progress ?? null,
    /** Investigation report (shortcut from entry) */
    report: entry?.report ?? null,
    /** Error message (shortcut from entry) */
    error: entry?.error ?? null,
    /** Whether investigation is currently running */
    isInvestigating: entry?.isInvestigating ?? false,
    /** Actions */
    startInvestigation,
    cancelInvestigation,
    createTask,
    dismissIssue,
    postToGitHub,
    // --- Backwards-compat (remove in F6) ---
    investigationStatus,
    lastInvestigationResult,
    resetInvestigationStatus,
  };
}
