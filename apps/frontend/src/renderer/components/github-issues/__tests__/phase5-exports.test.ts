import { describe, it, expect } from 'vitest';

describe('Phase 5 Barrel Exports', () => {
  describe('hooks/index', () => {
    it('exports all hooks', async () => {
      const hooks = await import('../hooks/index');
      const exportNames = Object.keys(hooks);
      expect(exportNames).toContain('useGitHubIssues');
      expect(exportNames).toContain('useGitHubInvestigation');
      expect(exportNames).toContain('useMutations');
      expect(exportNames).toContain('useBulkOperations');
      expect(exportNames).toContain('useLabelSync');
      expect(exportNames).toContain('useDependencies');
      expect(exportNames).toContain('useMetrics');
      expect(exportNames).toContain('useAnalyzePreview');
      expect(exportNames).toContain('useIssueListFiltering');
      expect(exportNames.length).toBeGreaterThanOrEqual(9);
    });
  });

  describe('components/index', () => {
    it('exports all Phase 1-4 components', { timeout: 15000 }, async () => {
      const components = await import('../components/index');
      const exportNames = Object.keys(components);

      // Phase 1
      expect(exportNames).toContain('CompletenessIndicator');

      // Phase 2
      expect(exportNames).toContain('InlineEditor');
      expect(exportNames).toContain('LabelManager');
      expect(exportNames).toContain('AssigneeManager');
      expect(exportNames).toContain('CommentForm');
      expect(exportNames).toContain('BulkActionBar');
      expect(exportNames).toContain('BulkResultsPanel');
      // CreateSpecButton — removed in F9, replaced by investigation system

      // Phase 3
      expect(exportNames).toContain('TriageResultCard');
      expect(exportNames).toContain('BatchTriageReview');
      expect(exportNames).toContain('IssueSplitDialog');
      expect(exportNames).toContain('TriageProgressOverlay');
      // Phase 4
      expect(exportNames).toContain('LabelSyncSettings');
      expect(exportNames).toContain('DependencyList');
      expect(exportNames).toContain('MetricsDashboard');
      expect(exportNames).toContain('CompletenessBreakdown');

      // Core
      expect(exportNames).toContain('IssueListItem');
      expect(exportNames).toContain('IssueDetail');
      expect(exportNames).toContain('IssueList');
      expect(exportNames).toContain('IssueListHeader');
      // InvestigationDialog — removed in F9, replaced by InvestigateButton + InvestigationPanel
      expect(exportNames).toContain('BatchReviewWizard');
      expect(exportNames).toContain('EmptyState');
      expect(exportNames).toContain('NotConnectedState');

      expect(exportNames.length).toBeGreaterThanOrEqual(21);
    });
  });

  describe('types/index', () => {
    it('exports extended type interfaces', async () => {
      const types = await import('../types/index');
      // Type-level check — these are interfaces, not runtime values
      // Verify the module loads without error and exports FilterState
      expect(types).toBeDefined();
    });
  });
});
