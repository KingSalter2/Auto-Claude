import { useEffect, useCallback, useRef, useMemo, useState } from "react";
import {
  useIssuesStore,
  useSyncStatusStore,
  loadGitHubIssues,
  loadMoreGitHubIssues,
  checkGitHubConnection,
  shallow,
} from "../../../stores/github";
import type { FilterState } from "../types";

export function useGitHubIssues(projectId: string | undefined) {
  // Single subscription using shallow comparison
  const { issues, isLoading, isLoadingMore, error, selectedIssueNumber, filterState, hasMore } = useIssuesStore(
    (s) => ({
      issues: s.issues,
      isLoading: s.isLoading,
      isLoadingMore: s.isLoadingMore,
      error: s.error,
      selectedIssueNumber: s.selectedIssueNumber,
      filterState: s.filterState,
      hasMore: s.hasMore,
    }),
    shallow
  );

  const selectIssue = useIssuesStore((s) => s.selectIssue);
  const setFilterState = useIssuesStore((s) => s.setFilterState);

  const syncStatus = useSyncStatusStore((s) => s.syncStatus);

  // Track if we've checked connection for this mount
  const hasCheckedRef = useRef(false);

  // Track if search is active (need to load all issues for search)
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Reset search state when projectId changes to prevent incorrect fetchAll mode
  useEffect(() => {
    setIsSearchActive(false);
  }, []);

  // Always check connection when component mounts or projectId changes
  useEffect(() => {
    if (projectId) {
      // Always check connection on mount (in case settings changed)
      checkGitHubConnection(projectId);
      hasCheckedRef.current = true;
    }
  }, [projectId]);

  // Load issues once on mount or when connection is established.
  // Always fetch 'all' issues from API - filter/search changes are handled client-side by useIssueListFiltering.
  // This prevents the cascade where filterState changes trigger re-fetches.
  // Note: filterState intentionally NOT in deps - filtering is client-side only.
  useEffect(() => {
    if (projectId && syncStatus?.connected) {
      // Always fetch 'all' from API - let client-side filtering handle the rest
      loadGitHubIssues(projectId, 'all', false);
    }
  }, [projectId, syncStatus?.connected]);

  const handleRefresh = useCallback(() => {
    if (projectId) {
      // Re-check connection and reload issues (paginated mode - client-side filtering)
      checkGitHubConnection(projectId);
      loadGitHubIssues(projectId, 'all', false);
    }
  }, [projectId]);

  const handleFilterChange = useCallback(
    (state: FilterState) => {
      // Only update filter state - filtering is now client-side, no API call needed
      setFilterState(state);
    },
    [setFilterState]
  );

  const handleLoadMore = useCallback(() => {
    if (projectId && !isSearchActive) {
      // Always load 'all' from API - client-side filtering handles the rest
      loadMoreGitHubIssues(projectId, 'all');
    }
  }, [projectId, isSearchActive]);

  // When user starts searching - just track state, no API call needed (client-side filtering)
  const handleSearchStart = useCallback(() => {
    if (!isSearchActive && projectId) {
      setIsSearchActive(true);
      // No API call - filtering is now client-side on already-loaded issues
    }
  }, [isSearchActive, projectId]);

  // When user clears search - just track state, no API call needed
  const handleSearchClear = useCallback(() => {
    if (isSearchActive && projectId) {
      setIsSearchActive(false);
      // No API call - filtering is client-side
    }
  }, [isSearchActive, projectId]);

  // Compute selectedIssue from issues array
  const selectedIssue = useMemo(() => {
    return issues.find((i) => i.number === selectedIssueNumber) || null;
  }, [issues, selectedIssueNumber]);

    const getOpenIssuesCount = useCallback(() => useIssuesStore.getState().getOpenIssuesCount(), []);

  return {
    issues,
    syncStatus,
    isLoading,
    isLoadingMore,
    error,
    selectedIssueNumber,
    selectedIssue,
    filterState,
    hasMore: !isSearchActive && hasMore, // No "load more" when search is active
    selectIssue,
    getOpenIssuesCount,
    handleRefresh,
    handleFilterChange,
    handleLoadMore,
    handleSearchStart,
    handleSearchClear,
  };
}
