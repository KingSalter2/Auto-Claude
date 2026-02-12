/**
 * Tests for AI triage constants and utility functions.
 */
import { describe, it, expect } from 'vitest';
import {
  CONFIDENCE_HIGH,
  CONFIDENCE_MEDIUM,
  DEFAULT_BATCH_SIZE,
  DEFAULT_CONFIRM_ABOVE,
  MAX_SPLIT_SUB_ISSUES,
  APPLY_INTER_ITEM_DELAY,
  THRESHOLD_MIN,
  THRESHOLD_MAX,
  THRESHOLD_STEP,
  TRUST_LEVEL_LABELS,
  ENRICHMENT_COMMENT_FOOTER,
  getConfidenceLevel,
  isValidThreshold,
  clampThreshold,
  estimateBatchCost,
} from '../constants/ai-triage';
import type { TrustLevel } from '../constants/ai-triage';

describe('confidence constants', () => {
  it('CONFIDENCE_HIGH is 0.8', () => {
    expect(CONFIDENCE_HIGH).toBe(0.8);
  });

  it('CONFIDENCE_MEDIUM is 0.5', () => {
    expect(CONFIDENCE_MEDIUM).toBe(0.5);
  });
});

describe('batch constants', () => {
  it('DEFAULT_BATCH_SIZE is 50', () => {
    expect(DEFAULT_BATCH_SIZE).toBe(50);
  });

  it('DEFAULT_CONFIRM_ABOVE is 10', () => {
    expect(DEFAULT_CONFIRM_ABOVE).toBe(10);
  });

  it('MAX_SPLIT_SUB_ISSUES is 5', () => {
    expect(MAX_SPLIT_SUB_ISSUES).toBe(5);
  });

  it('APPLY_INTER_ITEM_DELAY is 100', () => {
    expect(APPLY_INTER_ITEM_DELAY).toBe(100);
  });
});

describe('threshold constants', () => {
  it('THRESHOLD_MIN is 0.5', () => {
    expect(THRESHOLD_MIN).toBe(0.5);
  });

  it('THRESHOLD_MAX is 1.0', () => {
    expect(THRESHOLD_MAX).toBe(1.0);
  });

  it('THRESHOLD_STEP is 0.05', () => {
    expect(THRESHOLD_STEP).toBe(0.05);
  });
});

describe('TRUST_LEVEL_LABELS', () => {
  it('has entry for every trust level', () => {
    const allLevels: TrustLevel[] = ['crawl', 'walk', 'run'];
    for (const level of allLevels) {
      expect(TRUST_LEVEL_LABELS).toHaveProperty(level);
      expect(typeof TRUST_LEVEL_LABELS[level]).toBe('string');
    }
  });
});

describe('ENRICHMENT_COMMENT_FOOTER', () => {
  it('contains Auto-Claude marker', () => {
    expect(ENRICHMENT_COMMENT_FOOTER).toContain('Auto-Claude');
  });

  it('starts with horizontal rule', () => {
    expect(ENRICHMENT_COMMENT_FOOTER).toMatch(/^---/);
  });
});

describe('getConfidenceLevel', () => {
  it('returns high for >= 0.8', () => {
    expect(getConfidenceLevel(0.8)).toBe('high');
    expect(getConfidenceLevel(0.95)).toBe('high');
    expect(getConfidenceLevel(1.0)).toBe('high');
  });

  it('returns medium for >= 0.5 and < 0.8', () => {
    expect(getConfidenceLevel(0.5)).toBe('medium');
    expect(getConfidenceLevel(0.79)).toBe('medium');
  });

  it('returns low for < 0.5', () => {
    expect(getConfidenceLevel(0.49)).toBe('low');
    expect(getConfidenceLevel(0.1)).toBe('low');
    expect(getConfidenceLevel(0)).toBe('low');
  });
});

describe('isValidThreshold', () => {
  it('returns true for values in [0.5, 1.0]', () => {
    expect(isValidThreshold(0.5)).toBe(true);
    expect(isValidThreshold(0.75)).toBe(true);
    expect(isValidThreshold(1.0)).toBe(true);
  });

  it('returns false for values below 0.5', () => {
    expect(isValidThreshold(0.49)).toBe(false);
    expect(isValidThreshold(0)).toBe(false);
    expect(isValidThreshold(-1)).toBe(false);
  });

  it('returns false for values above 1.0', () => {
    expect(isValidThreshold(1.01)).toBe(false);
    expect(isValidThreshold(2)).toBe(false);
  });

  it('returns false for non-numbers', () => {
    expect(isValidThreshold(Number.NaN)).toBe(false);
  });
});

describe('clampThreshold', () => {
  it('returns value when in range', () => {
    expect(clampThreshold(0.75)).toBe(0.75);
  });

  it('clamps to min when below', () => {
    expect(clampThreshold(0.1)).toBe(0.5);
    expect(clampThreshold(-1)).toBe(0.5);
  });

  it('clamps to max when above', () => {
    expect(clampThreshold(1.5)).toBe(1.0);
    expect(clampThreshold(99)).toBe(1.0);
  });
});

describe('estimateBatchCost', () => {
  it('estimates haiku cost correctly', () => {
    expect(estimateBatchCost(100, 'haiku')).toBe('~$0.08');
  });

  it('estimates non-haiku cost correctly', () => {
    expect(estimateBatchCost(100, 'sonnet')).toBe('~$0.35');
  });

  it('handles small batches', () => {
    expect(estimateBatchCost(1, 'haiku')).toBe('~$0.00');
  });

  it('handles large batches', () => {
    const cost = estimateBatchCost(1000, 'haiku');
    expect(cost).toBe('~$0.80');
  });
});
