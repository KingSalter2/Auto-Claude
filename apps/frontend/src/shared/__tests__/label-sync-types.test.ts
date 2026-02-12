import { describe, it, expect } from 'vitest';
import { createDefaultLabelSyncConfig } from '../types/label-sync';
import type { LabelSyncConfig, LabelSyncResult, LabelSyncProgress } from '../types/label-sync';

describe('createDefaultLabelSyncConfig', () => {
  it('returns disabled config', () => {
    const config = createDefaultLabelSyncConfig();
    expect(config.enabled).toBe(false);
  });

  it('returns null lastSyncedAt', () => {
    const config = createDefaultLabelSyncConfig();
    expect(config.lastSyncedAt).toBeNull();
  });

  it('returns a fresh object each time', () => {
    const a = createDefaultLabelSyncConfig();
    const b = createDefaultLabelSyncConfig();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});

describe('LabelSyncResult type shape', () => {
  it('accepts valid result', () => {
    const result: LabelSyncResult = {
      created: 5,
      updated: 2,
      removed: 0,
      errors: [{ label: 'ac:new', error: 'already exists' }],
    };
    expect(result.created).toBe(5);
    expect(result.errors).toHaveLength(1);
  });
});

describe('LabelSyncProgress type shape', () => {
  it('accepts creating phase', () => {
    const progress: LabelSyncProgress = {
      phase: 'creating',
      progress: 50,
      message: 'Creating labels...',
    };
    expect(progress.phase).toBe('creating');
  });

  it('accepts all valid phases', () => {
    const phases: LabelSyncProgress['phase'][] = ['creating', 'syncing', 'cleaning', 'complete'];
    for (const phase of phases) {
      const p: LabelSyncProgress = { phase, progress: 0, message: '' };
      expect(p.phase).toBe(phase);
    }
  });
});
