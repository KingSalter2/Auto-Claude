/**
 * AI Triage Zustand store (Phase 3).
 *
 * Manages triage operation state, review queue, enrichment progress,
 * and split suggestion state.
 */

import { create } from 'zustand';
import type {
  TriageReviewItem,
  EnrichmentProgress,
  SplitSuggestion,
  SplitProgress,
  ProgressiveTrustConfig,
} from '../../../shared/types/ai-triage';

// Re-use the enrichment progress type for triage progress display
type TriageProgress = EnrichmentProgress;

interface AITriageState {
  // Triage operation
  isTriaging: boolean;
  triageProgress: TriageProgress | null;

  // Review queue
  reviewItems: TriageReviewItem[];

  // Enrichment operation
  enrichmentProgress: EnrichmentProgress | null;

  // Split operation
  splitSuggestion: SplitSuggestion | null;
  splitProgress: SplitProgress | null;

  // Error state
  lastError: string | null;

  // Actions
  startTriage: () => void;
  endTriage: () => void;
  setTriageProgress: (progress: TriageProgress) => void;
  addReviewItems: (items: TriageReviewItem[]) => void;
  acceptReviewItem: (issueNumber: number) => void;
  rejectReviewItem: (issueNumber: number) => void;
  acceptAllRemaining: () => void;
  dismissReview: () => void;
  getUnreviewedCount: () => number;
  setEnrichmentProgress: (progress: EnrichmentProgress) => void;
  clearEnrichmentProgress: () => void;
  setSplitSuggestion: (suggestion: SplitSuggestion) => void;
  clearSplitSuggestion: () => void;
  setSplitProgress: (progress: SplitProgress) => void;
  clearSplitProgress: () => void;
  autoApplyByTrust: (config: ProgressiveTrustConfig) => void;
  setLastError: (error: string) => void;
  clearLastError: () => void;
}

export const useAITriageStore = create<AITriageState>((set, get) => ({
  // Initial state
  isTriaging: false,
  triageProgress: null,
  reviewItems: [],
  enrichmentProgress: null,
  splitSuggestion: null,
  splitProgress: null,
  lastError: null,

  // Triage operation
  startTriage: () => set({ isTriaging: true, lastError: null }),
  endTriage: () => set({ isTriaging: false, triageProgress: null }),
  setTriageProgress: (progress) => set({ triageProgress: progress }),

  // Review queue
  addReviewItems: (items) =>
    set((state) => ({ reviewItems: [...state.reviewItems, ...items] })),

  acceptReviewItem: (issueNumber) =>
    set((state) => ({
      reviewItems: state.reviewItems.map((item) =>
        item.issueNumber === issueNumber ? { ...item, status: 'accepted' as const } : item,
      ),
    })),

  rejectReviewItem: (issueNumber) =>
    set((state) => ({
      reviewItems: state.reviewItems.map((item) =>
        item.issueNumber === issueNumber ? { ...item, status: 'rejected' as const } : item,
      ),
    })),

  acceptAllRemaining: () =>
    set((state) => ({
      reviewItems: state.reviewItems.map((item) =>
        item.status === 'pending' ? { ...item, status: 'accepted' as const } : item,
      ),
    })),

  dismissReview: () => set({ reviewItems: [] }),

  getUnreviewedCount: () =>
    get().reviewItems.filter((item) => item.status === 'pending').length,

  // Enrichment
  setEnrichmentProgress: (progress) => set({ enrichmentProgress: progress }),
  clearEnrichmentProgress: () => set({ enrichmentProgress: null }),

  // Split
  setSplitSuggestion: (suggestion) => set({ splitSuggestion: suggestion }),
  clearSplitSuggestion: () => set({ splitSuggestion: null }),
  setSplitProgress: (progress) => set({ splitProgress: progress }),
  clearSplitProgress: () => set({ splitProgress: null }),

  setLastError: (error) => set({ lastError: error }),
  clearLastError: () => set({ lastError: null }),

  autoApplyByTrust: (config) =>
    set((state) => ({
      reviewItems: state.reviewItems.map((item) => {
        if (item.status !== 'pending') return item;
        const conf = item.result.confidence;
        // Check each enabled trust category
        if (config.autoApply.labels.enabled && conf >= config.autoApply.labels.threshold && item.result.labelsToAdd.length > 0) {
          return { ...item, status: 'auto-applied' as const };
        }
        if (config.autoApply.duplicate.enabled && conf >= config.autoApply.duplicate.threshold && item.result.isDuplicate) {
          return { ...item, status: 'auto-applied' as const };
        }
        return item;
      }),
    })),
}));
