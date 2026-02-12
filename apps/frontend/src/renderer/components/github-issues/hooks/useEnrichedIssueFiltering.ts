import { useMemo } from 'react';
import { useIssuesStore } from '../../../stores/github/issues-store';
import { useEnrichmentStore } from '../../../stores/github/enrichment-store';
import type { WorkflowState } from '../../../../shared/types/enrichment';
import type { GitHubIssue } from '../../../../shared/types/integrations';

export interface EnrichedIssueFilterOptions {
  workflowStates?: WorkflowState[];
  minCompleteness?: number;
  searchQuery?: string;
  githubState?: 'open' | 'closed' | 'all';
}

export interface EnrichedIssueItem {
  issue: GitHubIssue;
  triageState: WorkflowState;
  completenessScore: number;
}

export function useEnrichedIssueFiltering(
  options: EnrichedIssueFilterOptions = {},
): { filteredIssues: EnrichedIssueItem[]; totalCount: number } {
  const issues = useIssuesStore((s) => s.issues);
  const enrichments = useEnrichmentStore((s) => s.enrichments);

  return useMemo(() => {
    const { workflowStates, minCompleteness, searchQuery, githubState } = options;

    let items: EnrichedIssueItem[] = issues.map((issue) => {
      const enrichment = enrichments[String(issue.number)];
      return {
        issue,
        triageState: enrichment?.triageState ?? 'new',
        completenessScore: enrichment?.completenessScore ?? 0,
      };
    });

    // Filter by GitHub state
    if (githubState && githubState !== 'all') {
      items = items.filter((item) => item.issue.state === githubState);
    }

    // Filter by workflow states
    if (workflowStates && workflowStates.length > 0) {
      items = items.filter((item) => workflowStates.includes(item.triageState));
    }

    // Filter by completeness threshold
    if (minCompleteness !== undefined && minCompleteness > 0) {
      items = items.filter((item) => item.completenessScore >= minCompleteness);
    }

    // Filter by search query
    if (searchQuery && searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.issue.title.toLowerCase().includes(query) ||
          item.issue.body?.toLowerCase().includes(query),
      );
    }

    return { filteredIssues: items, totalCount: issues.length };
  }, [issues, enrichments, options]);
}
