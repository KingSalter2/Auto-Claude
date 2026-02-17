/**
 * Hook for filtering and sorting GitHub issues in the left panel list.
 * Mirrors usePRFiltering from the PRs panel.
 */

import { useMemo, useState, useCallback } from 'react';
import type { GitHubIssue } from '@shared/types';
import type { IssueFilterState, IssueStatusFilter, IssueSortOption } from '../types';

const DEFAULT_FILTERS: IssueFilterState = {
  searchQuery: '',
  reporters: [],
  statuses: ['open'],
  sortBy: 'newest',
};

export function useIssueListFiltering(issues: GitHubIssue[]) {
  const [filters, setFiltersState] = useState<IssueFilterState>(DEFAULT_FILTERS);

  // Derive unique reporters (authors) from issue data
  const reporters = useMemo(() => {
    const authorSet = new Set<string>();
    for (const issue of issues) {
      if (issue.author?.login) {
        authorSet.add(issue.author.login);
      }
    }
    return Array.from(authorSet).sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    );
  }, [issues]);

  // Filter and sort issues - memoized to avoid recomputation
  const filteredIssues = useMemo(() => {
    // Apply status filter first (this is the most common filter)
    const statusFiltered = issues.filter((issue) => {
      if (filters.statuses.length === 0) return true;
      return filters.statuses.includes(issue.state as IssueStatusFilter);
    });

    // Early return if no other filters active
    if (
      !filters.searchQuery &&
      filters.reporters.length === 0 &&
      filters.sortBy === 'newest'
    ) {
      // Just apply sorting
      return statusFiltered.slice().sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
    }

    const filtered = statusFiltered.filter((issue) => {
      // Search filter — matches title, body, and issue number
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(query);
        const matchesBody = issue.body?.toLowerCase().includes(query);
        const matchesNumber = issue.number.toString().includes(query);
        if (!matchesTitle && !matchesBody && !matchesNumber) {
          return false;
        }
      }

      // Reporter filter (multi-select)
      if (filters.reporters.length > 0) {
        const authorLogin = issue.author?.login;
        if (!authorLogin || !filters.reporters.includes(authorLogin)) {
          return false;
        }
      }

      return true;
    });

    // Sort with stable timestamp cache
    return filtered.sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();

      switch (filters.sortBy) {
        case 'newest':
          return bTime - aTime;
        case 'oldest':
          return aTime - bTime;
        case 'most_commented': {
          const diff = (b.commentsCount || 0) - (a.commentsCount || 0);
          if (diff !== 0) return diff;
          return bTime - aTime;
        }
        default:
          return 0;
      }
    });
  }, [issues, filters]);

  const setSearchQuery = useCallback((query: string) => {
    setFiltersState((prev) => ({ ...prev, searchQuery: query }));
  }, []);

  const setReporters = useCallback((reporters: string[]) => {
    setFiltersState((prev) => ({ ...prev, reporters }));
  }, []);

  const setStatuses = useCallback((statuses: IssueStatusFilter[]) => {
    setFiltersState((prev) => ({ ...prev, statuses }));
  }, []);

  const setSortBy = useCallback((sortBy: IssueSortOption) => {
    setFiltersState((prev) => ({ ...prev, sortBy }));
  }, []);

  const clearFilters = useCallback(() => {
    setFiltersState((prev) => ({
      ...DEFAULT_FILTERS,
      sortBy: prev.sortBy,
    }));
  }, []);

  const hasActiveFilters = useMemo(() => {
    // Compare against defaults — status 'open' is the default, not an active filter
    const statusChanged =
      filters.statuses.length !== DEFAULT_FILTERS.statuses.length ||
      filters.statuses.some((s, i) => s !== DEFAULT_FILTERS.statuses[i]);
    return (
      filters.searchQuery !== '' ||
      filters.reporters.length > 0 ||
      statusChanged
    );
  }, [filters]);

  return {
    filteredIssues,
    reporters,
    filters,
    setSearchQuery,
    setReporters,
    setStatuses,
    setSortBy,
    clearFilters,
    hasActiveFilters,
  };
}
