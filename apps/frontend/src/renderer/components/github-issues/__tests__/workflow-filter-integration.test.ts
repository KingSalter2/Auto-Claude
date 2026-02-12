import { describe, it, expect } from 'vitest';
import type { IssueEnrichment, WorkflowState } from '../../../../shared/types/enrichment';

/**
 * Unit tests for the workflow filter logic extracted from GitHubIssues container.
 * Tests the pure filtering function without React rendering.
 */

interface MinimalIssue {
  number: number;
  state: 'open' | 'closed';
  title: string;
}

function applyWorkflowFilter(
  issues: MinimalIssue[],
  enrichments: Record<string, Partial<IssueEnrichment>>,
  workflowFilter: WorkflowState[],
): MinimalIssue[] {
  if (workflowFilter.length === 0) return issues;
  return issues.filter((issue) => {
    const state = (enrichments[String(issue.number)]?.triageState ?? 'new') as WorkflowState;
    return workflowFilter.includes(state);
  });
}

const issues: MinimalIssue[] = [
  { number: 1, state: 'open', title: 'Issue 1' },
  { number: 2, state: 'open', title: 'Issue 2' },
  { number: 3, state: 'closed', title: 'Issue 3' },
  { number: 4, state: 'open', title: 'Issue 4' },
  { number: 5, state: 'open', title: 'Issue 5' },
];

const enrichments: Record<string, Partial<IssueEnrichment>> = {
  '1': { triageState: 'new' as WorkflowState },
  '2': { triageState: 'triage' as WorkflowState },
  '3': { triageState: 'done' as WorkflowState },
  '4': { triageState: 'ready' as WorkflowState },
  // Issue 5 has no enrichment — defaults to 'new'
};

describe('Workflow filter integration', () => {
  it('empty filter shows all issues', () => {
    const result = applyWorkflowFilter(issues, enrichments, []);
    expect(result.length).toBe(5);
  });

  it('filter to new shows unenriched issues and new state', () => {
    const result = applyWorkflowFilter(issues, enrichments, ['new']);
    expect(result.map((i) => i.number)).toEqual([1, 5]);
  });

  it('filter to triage and ready shows matching issues', () => {
    const result = applyWorkflowFilter(issues, enrichments, ['triage', 'ready']);
    expect(result.map((i) => i.number)).toEqual([2, 4]);
  });

  it('filter to done includes closed issues with done state', () => {
    const result = applyWorkflowFilter(issues, enrichments, ['done']);
    expect(result.map((i) => i.number)).toEqual([3]);
  });

  it('combines with pre-filtered issues (simulating text search)', () => {
    // Simulate text search already filtering to issues 1, 2, 3
    const preFiltered = issues.filter((i) => i.number <= 3);
    const result = applyWorkflowFilter(preFiltered, enrichments, ['new']);
    expect(result.map((i) => i.number)).toEqual([1]);
  });

  it('returns empty when no issues match filter', () => {
    const result = applyWorkflowFilter(issues, enrichments, ['in_progress']);
    expect(result.length).toBe(0);
  });
});
