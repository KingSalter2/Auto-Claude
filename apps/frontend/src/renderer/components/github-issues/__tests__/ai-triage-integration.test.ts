/**
 * Integration test verifying the AI triage flow from store → constants → types.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAITriageStore } from '../../../stores/github/ai-triage-store';
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONFIRM_ABOVE,
  MAX_SPLIT_SUB_ISSUES,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  getConfidenceLevel,
  isValidThreshold,
  clampThreshold,
  estimateBatchCost,
} from '../../../../shared/constants/ai-triage';
import {
  createDefaultProgressiveTrust,
  mapTriageCategory,
} from '../../../../shared/types/ai-triage';
import type { TriageReviewItem } from '../../../../shared/types/ai-triage';

function createItem(
  issueNumber: number,
  status: TriageReviewItem['status'] = 'pending',
): TriageReviewItem {
  return {
    issueNumber,
    issueTitle: `Issue #${issueNumber}`,
    result: {
      category: 'bug',
      confidence: 0.85,
      labelsToAdd: ['bug'],
      labelsToRemove: [],
      isDuplicate: false,
      isSpam: false,
      isFeatureCreep: false,
      suggestedBreakdown: [],
      priority: 'high',
      triagedAt: '2026-01-01T00:00:00Z',
    },
    status,
  };
}

beforeEach(() => {
  useAITriageStore.setState({
    isTriaging: false,
    triageProgress: null,
    reviewItems: [],
    enrichmentProgress: null,
    splitSuggestion: null,
    splitProgress: null,
  });
});

// ============================================
// Store + constants consistency
// ============================================

describe('store + constants consistency', () => {
  it('default progressive trust uses expected constant values', () => {
    const defaults = createDefaultProgressiveTrust();
    expect(defaults.batchSize).toBe(DEFAULT_BATCH_SIZE);
    expect(defaults.confirmAbove).toBe(DEFAULT_CONFIRM_ABOVE);
  });

  it('all trust categories start disabled at 0.9 threshold', () => {
    const defaults = createDefaultProgressiveTrust();
    for (const category of ['type', 'priority', 'labels', 'duplicate'] as const) {
      expect(defaults.autoApply[category].enabled).toBe(false);
      expect(defaults.autoApply[category].threshold).toBe(0.9);
      expect(isValidThreshold(defaults.autoApply[category].threshold)).toBe(true);
    }
  });

  it('category mapping covers all enrichment categories', () => {
    const pythonCategories = [
      'bug', 'feature', 'documentation', 'question',
      'enhancement', 'chore', 'security', 'performance',
    ];
    for (const cat of pythonCategories) {
      expect(mapTriageCategory(cat)).toBe(cat);
    }
  });

  it('category mapping maps special Python categories', () => {
    expect(mapTriageCategory('duplicate')).toBe('bug');
    expect(mapTriageCategory('spam')).toBe('chore');
    expect(mapTriageCategory('feature_creep')).toBe('enhancement');
  });

  it('unknown categories map to chore', () => {
    expect(mapTriageCategory('unknown_type')).toBe('chore');
  });
});

// ============================================
// Progressive trust defaults
// ============================================

describe('progressive trust defaults', () => {
  it('threshold bounds are correct', () => {
    expect(THRESHOLD_MIN).toBe(0.5);
    expect(THRESHOLD_MAX).toBe(1.0);
    expect(THRESHOLD_MIN).toBeLessThan(THRESHOLD_MAX);
  });

  it('default thresholds are within valid range', () => {
    const defaults = createDefaultProgressiveTrust();
    for (const category of ['type', 'priority', 'labels', 'duplicate'] as const) {
      const threshold = defaults.autoApply[category].threshold;
      expect(threshold).toBeGreaterThanOrEqual(THRESHOLD_MIN);
      expect(threshold).toBeLessThanOrEqual(THRESHOLD_MAX);
    }
  });

  it('clampThreshold enforces bounds', () => {
    expect(clampThreshold(0.3)).toBe(THRESHOLD_MIN);
    expect(clampThreshold(1.5)).toBe(THRESHOLD_MAX);
    expect(clampThreshold(0.75)).toBe(0.75);
  });
});

// ============================================
// Review item lifecycle
// ============================================

describe('review item lifecycle', () => {
  it('pending → accepted → applied flow', () => {
    const store = useAITriageStore.getState();

    // Add pending items
    store.addReviewItems([createItem(1), createItem(2), createItem(3)]);
    expect(useAITriageStore.getState().reviewItems).toHaveLength(3);
    expect(useAITriageStore.getState().getUnreviewedCount()).toBe(3);

    // Accept one
    useAITriageStore.getState().acceptReviewItem(1);
    const item1 = useAITriageStore.getState().reviewItems.find((i) => i.issueNumber === 1);
    expect(item1?.status).toBe('accepted');
    expect(useAITriageStore.getState().getUnreviewedCount()).toBe(2);

    // Reject one
    useAITriageStore.getState().rejectReviewItem(2);
    const item2 = useAITriageStore.getState().reviewItems.find((i) => i.issueNumber === 2);
    expect(item2?.status).toBe('rejected');
    expect(useAITriageStore.getState().getUnreviewedCount()).toBe(1);
  });

  it('acceptAllRemaining accepts only pending items', () => {
    const store = useAITriageStore.getState();
    store.addReviewItems([
      createItem(1, 'rejected'),
      createItem(2, 'pending'),
      createItem(3, 'pending'),
    ]);

    useAITriageStore.getState().acceptAllRemaining();

    const items = useAITriageStore.getState().reviewItems;
    expect(items.find((i) => i.issueNumber === 1)?.status).toBe('rejected');
    expect(items.find((i) => i.issueNumber === 2)?.status).toBe('accepted');
    expect(items.find((i) => i.issueNumber === 3)?.status).toBe('accepted');
  });

  it('dismissReview clears all items', () => {
    const store = useAITriageStore.getState();
    store.addReviewItems([createItem(1), createItem(2)]);
    expect(useAITriageStore.getState().reviewItems).toHaveLength(2);

    useAITriageStore.getState().dismissReview();
    expect(useAITriageStore.getState().reviewItems).toHaveLength(0);
  });
});

// ============================================
// Split suggestion capping
// ============================================

describe('split suggestion capping', () => {
  it('MAX_SPLIT_SUB_ISSUES is 5', () => {
    expect(MAX_SPLIT_SUB_ISSUES).toBe(5);
  });

  it('store accepts split suggestion with sub-issues at max', () => {
    const subIssues = Array.from({ length: MAX_SPLIT_SUB_ISSUES }, (_, i) => ({
      title: `Sub ${i + 1}`,
      body: `Body ${i + 1}`,
      labels: [],
    }));

    useAITriageStore.getState().setSplitSuggestion({
      issueNumber: 42,
      subIssues,
      rationale: 'Too complex',
      confidence: 0.9,
    });

    const suggestion = useAITriageStore.getState().splitSuggestion;
    expect(suggestion?.subIssues).toHaveLength(MAX_SPLIT_SUB_ISSUES);
  });

  it('clearSplitSuggestion removes the suggestion', () => {
    useAITriageStore.getState().setSplitSuggestion({
      issueNumber: 42,
      subIssues: [{ title: 'Sub', body: 'Body', labels: [] }],
      rationale: 'Test',
      confidence: 0.8,
    });

    useAITriageStore.getState().clearSplitSuggestion();
    expect(useAITriageStore.getState().splitSuggestion).toBeNull();
  });
});

// ============================================
// Confidence level helper at boundaries
// ============================================

describe('confidence level helper at boundaries', () => {
  it('exactly at CONFIDENCE_HIGH returns high', () => {
    expect(getConfidenceLevel(CONFIDENCE_HIGH)).toBe('high');
  });

  it('just below CONFIDENCE_HIGH returns medium', () => {
    expect(getConfidenceLevel(CONFIDENCE_HIGH - 0.001)).toBe('medium');
  });

  it('exactly at CONFIDENCE_MEDIUM returns medium', () => {
    expect(getConfidenceLevel(CONFIDENCE_MEDIUM)).toBe('medium');
  });

  it('just below CONFIDENCE_MEDIUM returns low', () => {
    expect(getConfidenceLevel(CONFIDENCE_MEDIUM - 0.001)).toBe('low');
  });

  it('0 returns low', () => {
    expect(getConfidenceLevel(0)).toBe('low');
  });

  it('1 returns high', () => {
    expect(getConfidenceLevel(1)).toBe('high');
  });

  it('estimateBatchCost returns formatted string', () => {
    const cost = estimateBatchCost(10, 'sonnet');
    expect(cost).toMatch(/~\$\d+\.\d{2}/);
  });
});
