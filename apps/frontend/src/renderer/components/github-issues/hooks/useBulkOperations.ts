import { useCallback, useEffect } from 'react';
import { useMutationStore } from '../../../stores/github/mutation-store';
import type { BulkActionType, BulkOperationResult, BulkExecuteParams } from '../../../../shared/types/mutations';

export function useBulkOperations(projectId: string) {
  const { startBulkOperation, updateBulkProgress, endBulkOperation } = useMutationStore();
  const isBulkOperating = useMutationStore((s) => s.isBulkOperating);

  // Register progress + completion listeners
  useEffect(() => {
    const cleanupProgress = window.electronAPI.github.onBulkProgress((progress) => {
      updateBulkProgress(progress);
    });
    const cleanupComplete = window.electronAPI.github.onBulkComplete((result) => {
      endBulkOperation(result);
    });
    return () => {
      cleanupProgress();
      cleanupComplete();
    };
  }, [updateBulkProgress, endBulkOperation]);

  const executeBulk = useCallback(
    async (
      action: BulkActionType,
      issueNumbers: number[],
      payload?: BulkExecuteParams['payload'],
    ) => {
      if (isBulkOperating || issueNumbers.length === 0) return;

      startBulkOperation(action, issueNumbers.length);
      return window.electronAPI.github.executeBulk({
        projectId,
        action,
        issueNumbers,
        payload,
      });
    },
    [projectId, isBulkOperating, startBulkOperation],
  );

  const retryFailed = useCallback(
    async (previousResult: BulkOperationResult, payload?: BulkExecuteParams['payload']) => {
      const failedNumbers = previousResult.results
        .filter((r) => r.status === 'failed')
        .map((r) => r.issueNumber);
      if (failedNumbers.length === 0) return;
      return executeBulk(previousResult.action, failedNumbers, payload);
    },
    [executeBulk],
  );

  return { executeBulk, retryFailed, isOperating: isBulkOperating };
}
