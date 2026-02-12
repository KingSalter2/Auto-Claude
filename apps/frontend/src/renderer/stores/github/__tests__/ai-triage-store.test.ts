import { describe, it, expect, beforeEach } from 'vitest';
import { useAITriageStore } from '../ai-triage-store';
import type { TriageReviewItem, ProgressiveTrustConfig } from '../../../../shared/types/ai-triage';

function makeReviewItem(
  overrides: Partial<TriageReviewItem> & { issueNumber: number },
): TriageReviewItem {
  return {
    issueTitle: `Issue #${overrides.issueNumber}`,
    status: 'pending',
    result: {
      category: 'bug',
      confidence: 0.8,
      labelsToAdd: [],
      labelsToRemove: [],
      isDuplicate: false,
      isSpam: false,
      isFeatureCreep: false,
      suggestedBreakdown: [],
      priority: 'medium',
      triagedAt: '2026-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

function makeTrustConfig(
  overrides?: Partial<ProgressiveTrustConfig>,
): ProgressiveTrustConfig {
  return {
    autoApply: {
      type: { enabled: false, threshold: 0.9 },
      priority: { enabled: false, threshold: 0.9 },
      labels: { enabled: false, threshold: 0.9 },
      duplicate: { enabled: false, threshold: 0.9 },
    },
    batchSize: 50,
    confirmAbove: 10,
    ...overrides,
  };
}

describe('useAITriageStore', () => {
  beforeEach(() => {
    useAITriageStore.setState({
      isTriaging: false,
      triageProgress: null,
      reviewItems: [],
      enrichmentProgress: null,
      enrichmentResult: null,
      splitSuggestion: null,
      splitProgress: null,
      lastError: null,
      lastBatchSnapshot: null,
    });
  });

  describe('autoApplyByTrust', () => {
    it('auto-applies items above labels threshold when labels enabled', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({
          issueNumber: 1,
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
        }),
      ]);

      const config = makeTrustConfig({
        autoApply: {
          type: { enabled: false, threshold: 0.9 },
          priority: { enabled: false, threshold: 0.9 },
          labels: { enabled: true, threshold: 0.9 },
          duplicate: { enabled: false, threshold: 0.9 },
        },
      });

      useAITriageStore.getState().autoApplyByTrust(config);

      expect(useAITriageStore.getState().reviewItems[0].status).toBe('auto-applied');
    });

    it('leaves items below threshold as pending', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({
          issueNumber: 1,
          result: {
            category: 'bug',
            confidence: 0.7,
            labelsToAdd: ['bug'],
            labelsToRemove: [],
            isDuplicate: false,
            isSpam: false,
            isFeatureCreep: false,
            suggestedBreakdown: [],
            priority: 'medium',
            triagedAt: '2026-01-01T00:00:00Z',
          },
        }),
      ]);

      const config = makeTrustConfig({
        autoApply: {
          type: { enabled: false, threshold: 0.9 },
          priority: { enabled: false, threshold: 0.9 },
          labels: { enabled: true, threshold: 0.9 },
          duplicate: { enabled: false, threshold: 0.9 },
        },
      });

      useAITriageStore.getState().autoApplyByTrust(config);

      expect(useAITriageStore.getState().reviewItems[0].status).toBe('pending');
    });

    it('auto-applies duplicate items above threshold when duplicate enabled', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({
          issueNumber: 2,
          result: {
            category: 'bug',
            confidence: 0.95,
            labelsToAdd: [],
            labelsToRemove: [],
            isDuplicate: true,
            duplicateOf: 1,
            isSpam: false,
            isFeatureCreep: false,
            suggestedBreakdown: [],
            priority: 'medium',
            triagedAt: '2026-01-01T00:00:00Z',
          },
        }),
      ]);

      const config = makeTrustConfig({
        autoApply: {
          type: { enabled: false, threshold: 0.9 },
          priority: { enabled: false, threshold: 0.9 },
          labels: { enabled: false, threshold: 0.9 },
          duplicate: { enabled: true, threshold: 0.9 },
        },
      });

      useAITriageStore.getState().autoApplyByTrust(config);

      expect(useAITriageStore.getState().reviewItems[0].status).toBe('auto-applied');
    });

    it('skips disabled categories even when confidence is high', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({
          issueNumber: 1,
          result: {
            category: 'bug',
            confidence: 0.99,
            labelsToAdd: ['bug'],
            labelsToRemove: [],
            isDuplicate: false,
            isSpam: false,
            isFeatureCreep: false,
            suggestedBreakdown: [],
            priority: 'high',
            triagedAt: '2026-01-01T00:00:00Z',
          },
        }),
      ]);

      // All categories disabled
      const config = makeTrustConfig();

      useAITriageStore.getState().autoApplyByTrust(config);

      expect(useAITriageStore.getState().reviewItems[0].status).toBe('pending');
    });

    it('does not touch already-accepted or rejected items', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({
          issueNumber: 1,
          status: 'accepted',
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
        }),
        makeReviewItem({
          issueNumber: 2,
          status: 'rejected',
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
        }),
      ]);

      const config = makeTrustConfig({
        autoApply: {
          type: { enabled: false, threshold: 0.9 },
          priority: { enabled: false, threshold: 0.9 },
          labels: { enabled: true, threshold: 0.9 },
          duplicate: { enabled: false, threshold: 0.9 },
        },
      });

      useAITriageStore.getState().autoApplyByTrust(config);

      const items = useAITriageStore.getState().reviewItems;
      expect(items[0].status).toBe('accepted');
      expect(items[1].status).toBe('rejected');
    });

    it('labels category requires labelsToAdd to be non-empty', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({
          issueNumber: 1,
          result: {
            category: 'bug',
            confidence: 0.95,
            labelsToAdd: [], // empty — no labels to apply
            labelsToRemove: [],
            isDuplicate: false,
            isSpam: false,
            isFeatureCreep: false,
            suggestedBreakdown: [],
            priority: 'high',
            triagedAt: '2026-01-01T00:00:00Z',
          },
        }),
      ]);

      const config = makeTrustConfig({
        autoApply: {
          type: { enabled: false, threshold: 0.9 },
          priority: { enabled: false, threshold: 0.9 },
          labels: { enabled: true, threshold: 0.9 },
          duplicate: { enabled: false, threshold: 0.9 },
        },
      });

      useAITriageStore.getState().autoApplyByTrust(config);

      // Should remain pending since no labels to add
      expect(useAITriageStore.getState().reviewItems[0].status).toBe('pending');
    });
  });

  describe('enrichmentResult', () => {
    it('setEnrichmentResult stores the result', () => {
      const result = {
        issueNumber: 42,
        problem: 'Login fails',
        goal: 'Fix login',
        scopeIn: ['auth'],
        scopeOut: ['signup'],
        acceptanceCriteria: ['User can log in'],
        technicalContext: 'React app',
        risksEdgeCases: ['Token expiry'],
        confidence: 0.9,
      };
      useAITriageStore.getState().setEnrichmentResult(result);
      expect(useAITriageStore.getState().enrichmentResult).toEqual(result);
    });

    it('clearEnrichmentResult resets to null', () => {
      useAITriageStore.getState().setEnrichmentResult({
        issueNumber: 1,
        problem: 'test',
        goal: 'test',
        scopeIn: [],
        scopeOut: [],
        acceptanceCriteria: [],
        technicalContext: '',
        risksEdgeCases: [],
        confidence: 0.5,
      });
      useAITriageStore.getState().clearEnrichmentResult();
      expect(useAITriageStore.getState().enrichmentResult).toBeNull();
    });
  });

  describe('undoBatch', () => {
    it('snapshotBeforeApply saves current review items', () => {
      const items = [
        makeReviewItem({ issueNumber: 1, status: 'accepted' }),
        makeReviewItem({ issueNumber: 2, status: 'rejected' }),
      ];
      useAITriageStore.getState().addReviewItems(items);
      useAITriageStore.getState().snapshotBeforeApply();

      const snapshot = useAITriageStore.getState().lastBatchSnapshot;
      expect(snapshot).toHaveLength(2);
      expect(snapshot?.[0].status).toBe('accepted');
    });

    it('undoLastBatch restores snapshot and clears it', () => {
      const items = [
        makeReviewItem({ issueNumber: 1 }),
        makeReviewItem({ issueNumber: 2 }),
      ];
      useAITriageStore.getState().addReviewItems(items);
      useAITriageStore.getState().snapshotBeforeApply();

      // Simulate apply — accept all
      useAITriageStore.getState().acceptAllRemaining();
      expect(useAITriageStore.getState().reviewItems[0].status).toBe('accepted');

      // Undo
      useAITriageStore.getState().undoLastBatch();
      const restored = useAITriageStore.getState().reviewItems;
      expect(restored[0].status).toBe('pending');
      expect(restored[1].status).toBe('pending');
      expect(useAITriageStore.getState().lastBatchSnapshot).toBeNull();
    });

    it('undoLastBatch does nothing when no snapshot', () => {
      useAITriageStore.getState().addReviewItems([
        makeReviewItem({ issueNumber: 1, status: 'accepted' }),
      ]);
      useAITriageStore.getState().undoLastBatch();
      // Items unchanged
      expect(useAITriageStore.getState().reviewItems[0].status).toBe('accepted');
    });
  });

  describe('lastError', () => {
    it('setLastError stores error message', () => {
      useAITriageStore.getState().setLastError('API timeout');
      expect(useAITriageStore.getState().lastError).toBe('API timeout');
    });

    it('clearLastError resets error to null', () => {
      useAITriageStore.getState().setLastError('Some error');
      useAITriageStore.getState().clearLastError();
      expect(useAITriageStore.getState().lastError).toBeNull();
    });

    it('startTriage clears lastError', () => {
      useAITriageStore.getState().setLastError('Previous error');
      useAITriageStore.getState().startTriage();
      expect(useAITriageStore.getState().lastError).toBeNull();
    });
  });
});
