/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEnrichedIssue } from '../useEnrichedIssue';
import { useIssuesStore } from '../../../../stores/github/issues-store';
import { useEnrichmentStore } from '../../../../stores/github/enrichment-store';
import { createDefaultEnrichment } from '../../../../../shared/types/enrichment';
import type { GitHubIssue } from '../../../../../shared/types/integrations';

function mockIssue(number: number): GitHubIssue {
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
  };
}

beforeEach(() => {
  useIssuesStore.setState({ issues: [], selectedIssueNumber: null, error: null });
  useEnrichmentStore.setState({ enrichments: {}, isLoaded: false, isLoading: false, error: null });
});

describe('useEnrichedIssue', () => {
  it('returns null for null issueNumber', () => {
    const { result } = renderHook(() => useEnrichedIssue(null));
    expect(result.current).toBeNull();
  });

  it('returns null for non-existent issue', () => {
    const { result } = renderHook(() => useEnrichedIssue(99));
    expect(result.current).toBeNull();
  });

  it('returns issue with matching enrichment', () => {
    const issue = mockIssue(42);
    const enrichment = createDefaultEnrichment(42);
    useIssuesStore.setState({ issues: [issue] });
    useEnrichmentStore.setState({ enrichments: { '42': enrichment } });

    const { result } = renderHook(() => useEnrichedIssue(42));
    expect(result.current?.issue.number).toBe(42);
    expect(result.current?.enrichment?.issueNumber).toBe(42);
  });

  it('returns issue with null enrichment when not enriched', () => {
    const issue = mockIssue(42);
    useIssuesStore.setState({ issues: [issue] });

    const { result } = renderHook(() => useEnrichedIssue(42));
    expect(result.current?.issue.number).toBe(42);
    expect(result.current?.enrichment).toBeNull();
  });
});
