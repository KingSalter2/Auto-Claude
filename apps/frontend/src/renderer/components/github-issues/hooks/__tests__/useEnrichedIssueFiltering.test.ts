/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEnrichedIssueFiltering } from '../useEnrichedIssueFiltering';
import { useIssuesStore } from '../../../../stores/github/issues-store';
import { useEnrichmentStore } from '../../../../stores/github/enrichment-store';
import { createDefaultEnrichment } from '../../../../../shared/types/enrichment';
import type { GitHubIssue } from '../../../../../shared/types/integrations';
import type { IssueEnrichment } from '../../../../../shared/types/enrichment';

function mockIssue(number: number, overrides?: Partial<GitHubIssue>): GitHubIssue {
  return {
    id: number,
    number,
    title: `Issue #${number}`,
    state: 'open',
    labels: [],
    assignees: [],
    author: { login: 'user' },
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    commentsCount: 0,
    url: `https://api.github.com/repos/test/repo/issues/${number}`,
    htmlUrl: `https://github.com/test/repo/issues/${number}`,
    repoFullName: 'test/repo',
    ...overrides,
  };
}

beforeEach(() => {
  useIssuesStore.setState({ issues: [], selectedIssueNumber: null, error: null });
  useEnrichmentStore.setState({ enrichments: {}, isLoaded: false, isLoading: false, error: null });
});

describe('useEnrichedIssueFiltering', () => {
  it('returns all issues with no filters', () => {
    useIssuesStore.setState({ issues: [mockIssue(1), mockIssue(2), mockIssue(3)] });

    const { result } = renderHook(() => useEnrichedIssueFiltering());
    expect(result.current.filteredIssues).toHaveLength(3);
    expect(result.current.totalCount).toBe(3);
  });

  it('filters by single workflow state', () => {
    useIssuesStore.setState({ issues: [mockIssue(1), mockIssue(2)] });
    useEnrichmentStore.setState({
      enrichments: {
        '1': { ...createDefaultEnrichment(1), triageState: 'triage' } as IssueEnrichment,
        '2': { ...createDefaultEnrichment(2), triageState: 'new' } as IssueEnrichment,
      },
    });

    const { result } = renderHook(() =>
      useEnrichedIssueFiltering({ workflowStates: ['triage'] }),
    );
    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].issue.number).toBe(1);
  });

  it('filters by multiple workflow states (union)', () => {
    useIssuesStore.setState({ issues: [mockIssue(1), mockIssue(2), mockIssue(3)] });
    useEnrichmentStore.setState({
      enrichments: {
        '1': { ...createDefaultEnrichment(1), triageState: 'triage' } as IssueEnrichment,
        '2': { ...createDefaultEnrichment(2), triageState: 'ready' } as IssueEnrichment,
        '3': { ...createDefaultEnrichment(3), triageState: 'done' } as IssueEnrichment,
      },
    });

    const { result } = renderHook(() =>
      useEnrichedIssueFiltering({ workflowStates: ['triage', 'ready'] }),
    );
    expect(result.current.filteredIssues).toHaveLength(2);
  });

  it('filters by completeness threshold', () => {
    useIssuesStore.setState({ issues: [mockIssue(1), mockIssue(2)] });
    useEnrichmentStore.setState({
      enrichments: {
        '1': { ...createDefaultEnrichment(1), completenessScore: 60 } as IssueEnrichment,
        '2': { ...createDefaultEnrichment(2), completenessScore: 30 } as IssueEnrichment,
      },
    });

    const { result } = renderHook(() =>
      useEnrichedIssueFiltering({ minCompleteness: 50 }),
    );
    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].issue.number).toBe(1);
  });

  it('treats issues without enrichment as new with 0% completeness', () => {
    useIssuesStore.setState({ issues: [mockIssue(1), mockIssue(2)] });
    // No enrichment at all

    const { result } = renderHook(() =>
      useEnrichedIssueFiltering({ workflowStates: ['new'] }),
    );
    expect(result.current.filteredIssues).toHaveLength(2);
    expect(result.current.filteredIssues[0].triageState).toBe('new');
    expect(result.current.filteredIssues[0].completenessScore).toBe(0);
  });

  it('combines workflow state + search query', () => {
    useIssuesStore.setState({
      issues: [
        mockIssue(1, { title: 'Bug in login' }),
        mockIssue(2, { title: 'Feature request' }),
        mockIssue(3, { title: 'Bug in dashboard' }),
      ],
    });
    useEnrichmentStore.setState({
      enrichments: {
        '1': { ...createDefaultEnrichment(1), triageState: 'triage' } as IssueEnrichment,
        '2': { ...createDefaultEnrichment(2), triageState: 'triage' } as IssueEnrichment,
        '3': { ...createDefaultEnrichment(3), triageState: 'new' } as IssueEnrichment,
      },
    });

    const { result } = renderHook(() =>
      useEnrichedIssueFiltering({
        workflowStates: ['triage'],
        searchQuery: 'Bug',
      }),
    );
    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].issue.number).toBe(1);
  });

  it('returns empty for empty issues', () => {
    const { result } = renderHook(() => useEnrichedIssueFiltering());
    expect(result.current.filteredIssues).toHaveLength(0);
    expect(result.current.totalCount).toBe(0);
  });

  it('filters by GitHub state', () => {
    useIssuesStore.setState({
      issues: [
        mockIssue(1, { state: 'open' }),
        mockIssue(2, { state: 'closed' }),
      ],
    });

    const { result } = renderHook(() =>
      useEnrichedIssueFiltering({ githubState: 'open' }),
    );
    expect(result.current.filteredIssues).toHaveLength(1);
    expect(result.current.filteredIssues[0].issue.number).toBe(1);
  });
});
