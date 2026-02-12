import { useMemo } from 'react';
import { useIssuesStore } from '../../../stores/github/issues-store';
import { useEnrichmentStore } from '../../../stores/github/enrichment-store';
import type { GitHubIssue } from '../../../../shared/types/integrations';
import type { IssueEnrichment } from '../../../../shared/types/enrichment';

export interface EnrichedIssue {
  issue: GitHubIssue;
  enrichment: IssueEnrichment | null;
}

export function useEnrichedIssue(issueNumber: number | null): EnrichedIssue | null {
  const issues = useIssuesStore((s) => s.issues);
  const enrichments = useEnrichmentStore((s) => s.enrichments);

  return useMemo(() => {
    if (issueNumber === null) return null;
    const issue = issues.find((i) => i.number === issueNumber);
    if (!issue) return null;
    const enrichment = enrichments[String(issueNumber)] ?? null;
    return { issue, enrichment };
  }, [issueNumber, issues, enrichments]);
}
