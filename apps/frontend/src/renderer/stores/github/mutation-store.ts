import { create } from 'zustand';
import type { BulkOperationProgress, BulkOperationResult, BulkActionType } from '@shared/types/mutations';

interface MutationState {
  // Single mutations
  mutatingIssues: Set<number>;
  mutationErrors: Map<number, string>;

  // Bulk
  isBulkOperating: boolean;
  bulkProgress: BulkOperationProgress | null;
  bulkResult: BulkOperationResult | null;

  // Actions — single mutation
  startMutation: (issueNumber: number) => void;
  endMutation: (issueNumber: number, error?: string) => void;
  clearMutationError: (issueNumber: number) => void;

  // Actions — bulk
  startBulkOperation: (action: BulkActionType, count: number) => void;
  updateBulkProgress: (progress: BulkOperationProgress) => void;
  endBulkOperation: (result: BulkOperationResult) => void;
  clearBulkResult: () => void;
}

export const useMutationStore = create<MutationState>((set, get) => ({
  // Initial state
  mutatingIssues: new Set(),
  mutationErrors: new Map(),
  isBulkOperating: false,
  bulkProgress: null,
  bulkResult: null,

  // Single mutation tracking
  startMutation: (issueNumber) =>
    set((state) => {
      const next = new Set(state.mutatingIssues);
      next.add(issueNumber);
      return { mutatingIssues: next };
    }),

  endMutation: (issueNumber, error) =>
    set((state) => {
      const nextMutating = new Set(state.mutatingIssues);
      nextMutating.delete(issueNumber);

      const nextErrors = new Map(state.mutationErrors);
      if (error) {
        nextErrors.set(issueNumber, error);
      }

      return { mutatingIssues: nextMutating, mutationErrors: nextErrors };
    }),

  clearMutationError: (issueNumber) =>
    set((state) => {
      const next = new Map(state.mutationErrors);
      next.delete(issueNumber);
      return { mutationErrors: next };
    }),

  // Bulk operations
  startBulkOperation: (action, count) => {
    if (get().isBulkOperating) return; // Lock — prevent concurrent bulk ops
    set({
      isBulkOperating: true,
      bulkProgress: { action, totalItems: count, processedItems: 0 },
      bulkResult: null,
    });
  },

  updateBulkProgress: (progress) =>
    set({ bulkProgress: progress }),

  endBulkOperation: (result) =>
    set({
      isBulkOperating: false,
      bulkProgress: null,
      bulkResult: result,
    }),

  clearBulkResult: () =>
    set({ bulkResult: null }),

}));
