/**
 * React hook wrapping IPC calls for AI triage operations (Phase 3).
 *
 * Provides enrichment, split suggestion, apply results, and review
 * queue management. Sets up IPC listeners and manages cleanup.
 */

import { useCallback, useEffect } from 'react';
import { useAITriageStore } from '../../../stores/github/ai-triage-store';
import type { CreateIssueParams } from '../../../../shared/types/ai-triage';
import { createDefaultEnrichment } from '../../../../shared/types/enrichment';

export function useAITriage(projectId: string) {
  const store = useAITriageStore();

  // Set up IPC listeners
  useEffect(() => {
    const api = window.electronAPI.github;

    const cleanups = [
      api.onEnrichmentProgress((_projId, progress) => {
        store.setEnrichmentProgress(progress);
      }),
      api.onEnrichmentError((_projId, error) => {
        store.clearEnrichmentProgress();
        store.endTriage();
        console.error('Enrichment error:', error.error);
      }),
      api.onEnrichmentComplete((_projId, _result) => {
        store.clearEnrichmentProgress();
        store.endTriage();
      }),
      api.onSplitProgress((_projId, progress) => {
        store.setSplitProgress(progress);
      }),
      api.onSplitError((_projId, error) => {
        store.clearSplitProgress();
        store.endTriage();
        console.error('Split error:', error.error);
      }),
      api.onSplitComplete((_projId, result) => {
        store.setSplitSuggestion(result);
        store.clearSplitProgress();
        store.endTriage();
      }),
      api.onApplyResultsProgress((_projId, progress) => {
        store.setTriageProgress({
          phase: 'generating',
          progress: Math.round((progress.processedItems / progress.totalItems) * 100),
          message: `Applying results (${progress.processedItems}/${progress.totalItems})...`,
        });
      }),
      api.onApplyResultsComplete((_projId, _results) => {
        store.endTriage();
      }),
    ];

    return () => {
      for (const cleanup of cleanups) {
        cleanup();
      }
    };
  }, [store]);

  const runEnrichment = useCallback(
    (issueNumber: number) => {
      store.startTriage();
      window.electronAPI.github.runEnrichment(projectId, issueNumber);
    },
    [projectId, store],
  );

  const runSplitSuggestion = useCallback(
    (issueNumber: number) => {
      store.startTriage();
      window.electronAPI.github.runSplitSuggestion(projectId, issueNumber);
    },
    [projectId, store],
  );

  const confirmSplit = useCallback(
    async (
      issueNumber: number,
      subIssues: Array<{ title: string; body: string; labels: string[] }>,
    ) => {
      store.startTriage();
      store.setSplitProgress({
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

          store.setSplitProgress({
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
        store.setSplitProgress({
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

        store.setSplitProgress({
          phase: 'complete',
          progress: 100,
          message: `Split into ${createdIssues.length} sub-issues`,
          createdCount: createdIssues.length,
          totalCount: subIssues.length,
        });

        store.clearSplitSuggestion();
        store.endTriage();

        return { success: true, createdIssues };
      } catch (error) {
        store.clearSplitProgress();
        store.endTriage();
        return {
          success: false,
          createdIssues,
          error: error instanceof Error ? error.message : 'Split failed',
        };
      }
    },
    [projectId, store],
  );

  const applyTriageResults = useCallback(() => {
    const items = store.reviewItems;
    store.startTriage();
    window.electronAPI.github.applyTriageResults(projectId, items);
  }, [projectId, store]);

  const acceptResult = useCallback(
    (issueNumber: number) => {
      store.acceptReviewItem(issueNumber);
    },
    [store],
  );

  const rejectResult = useCallback(
    (issueNumber: number) => {
      store.rejectReviewItem(issueNumber);
    },
    [store],
  );

  return {
    // Actions
    runEnrichment,
    runSplitSuggestion,
    confirmSplit,
    applyTriageResults,
    acceptResult,
    rejectResult,

    // State
    isTriaging: store.isTriaging,
    triageProgress: store.triageProgress,
    reviewItems: store.reviewItems,
    enrichmentProgress: store.enrichmentProgress,
    splitSuggestion: store.splitSuggestion,
    splitProgress: store.splitProgress,
  };
}
