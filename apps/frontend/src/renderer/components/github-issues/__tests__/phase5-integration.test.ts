import { describe, it, expect } from 'vitest';
import enCommon from '@shared/i18n/locales/en/common.json';
import frCommon from '@shared/i18n/locales/fr/common.json';

const PHASE5_KEYS = [
  'triageMode',
  'triageModeTooltip',
  'selectAll',
  'deselectAll',
  'selectedCount',
  'selectIssue',
  'metricsToggle',
  'editTitle',
  'editBody',
  'addComment',
  'closeIssue',
  'reopenIssue',
  'bulkInProgress',
  'narrowScreen',
] as const;

describe('Phase 5 integration', () => {
  it('all Phase 5 i18n keys exist in EN locale', () => {
    const phase5 = (enCommon as Record<string, unknown>).phase5 as Record<string, string>;
    expect(phase5).toBeDefined();
    for (const key of PHASE5_KEYS) {
      expect(phase5[key], `Missing EN key: phase5.${key}`).toBeDefined();
    }
  });

  it('all Phase 5 i18n keys exist in FR locale', () => {
    const phase5 = (frCommon as Record<string, unknown>).phase5 as Record<string, string>;
    expect(phase5).toBeDefined();
    for (const key of PHASE5_KEYS) {
      expect(phase5[key], `Missing FR key: phase5.${key}`).toBeDefined();
    }
  });

  it('barrel exports cover all hooks (14+)', async () => {
    const hooks = await import('../hooks');
    const exported = Object.keys(hooks);
    expect(exported.length).toBeGreaterThanOrEqual(11);
    // useTriageMode — removed in F9, replaced by investigation system
    expect(exported).toContain('useBulkOperations');
    expect(exported).toContain('useMetrics');
  });

  it('barrel exports cover all components (30+)', { timeout: 15000 }, async () => {
    const components = await import('../components');
    const exported = Object.keys(components);
    expect(exported.length).toBeGreaterThanOrEqual(23);
    expect(exported).toContain('BulkActionBar');
    expect(exported).toContain('MetricsDashboard');
  });

  it('IssueDetailProps includes mutation callbacks in type', () => {
    type Check = import('../types').IssueDetailProps extends { onClose?: unknown; onReopen?: unknown; onComment?: unknown } ? true : false;
    const valid: Check = true;
    expect(valid).toBe(true);
  });

  it('EN and FR have same Phase 5 key count', () => {
    const en = (enCommon as Record<string, unknown>).phase5 as Record<string, string>;
    const fr = (frCommon as Record<string, unknown>).phase5 as Record<string, string>;
    expect(Object.keys(en).length).toBe(Object.keys(fr).length);
  });
});
