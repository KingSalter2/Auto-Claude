import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../stores/project-store";
import { useTaskStore } from "../stores/task-store";
import { useIssuesStore } from "../stores/github/issues-store";
import {
  useInvestigationStore,
  startIssueInvestigation,
  cancelIssueInvestigation,
  loadPersistedInvestigations,
} from "../stores/github";
import { loadTasks } from "../stores/task-store";
import {
  useGitHubIssues,
  useIssueFiltering,
  useAutoFix,
  useBulkOperations,
  useMutations,
  useDependencies,
} from "./github-issues/hooks";
import { useAnalyzePreview } from "./github-issues/hooks/useAnalyzePreview";
import {
  NotConnectedState,
  EmptyState,
  IssueListHeader,
  IssueList,
  IssueDetail,
  BatchReviewWizard,
  BulkActionBar,
  BulkResultsPanel,
} from "./github-issues/components";
import { GitHubSetupModal } from "./GitHubSetupModal";
import { ResizablePanels } from "./ui/resizable-panels";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "./ui/alert-dialog";
import { useMutationStore } from "../stores/github/mutation-store";
import type { GitHubIssue, InvestigationState, InvestigationDismissReason, SuggestedLabel } from "../../shared/types";
import type { GitHubIssuesProps } from "./github-issues/types";

