/**
 * Tests for AI triage type factories and utilities.
 */
import { describe, it, expect } from 'vitest';
import {
  createDefaultProgressiveTrust,
  mapTriageCategory,
} from '../types/ai-triage';
import type { ProgressiveTrustConfig } from '../types/ai-triage';

describe('createDefaultProgressiveTrust', () => {
  it('returns all categories disabled', () => {
    const config = createDefaultProgressiveTrust();
    expect(config.autoApply.type.enabled).toBe(false);
    expect(config.autoApply.priority.enabled).toBe(false);
    expect(config.autoApply.labels.enabled).toBe(false);
    expect(config.autoApply.duplicate.enabled).toBe(false);
  });

  it('returns 0.9 threshold for all categories', () => {
    const config = createDefaultProgressiveTrust();
    expect(config.autoApply.type.threshold).toBe(0.9);
    expect(config.autoApply.priority.threshold).toBe(0.9);
    expect(config.autoApply.labels.threshold).toBe(0.9);
    expect(config.autoApply.duplicate.threshold).toBe(0.9);
  });

  it('returns default batch size of 50', () => {
    const config = createDefaultProgressiveTrust();
    expect(config.batchSize).toBe(50);
  });

  it('returns default confirmAbove of 10', () => {
    const config = createDefaultProgressiveTrust();
    expect(config.confirmAbove).toBe(10);
  });

  it('returns a fresh object each time (no shared references)', () => {
    const a = createDefaultProgressiveTrust();
    const b = createDefaultProgressiveTrust();
    expect(a).not.toBe(b);
    expect(a.autoApply).not.toBe(b.autoApply);
  });
});

describe('mapTriageCategory', () => {
  it('maps bug to bug', () => {
    expect(mapTriageCategory('bug')).toBe('bug');
  });

  it('maps feature to feature', () => {
    expect(mapTriageCategory('feature')).toBe('feature');
  });

  it('maps documentation to documentation', () => {
    expect(mapTriageCategory('documentation')).toBe('documentation');
  });

  it('maps question to question', () => {
    expect(mapTriageCategory('question')).toBe('question');
  });

  it('maps duplicate to bug (flagged separately via isDuplicate)', () => {
    expect(mapTriageCategory('duplicate')).toBe('bug');
  });

  it('maps spam to chore', () => {
    expect(mapTriageCategory('spam')).toBe('chore');
  });

  it('maps feature_creep to enhancement', () => {
    expect(mapTriageCategory('feature_creep')).toBe('enhancement');
  });

  it('maps unknown categories to chore', () => {
    expect(mapTriageCategory('unknown_xyz')).toBe('chore');
  });

  it('maps enhancement to enhancement', () => {
    expect(mapTriageCategory('enhancement')).toBe('enhancement');
  });

  it('maps chore to chore', () => {
    expect(mapTriageCategory('chore')).toBe('chore');
  });

  it('maps security to security', () => {
    expect(mapTriageCategory('security')).toBe('security');
  });

  it('maps performance to performance', () => {
    expect(mapTriageCategory('performance')).toBe('performance');
  });
});
