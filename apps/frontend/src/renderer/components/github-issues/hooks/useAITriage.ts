/**
 * React hook wrapping IPC calls for AI triage operations (Phase 3).
 *
 * Provides enrichment, split suggestion, apply results, and review
 * queue management. Sets up IPC listeners and manages cleanup.
 */

import { useCallback, useEffect, useRef } from 'react';
import { useAITriageStore } from '@/stores/github/ai-triage-store';
import { loadEnrichment } from '@/stores/github/enrichment-store';
import type { CreateIssueParams } from '@shared/types/ai-triage';
import { createDefaultEnrichment } from '@shared/types/enrichment';

export function useAITriage(projectId: string) {
  // Reactive state selectors — only re-render when these specific values change
  const isTriaging = useAITriageStore((s) => s.isTriaging);
  const triageProgress = useAITriageStore((s) => s.triageProgress);
  const reviewItems = useAITriageStore((s) => s.reviewItems);
  const enrichmentProgress = useAITriageStore((s) => s.enrichmentProgress);
  const splitSuggestion = useAITriageStore((s) => s.splitSuggestion);
  const splitProgress = useAITriageStore((s) => s.splitProgress);
  const enrichmentResult = useAITriageStore((s) => s.enrichmentResult);
  const lastError = useAITriageStore((s) => s.lastError);
  const clearEnrichmentResult = useAITriageStore((s) => s.clearEnrichmentResult);
  const clearLastError = useAITriageStore((s) => s.clearLastError);

  const loadedRef = useRef(false);
  const projectIdRef = useRef(projectId);
  projectIdRef.current = projectId;

  // Load persisted review queue on mount
  useEffect(() => {
    if (!projectId) return;
    loadedRef.current = false;
    window.electronAPI.github.loadPendingReview(projectId)
      .then((items) => {
        if (items.length > 0) {
          useAITriageStore.getState().addReviewItems(items);
        }
        loadedRef.current = true;
      })
      .catch(() => {
        loadedRef.current = true;
      });
  }, [projectId]);

  // Persist review queue whenever it changes
  useEffect(() => {
    if (!projectId || !loadedRef.current) return;
    window.electronAPI.github.savePendingReview(projectId, reviewItems).catch(() => {
      // Best-effort persistence
    });
  }, [projectId, reviewItems]);

  // Set up IPC listeners — use getState() for actions (stable, no deps needed)
  useEffect(() => {
    const api = window.electronAPI.github;

    const cleanups = [
      api.onEnrichmentProgress((_projId, progress) => {
        useAITriageStore.getState().setEnrichmentProgress(progress);
      }),
      api.onEnrichmentError((_projId, error) => {
        const s = useAITriageStore.getState();
        s.clearEnrichmentProgress();
        s.setLastError(error.error);
        s.endTriage();
        console.error('Enrichment error:', error.error);
      }),
      api.onEnrichmentComplete((_projId, result) => {
        const s = useAITriageStore.getState();
        s.clearEnrichmentProgress();
        s.setEnrichmentResult(result);
        s.endTriage();
        // Reload enrichment store so the UI picks up the persisted completenessScore
        if (projectIdRef.current) {
          loadEnrichment(projectIdRef.current);
        }
      }),
      api.onSplitProgress((_projId, progress) => {
        useAITriageStore.getState().setSplitProgress(progress);
      }),
      api.onSplitError((_projId, error) => {
        const s = useAITriageStore.getState();
        s.clearSplitProgress();
        s.setLastError(error.error);
        s.endTriage();
        console.error('Split error:', error.error);
      }),
      api.onSplitComplete((_projId, result) => {
        const s = useAITriageStore.getState();
        s.setSplitSuggestion(result);
        s.clearSplitProgress();
        s.endTriage();
      }),
      api.onApplyResultsProgress((_projId, progress) => {
        useAITriageStore.getState().setTriageProgress({
          phase: 'generating',
          progress: Math.round((progress.processedItems / progress.totalItems) * 100),
          message: `Applying results (${progress.processedItems}/${progress.totalItems})...`,
        });
      }),
      api.onApplyResultsComplete((_projId, _results) => {
        useAITriageStore.getState().endTriage();
      }),
      api.onApplyResultsError((_projId, error) => {
        const s = useAITriageStore.getState();
        s.setLastError(error.error);
        s.endTriage();
      }),
    ];

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, []);

  const runEnrichment = useCallback(
    (issueNumber: number) => {
      useAITriageStore.getState().startTriage();
      window.electronAPI.github.runEnrichment(projectId, issueNumber);
    },
    [projectId],
  );

  const runSplitSuggestion = useCallback(
    (issueNumber: number) => {
      useAITriageStore.getState().startTriage();
      window.electronAPI.github.runSplitSuggestion(projectId, issueNumber);
    },
    [projectId],
  );

  const confirmSplit = useCallback(
    async (
      issueNumber: number,
      subIssues: Array<{ title: string; body: string; labels: string[] }>,
    ) => {
      const s = useAITriageStore.getState();
      s.startTriage();
      s.setSplitProgress({
        phase: 'creating',
        progress: 0,
        message: 'Creating sub-issues...',
      });

      const createdIssues: number[] = [];

      try {
        // Create all sub-issues first (atomic: create-all-then-close)
        for (let i = 0; i < subIssues.length; i++) {
          const sub = subIssues[i];
          const params: CreateIssueParams = {
            title: sub.title,
            body: sub.body,
            labels: sub.labels.length > 0 ? sub.labels : undefined,
          };

          const result = await window.electronAPI.github.createIssue(projectId, params);
          createdIssues.push(result.number);

          useAITriageStore.getState().setSplitProgress({
            phase: 'creating',
            progress: Math.round(((i + 1) / subIssues.length) * 80),
            message: `Created sub-issue #${result.number} (${i + 1}/${subIssues.length})`,
            createdCount: i + 1,
            totalCount: subIssues.length,
          });
        }

        // Create enrichment entries for sub-issues
        for (const subNumber of createdIssues) {
          const subEnrichment = createDefaultEnrichment(subNumber);
          subEnrichment.splitFrom = issueNumber;
          await window.electronAPI.github.saveEnrichment(projectId, subEnrichment);
        }

        // Update original issue enrichment with splitInto
        const origEnrichment = createDefaultEnrichment(issueNumber);
        origEnrichment.splitInto = createdIssues;
        await window.electronAPI.github.saveEnrichment(projectId, origEnrichment);

        // Post linking comment on original issue
        const subIssueLinks = createdIssues.map((num) => `#${num}`).join(', ');
        const linkingComment = `Split into: ${subIssueLinks}\n\n---\n*Split by Auto-Claude*`;
        await window.electronAPI.github.addIssueComment(projectId, issueNumber, linkingComment);

        // Close original issue
        useAITriageStore.getState().setSplitProgress({
          phase: 'closing',
          progress: 90,
          message: 'Closing original issue...',
        });

        await window.electronAPI.github.closeIssue(projectId, issueNumber);

        // Transition enrichment to done with resolution: split
        await window.electronAPI.github.transitionWorkflowState(
          projectId,
          issueNumber,
          'done',
          'split',
        );

        const final = useAITriageStore.getState();
        final.setSplitProgress({
          phase: 'complete',
          progress: 100,
          message: `Split into ${createdIssues.length} sub-issues`,
          createdCount: createdIssues.length,
          totalCount: subIssues.length,
        });

        final.clearSplitSuggestion();
        final.endTriage();

        return { success: true, createdIssues };
      } catch (error) {
        const errState = useAITriageStore.getState();
        errState.clearSplitProgress();
        errState.clearSplitSuggestion();
        errState.endTriage();
        return {
          success: false,
          createdIssues,
          error: error instanceof Error ? error.message : 'Split failed',
        };
      }
    },
    [projectId],
  );

  const applyTriageResults = useCallback(() => {
    const s = useAITriageStore.getState();
    const items = s.reviewItems;
    s.startTriage();
    window.electronAPI.github.applyTriageResults(projectId, items);
  }, [projectId]);

  const acceptResult = useCallback(
    (issueNumber: number) => {
      useAITriageStore.getState().acceptReviewItem(issueNumber);
    },
    [],
  );

  const rejectResult = useCallback(
    (issueNumber: number) => {
      useAITriageStore.getState().rejectReviewItem(issueNumber);
    },
    [],
  );

  const undoLastBatchWithGitHub = useCallback(async () => {
    // Collect labels that were applied to GitHub issues
    const appliedItems = useAITriageStore.getState().reviewItems.filter(
      (item) => item.status === 'accepted' || item.status === 'auto-applied',
    );

    // Remove applied labels from GitHub (best-effort, don't block on failures)
    for (const item of appliedItems) {
      if (item.result.labelsToAdd.length > 0) {
        try {
          await window.electronAPI.github.removeIssueLabels(
            projectId,
            item.issueNumber,
            item.result.labelsToAdd,
          );
        } catch {
          // Continue on error — label may have been manually removed
        }
      }
    }

    // Restore local state
    useAITriageStore.getState().undoLastBatch();
  }, [projectId]);

  const applyProgressiveTrust = useCallback(async () => {
    try {
      const config = await window.electronAPI.github.getProgressiveTrust(projectId);
      useAITriageStore.getState().autoApplyByTrust(config);
    } catch {
      // Trust config not available — skip auto-apply silently
    }
  }, [projectId]);

  return {
    // Actions
    runEnrichment,
    runSplitSuggestion,
    confirmSplit,
    applyTriageResults,
    acceptResult,
    rejectResult,
    applyProgressiveTrust,
    undoLastBatchWithGitHub,

    // State
    isTriaging,
    triageProgress,
    reviewItems,
    enrichmentProgress,
    splitSuggestion,
    splitProgress,
    enrichmentResult,
    clearEnrichmentResult,
    lastError,
    clearLastError,
  };
}