export function GitHubIssues({ onOpenSettings, onNavigateToTask }: GitHubIssuesProps) {
  const { t } = useTranslation("common");
  const projects = useProjectStore((state) => state.projects);
  const selectedProjectId = useProjectStore((state) => state.selectedProjectId);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const tasks = useTaskStore((state) => state.tasks);

  const {
    syncStatus,
    isLoading,
    isLoadingMore,
    error,
    selectedIssueNumber,
    selectedIssue,
    filterState,
    hasMore,
    selectIssue,
    getOpenIssuesCount,
    handleRefresh,
    handleFilterChange,
    handleLoadMore,
    handleSearchStart,
    handleSearchClear,
  } = useGitHubIssues(selectedProject?.id);

  // Investigation store — multi-issue keyed state
  const investigationStore = useInvestigationStore();

  // FE-1 fix: Subscribe to issues/filterState individually and memoize the
  // filtered list instead of calling getFilteredIssues() which creates a new
  // array on every render.
  const storeIssues = useIssuesStore((s) => s.issues);
  const storeFilterState = useIssuesStore((s) => s.filterState);
  const memoizedFilteredIssues = useMemo(() => {
    if (storeFilterState === 'all') return storeIssues;
    return storeIssues.filter((issue) => issue.state === storeFilterState);
  }, [storeIssues, storeFilterState]);

  const { searchQuery, setSearchQuery, filteredIssues, isSearchActive } = useIssueFiltering(
    memoizedFilteredIssues,
    {
      onSearchStart: handleSearchStart,
      onSearchClear: handleSearchClear,
    }
  );

  const {
    config: autoFixConfig,
    getQueueItem: getAutoFixQueueItem,
    isBatchRunning,
    batchProgress,
    toggleAutoFix,
    checkForNewIssues,
  } = useAutoFix(selectedProject?.id);

  // Analyze & Group Issues (proactive workflow)
  const {
    isWizardOpen,
    isAnalyzing,
    isApproving,
    analysisProgress,
    analysisResult,
    analysisError,
    openWizard,
    closeWizard,
    startAnalysis,
    approveBatches,
  } = useAnalyzePreview({ projectId: selectedProject?.id || "" });

  // Investigation state filter
  const [investigationStateFilter, setInvestigationStateFilter] = useState<InvestigationState[]>([]);
  const [showDismissed, setShowDismissed] = useState(false);

  // Label consent dialog state
  const [showLabelConsent, setShowLabelConsent] = useState(false);
  const pendingInvestigationRef = useRef<{ type: 'single'; issue: GitHubIssue } | { type: 'bulk' } | null>(null);

  // Apply investigation state filter to issues
  const investigationFilteredIssues = useMemo(() => {
    if (investigationStateFilter.length === 0 && showDismissed) return filteredIssues;
    return filteredIssues.filter((issue) => {
      const projectId = selectedProject?.id;
      if (!projectId) return true;
      const entry = investigationStore.getInvestigationState(projectId, issue.number);

      // Filter out dismissed unless showDismissed is on
      if (entry?.dismissReason && !showDismissed) return false;

      // If no investigation state filter, show all non-dismissed
      if (investigationStateFilter.length === 0) return true;

      const state = investigationStore.getDerivedState(projectId, issue.number);
      return investigationStateFilter.includes(state);
    });
  }, [filteredIssues, investigationStateFilter, showDismissed, investigationStore, selectedProject?.id]);

  // Build investigation state counts
  const investigationStateCounts = useMemo(() => {
    const counts: Partial<Record<InvestigationState, number>> = {};
    if (!selectedProject?.id) return counts;
    for (const issue of filteredIssues) {
      const state = investigationStore.getDerivedState(selectedProject.id, issue.number);
      counts[state] = (counts[state] ?? 0) + 1;
    }
    return counts;
  }, [filteredIssues, investigationStore, selectedProject?.id]);

  // Active investigation count
  const activeInvestigations = useMemo(() => {
    if (!selectedProject?.id) return [];
    return investigationStore.getActiveInvestigations(selectedProject.id);
  }, [investigationStore, selectedProject?.id]);

  // Build investigation states map for IssueList
  const investigationStatesMap = useMemo(() => {
    const map: Record<string, { state: InvestigationState; progress?: number; linkedTaskId?: string; isStale?: boolean }> = {};
    if (!selectedProject?.id) return map;
    for (const issue of investigationFilteredIssues) {
      const state = investigationStore.getDerivedState(selectedProject.id, issue.number);
      const entry = investigationStore.getInvestigationState(selectedProject.id, issue.number);
      const issueKey = String(issue.number);
      map[issueKey] = {
        state,
        progress: entry?.progress?.progress,
        linkedTaskId: entry?.specId ?? undefined,
        isStale: entry?.isStale,
      };
    }
    return map;
  }, [investigationFilteredIssues, investigationStore, selectedProject?.id]);

  // Bulk operations
  const { executeBulk, isOperating: isBulkOperating } = useBulkOperations(selectedProject?.id ?? '');
  const [selectedIssueNumbers, setSelectedIssueNumbers] = useState<Set<number>>(new Set());

  const handleToggleSelect = useCallback((issueNumber: number) => {
    setSelectedIssueNumbers(prev => {
      const next = new Set(prev);
      if (next.has(issueNumber)) next.delete(issueNumber);
      else next.add(issueNumber);
      return next;
    });
  }, []);

  const handleBulkAction = useCallback(
    (action: Parameters<typeof executeBulk>[0], payload?: Parameters<typeof executeBulk>[2]) => {
      executeBulk(action, [...selectedIssueNumbers], payload);
    },
    [executeBulk, selectedIssueNumbers],
  );

  const handleSelectAll = useCallback(() => {
    setSelectedIssueNumbers(new Set(investigationFilteredIssues.map((i) => i.number)));
  }, [investigationFilteredIssues]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIssueNumbers(new Set());
  }, []);

  // Clear selection when bulk operation completes
  const wasBulkOperating = useRef(false);
  useEffect(() => {
    if (wasBulkOperating.current && !isBulkOperating) {
      setSelectedIssueNumbers(new Set());
    }
    wasBulkOperating.current = isBulkOperating;
  }, [isBulkOperating]);

  // Bulk operation results
  const bulkResult = useMutationStore((s) => s.bulkResult);
  const clearBulkResult = useMutationStore((s) => s.clearBulkResult);

  // Dependencies for selected issue
  const { dependencies, isLoading: isDepsLoading, error: depsError } = useDependencies(selectedIssue?.number ?? null);

  // Issue mutations (edit, close, reopen, comment, labels, assignees)
  const mutations = useMutations(selectedProject?.id ?? '');

  // Wrapped mutation callbacks bound to selected issue
  const handleEditTitle = useCallback(
    async (title: string) => { if (selectedIssue) await mutations.editTitle(selectedIssue.number, title); },
    [selectedIssue, mutations],
  );
  const handleEditBody = useCallback(
    async (body: string) => { if (selectedIssue) await mutations.editBody(selectedIssue.number, body); },
    [selectedIssue, mutations],
  );
  const handleCloseIssue = useCallback(
    async (comment?: string) => {
      if (!selectedIssue) return;
      if (comment) await mutations.addComment(selectedIssue.number, comment);
      await mutations.closeIssue(selectedIssue.number);
    },
    [selectedIssue, mutations],
  );
  const handleReopenIssue = useCallback(
    async () => { if (selectedIssue) await mutations.reopenIssue(selectedIssue.number); },
    [selectedIssue, mutations],
  );
  const handleAddComment = useCallback(
    async (body: string) => { if (selectedIssue) await mutations.addComment(selectedIssue.number, body); },
    [selectedIssue, mutations],
  );
  const handleAddLabels = useCallback(
    async (labels: string[]) => { if (selectedIssue) await mutations.addLabels(selectedIssue.number, labels); },
    [selectedIssue, mutations],
  );
  const handleRemoveLabels = useCallback(
    async (labels: string[]) => { if (selectedIssue) await mutations.removeLabels(selectedIssue.number, labels); },
    [selectedIssue, mutations],
  );
  const handleAddAssignees = useCallback(
    async (logins: string[]) => { if (selectedIssue) await mutations.addAssignees(selectedIssue.number, logins); },
    [selectedIssue, mutations],
  );
  const handleRemoveAssignees = useCallback(
    async (logins: string[]) => { if (selectedIssue) await mutations.removeAssignees(selectedIssue.number, logins); },
    [selectedIssue, mutations],
  );

  // Fetch repo labels & collaborators for mutation UI
  const [repoLabels, setRepoLabels] = useState<Array<{ name: string; color: string }>>([]);
  const [collaborators, setCollaborators] = useState<string[]>([]);

  useEffect(() => {
    if (!selectedProject?.id) return;
    window.electronAPI.github.getRepoLabels(selectedProject.id).then((res) => {
      if (res.success && res.data) setRepoLabels(res.data);
    });
    window.electronAPI.github.getRepoCollaborators(selectedProject.id).then((res) => {
      if (res.success && res.data) setCollaborators(res.data);
    });
  }, [selectedProject?.id]);

  // Load persisted investigation state from disk on project change
  useEffect(() => {
    if (!selectedProject?.id) return;
    loadPersistedInvestigations(selectedProject.id);
  }, [selectedProject?.id]);

  // Mark stale investigations: cross-reference investigations with fetched issues
  useEffect(() => {
    if (!selectedProject?.id || storeIssues.length === 0) return;
    const activeIssueNumbers = new Set(storeIssues.map((issue) => issue.number));
    investigationStore.markStaleInvestigations(selectedProject.id, activeIssueNumbers);
  }, [storeIssues, selectedProject?.id, investigationStore]);

  // Clear selection when filters change
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter/search change
  useEffect(() => {
    setSelectedIssueNumbers(new Set());
  }, [investigationStateFilter, filterState, searchQuery]);

  const [showGitHubSetup, setShowGitHubSetup] = useState(false);

  // Show GitHub setup modal when module is not installed
  useEffect(() => {
    if (analysisError?.includes("GitHub automation module not installed")) {
      setShowGitHubSetup(true);
    }
  }, [analysisError]);

  // Build a map of GitHub issue numbers to task IDs for quick lookup
  const issueToTaskMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const task of tasks) {
      if (task.metadata?.githubIssueNumber) {
        map.set(task.metadata.githubIssueNumber, task.specId || task.id);
      }
    }
    return map;
  }, [tasks]);

  // Sync investigation state with linked task status changes
  // When a task linked to an issue changes status, update the investigation store
  // Also detect deleted tasks and revert investigations to findings_ready
  useEffect(() => {
    if (!selectedProject?.id) return;
    const projectId = selectedProject.id;

    // Build a set of specIds from current tasks for fast lookup
    const taskSpecIds = new Set<string>();
    for (const task of tasks) {
      const specId = task.specId || task.id;
      if (specId) taskSpecIds.add(specId);
    }

    for (const task of tasks) {
      const issueNumber = task.metadata?.githubIssueNumber;
      if (!issueNumber || !task.status) continue;

      // Only sync if there's a corresponding investigation with a specId
      const inv = investigationStore.getInvestigationState(projectId, issueNumber);
      if (!inv?.specId) continue;

      investigationStore.syncTaskState(projectId, issueNumber, task.status);
    }

    // Detect deleted tasks: if an investigation has a specId but no matching task exists
    const { investigations } = useInvestigationStore.getState();
    for (const inv of Object.values(investigations)) {
      if (inv.projectId !== projectId || !inv.specId) continue;
      if (!taskSpecIds.has(inv.specId)) {
        investigationStore.clearLinkedTask(projectId, inv.issueNumber);
      }
    }
  }, [tasks, selectedProject?.id, investigationStore]);

  // Auto-close GitHub issues when linked task reaches "done" and autoCloseIssues is enabled
  const autoClosedRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!selectedProject?.id) return;
    const projectId = selectedProject.id;
    const settings = investigationStore.getSettings(projectId);
    if (!settings?.autoCloseIssues) return;

    for (const task of tasks) {
      const issueNumber = task.metadata?.githubIssueNumber;
      if (!issueNumber) continue;

      // Only auto-close when task reaches done/pr_created
      if (task.status !== 'done' && task.status !== 'pr_created') continue;

      // Skip if already auto-closed in this session
      if (autoClosedRef.current.has(issueNumber)) continue;

      // Check that there's an investigation for this issue (auto-close only applies to investigated issues)
      const state = investigationStore.getDerivedState(projectId, issueNumber);
      if (state !== 'done') continue;

      // Mark as auto-closed to prevent duplicate close attempts
      autoClosedRef.current.add(issueNumber);

      // Close the issue via GitHub API
      window.electronAPI.github.closeIssue(projectId, issueNumber).then((result) => {
        if (result.success) {
          // Update the local issue state to reflect closure
          useIssuesStore.getState().updateIssue(issueNumber, { state: 'closed' });
          console.log(`[GitHubIssues] Auto-closed issue #${issueNumber} (linked task completed)`);
        } else {
          // Remove from auto-closed set so it can be retried
          autoClosedRef.current.delete(issueNumber);
          console.warn(`[GitHubIssues] Failed to auto-close issue #${issueNumber}:`, result.error);
        }
      });
    }
  }, [tasks, selectedProject?.id, investigationStore]);

  // Clear auto-closed tracking on project change
  useEffect(() => {
    autoClosedRef.current = new Set();
  }, [selectedProject?.id]);

  // Reset local state on project change
  useEffect(() => {
    return () => {
      setSelectedIssueNumbers(new Set());
      setRepoLabels([]);
      setCollaborators([]);
      setInvestigationStateFilter([]);
      setShowDismissed(false);
      useMutationStore.getState().clearBulkResult();
    };
  }, [selectedProject?.id, syncStatus?.connected]);

  // Enhanced refresh
  const handleRefreshWithAutoFix = useCallback(() => {
    handleRefresh();
    if (autoFixConfig?.enabled) {
      checkForNewIssues();
    }
  }, [handleRefresh, autoFixConfig?.enabled, checkForNewIssues]);

  // Helper: check if label consent is needed before investigating
  const needsLabelConsent = useCallback(() => {
    if (!selectedProject?.id) return false;
    const settings = investigationStore.getSettings(selectedProject.id);
    return !settings?.labelConsentGiven;
  }, [selectedProject?.id, investigationStore]);

  // Helper: grant label consent and persist
  const grantLabelConsent = useCallback(() => {
    if (!selectedProject?.id) return;
    const current = investigationStore.getSettings(selectedProject.id);
    const updated = { ...(current ?? { autoCreateTasks: false, autoStartTasks: false, pipelineMode: 'full' as const, autoPostToGitHub: false, autoCloseIssues: false, maxParallelInvestigations: 3, labelIncludeFilter: [] as string[], labelExcludeFilter: [] as string[] }), labelConsentGiven: true };
    investigationStore.setSettings(selectedProject.id, updated);
    if (window.electronAPI?.github?.saveInvestigationSettings) {
      window.electronAPI.github.saveInvestigationSettings(selectedProject.id, updated).catch(() => {});
    }
  }, [selectedProject?.id, investigationStore]);

  // Investigation callbacks for selected issue
  const handleInvestigate = useCallback((issue: GitHubIssue) => {
    if (!selectedProject?.id) return;
    if (needsLabelConsent()) {
      pendingInvestigationRef.current = { type: 'single', issue };
      setShowLabelConsent(true);
      return;
    }
    startIssueInvestigation(selectedProject.id, issue.number);
  }, [selectedProject?.id, needsLabelConsent]);

  // Bulk investigate: queue all selected issues for investigation
  const handleBulkInvestigate = useCallback(() => {
    if (!selectedProject?.id) return;
    if (needsLabelConsent()) {
      pendingInvestigationRef.current = { type: 'bulk' };
      setShowLabelConsent(true);
      return;
    }
    for (const issueNumber of selectedIssueNumbers) {
      startIssueInvestigation(selectedProject.id, issueNumber);
    }
  }, [selectedProject?.id, selectedIssueNumbers, needsLabelConsent]);

  // Handle consent dialog confirm
  const handleConsentConfirm = useCallback(() => {
    grantLabelConsent();
    setShowLabelConsent(false);
    if (!selectedProject?.id) return;
    const pending = pendingInvestigationRef.current;
    pendingInvestigationRef.current = null;
    if (!pending) return;
    if (pending.type === 'single') {
      startIssueInvestigation(selectedProject.id, pending.issue.number);
    } else {
      for (const issueNumber of selectedIssueNumbers) {
        startIssueInvestigation(selectedProject.id, issueNumber);
      }
    }
  }, [grantLabelConsent, selectedProject?.id, selectedIssueNumbers]);

  const handleCancelInvestigation = useCallback(() => {
    if (selectedProject?.id && selectedIssue) {
      cancelIssueInvestigation(selectedProject.id, selectedIssue.number);
    }
  }, [selectedProject?.id, selectedIssue]);

  const handleCreateTask = useCallback(async () => {
    if (!selectedProject?.id || !selectedIssue) return;
    const result = await window.electronAPI.github.createTaskFromInvestigation(
      selectedProject.id, selectedIssue.number
    );
    if (result.success) {
      loadTasks(selectedProject.id);
    }
  }, [selectedProject?.id, selectedIssue]);

  const handleDismissIssue = useCallback(async (reason: InvestigationDismissReason) => {
    if (!selectedProject?.id || !selectedIssue) return;
    await window.electronAPI.github.dismissIssue(selectedProject.id, selectedIssue.number, reason);
    investigationStore.dismiss(selectedProject.id, selectedIssue.number, reason);
  }, [selectedProject?.id, selectedIssue, investigationStore]);

  const handlePostToGitHub = useCallback(async () => {
    if (!selectedProject?.id || !selectedIssue) return;
    await window.electronAPI.github.postInvestigationToGitHub(selectedProject.id, selectedIssue.number);
  }, [selectedProject?.id, selectedIssue]);

  const [isPostingToGitHub, setIsPostingToGitHub] = useState(false);
  const handlePostToGitHubWrapped = useCallback(async () => {
    setIsPostingToGitHub(true);
    try {
      await handlePostToGitHub();
    } finally {
      setIsPostingToGitHub(false);
    }
  }, [handlePostToGitHub]);

  // Get per-issue investigation state for the selected issue
  const selectedIssueInvestigationState = useMemo(() => {
    if (!selectedProject?.id || !selectedIssue) return undefined;
    return investigationStore.getDerivedState(selectedProject.id, selectedIssue.number);
  }, [selectedProject?.id, selectedIssue, investigationStore]);

  const selectedIssueEntry = useMemo(() => {
    if (!selectedProject?.id || !selectedIssue) return null;
    return investigationStore.getInvestigationState(selectedProject.id, selectedIssue.number);
  }, [selectedProject?.id, selectedIssue, investigationStore]);

  // Not connected state
  if (!syncStatus?.connected) {
    return <NotConnectedState error={syncStatus?.error || null} onOpenSettings={onOpenSettings} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <IssueListHeader
        repoFullName={syncStatus.repoFullName ?? ""}
        openIssuesCount={getOpenIssuesCount()}
        isLoading={isLoading}
        searchQuery={searchQuery}
        filterState={filterState}
        onSearchChange={setSearchQuery}
        onFilterChange={handleFilterChange}
        onRefresh={handleRefreshWithAutoFix}
        autoFixEnabled={autoFixConfig?.enabled}
        autoFixRunning={isBatchRunning}
        autoFixProcessing={batchProgress?.totalIssues}
        onAutoFixToggle={toggleAutoFix}
        onAnalyzeAndGroup={openWizard}
        isAnalyzing={isAnalyzing}
        investigationStateFilter={investigationStateFilter}
        onInvestigationStateFilterChange={setInvestigationStateFilter}
        investigationStateCounts={investigationStateCounts}
        showDismissed={showDismissed}
        onToggleShowDismissed={() => setShowDismissed(!showDismissed)}
        activeInvestigationCount={activeInvestigations.length}
      />

      {/* Bulk Action Bar */}
      {selectedIssueNumbers.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIssueNumbers.size}
          onBulkAction={handleBulkAction}
          isOperating={isBulkOperating}
          onInvestigateSelected={handleBulkInvestigate}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      )}

      {/* Bulk Results Panel */}
      {bulkResult && (
        <BulkResultsPanel
          result={bulkResult}
          onRetry={() => { /* retry logic handled externally */ }}
          onDismiss={clearBulkResult}
        />
      )}

      {/* Content — 2-panel layout (investigation panel is inline in detail view) */}
      <ResizablePanels
        storageKey="github-issues-panel-2"
        defaultLeftWidth={50}
        minLeftWidth={25}
        maxLeftWidth={75}
        leftPanel={
          <section className="flex flex-col h-full border-r border-border" aria-label={t('panels.issueList')} tabIndex={-1}>
            <IssueList
              issues={investigationFilteredIssues}
              selectedIssueNumber={selectedIssueNumber}
              isLoading={isLoading}
              isLoadingMore={isLoadingMore}
              hasMore={hasMore && !isSearchActive}
              error={error}
              onSelectIssue={selectIssue}
              onInvestigate={handleInvestigate}
              onLoadMore={!isSearchActive ? handleLoadMore : undefined}
              selectedIssueNumbers={selectedIssueNumbers}
              onToggleSelect={handleToggleSelect}
              investigationStates={investigationStatesMap}
              onViewTask={onNavigateToTask}
            />
          </section>
        }
        rightPanel={
          <section className="flex flex-col h-full" aria-label={t('panels.issueDetail')} tabIndex={-1}>
            {selectedIssue ? (
              <IssueDetail
                issue={selectedIssue}
                onInvestigate={() => handleInvestigate(selectedIssue)}
                linkedTaskId={issueToTaskMap.get(selectedIssue.number)}
                onViewTask={onNavigateToTask}
                projectId={selectedProject?.id}
                autoFixConfig={autoFixConfig}
                autoFixQueueItem={getAutoFixQueueItem(selectedIssue.number)}
                onEditTitle={handleEditTitle}
                onEditBody={handleEditBody}
                onClose={handleCloseIssue}
                onReopen={handleReopenIssue}
                onComment={handleAddComment}
                onAddLabels={handleAddLabels}
                onRemoveLabels={handleRemoveLabels}
                repoLabels={repoLabels}
                onAddAssignees={handleAddAssignees}
                onRemoveAssignees={handleRemoveAssignees}
                collaborators={collaborators}
                dependencies={dependencies}
                isDepsLoading={isDepsLoading}
                depsError={depsError}
                onNavigateDependency={selectIssue}
                // Investigation system
                investigationState={selectedIssueInvestigationState}
                investigationReport={selectedIssueEntry?.report ?? null}
                investigationProgress={selectedIssueEntry?.progress?.progress}
                isInvestigating={selectedIssueEntry?.isInvestigating ?? false}
                investigationError={selectedIssueEntry?.error ?? null}
                onCancelInvestigation={handleCancelInvestigation}
                onCreateTask={handleCreateTask}
                onDismissIssue={handleDismissIssue}
                onPostToGitHub={handlePostToGitHubWrapped}
                isPostingToGitHub={isPostingToGitHub}
                investigationActivityLog={selectedIssueEntry?.activityLog}
              />
            ) : (
              <EmptyState message="Select an issue to view details" />
            )}
          </section>
        }
      />

      {/* Batch Review Wizard (Proactive workflow) */}
      <BatchReviewWizard
        isOpen={isWizardOpen}
        onClose={closeWizard}
        projectId={selectedProject?.id || ""}
        onStartAnalysis={startAnalysis}
        onApproveBatches={approveBatches}
        analysisProgress={analysisProgress}
        analysisResult={analysisResult}
        analysisError={analysisError}
        isAnalyzing={isAnalyzing}
        isApproving={isApproving}
      />

      {/* GitHub Setup Modal */}
      {selectedProject && (
        <GitHubSetupModal
          open={showGitHubSetup}
          onOpenChange={setShowGitHubSetup}
          project={selectedProject}
          onComplete={() => {
            setShowGitHubSetup(false);
            openWizard();
            startAnalysis();
          }}
          onSkip={() => setShowGitHubSetup(false)}
        />
      )}

      {/* Label Creation Consent Dialog */}
      <AlertDialog open={showLabelConsent} onOpenChange={setShowLabelConsent}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('investigation.labelConsent.title', 'Label Creation Notice')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('investigation.labelConsent.body', 'The first investigation will create up to 5 auto-claude:* labels on your GitHub repository to categorize investigation results. These labels are used for filtering and organization.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { pendingInvestigationRef.current = null; }}>
              {t('buttons.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConsentConfirm}>
              {t('investigation.labelConsent.confirm', 'Continue')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
