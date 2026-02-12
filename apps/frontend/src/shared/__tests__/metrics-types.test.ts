import { describe, it, expect } from 'vitest';
import {
  createEmptyMetrics,
  getCompletenessCategory,
  formatDuration,
} from '../types/metrics';
import type { MetricsTimeWindow } from '../types/metrics';

describe('createEmptyMetrics', () => {
  it('returns zero counts for all workflow states', () => {
    const metrics = createEmptyMetrics();
    const states = ['new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked'] as const;
    for (const state of states) {
      expect(metrics.stateCounts[state]).toBe(0);
    }
  });

  it('returns zero avgTimeInState for all states', () => {
    const metrics = createEmptyMetrics();
    for (const time of Object.values(metrics.avgTimeInState)) {
      expect(time).toBe(0);
    }
  });

  it('returns empty weeklyThroughput', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.weeklyThroughput).toEqual([]);
  });

  it('returns zero completeness distribution', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.completenessDistribution).toEqual({ low: 0, medium: 0, high: 0, excellent: 0 });
  });

  it('returns zero avgBacklogAge', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.avgBacklogAge).toBe(0);
  });

  it('returns zero totalTransitions', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.totalTransitions).toBe(0);
  });

  it('sets computedAt to ISO string', () => {
    const metrics = createEmptyMetrics();
    expect(metrics.computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('returns a fresh object each time', () => {
    const a = createEmptyMetrics();
    const b = createEmptyMetrics();
    expect(a).not.toBe(b);
  });
});

describe('getCompletenessCategory', () => {
  it('returns low for 0', () => {
    expect(getCompletenessCategory(0)).toBe('low');
  });

  it('returns low for 24', () => {
    expect(getCompletenessCategory(24)).toBe('low');
  });

  it('returns medium for 25', () => {
    expect(getCompletenessCategory(25)).toBe('medium');
  });

  it('returns medium for 49', () => {
    expect(getCompletenessCategory(49)).toBe('medium');
  });

  it('returns high for 50', () => {
    expect(getCompletenessCategory(50)).toBe('high');
  });

  it('returns high for 74', () => {
    expect(getCompletenessCategory(74)).toBe('high');
  });

  it('returns excellent for 75', () => {
    expect(getCompletenessCategory(75)).toBe('excellent');
  });

  it('returns excellent for 100', () => {
    expect(getCompletenessCategory(100)).toBe('excellent');
  });
});

describe('formatDuration', () => {
  it('returns 0s for 0', () => {
    expect(formatDuration(0)).toBe('0s');
  });

  it('returns 0s for negative', () => {
    expect(formatDuration(-1000)).toBe('0s');
  });

  it('returns seconds for < 1 minute', () => {
    expect(formatDuration(30_000)).toBe('30s');
  });

  it('returns minutes for < 1 hour', () => {
    expect(formatDuration(300_000)).toBe('5m');
  });

  it('returns hours for < 1 day', () => {
    expect(formatDuration(7_200_000)).toBe('2h');
  });

  it('returns days for >= 24 hours', () => {
    expect(formatDuration(172_800_000)).toBe('2d');
  });
});

describe('MetricsTimeWindow type', () => {
  it('accepts valid windows', () => {
    const windows: MetricsTimeWindow[] = ['7d', '30d', 'all'];
    expect(windows).toHaveLength(3);
  });
});
