import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../stores/project-store";
import { useTaskStore } from "../stores/task-store";
import { useIssuesStore } from "../stores/github/issues-store";
import {
  useEnrichmentStore,
  loadEnrichment,
  transitionWorkflowState,
} from "../stores/github/enrichment-store";
import {
  useGitHubIssues,
  useGitHubInvestigation,
  useIssueFiltering,
  useAutoFix,
  useBulkOperations,
  useAITriage,
  useTriageMode,
  useMetrics,
  useMutations,
  useDependencies,
  useLabelSync,
} from "./github-issues/hooks";
import { useAnalyzePreview } from "./github-issues/hooks/useAnalyzePreview";
import {
  NotConnectedState,
  EmptyState,
  IssueListHeader,
  IssueList,
  IssueDetail,
  InvestigationDialog,
  BatchReviewWizard,
  BulkActionBar,
  BulkResultsPanel,
  TriageProgressOverlay,
  IssueSplitDialog,
  TriageSidebar,
  EnrichmentCommentPreview,
  BatchTriageReview,
} from "./github-issues/components";
import { GitHubSetupModal } from "./GitHubSetupModal";
import { useMutationStore } from "../stores/github/mutation-store";
import { useAITriageStore } from "../stores/github/ai-triage-store";
import { formatEnrichmentComment, ENRICHMENT_COMMENT_FOOTER } from "../../shared/constants/ai-triage";
import type { GitHubIssue } from "../../shared/types";
import type { GitHubIssuesProps } from "./github-issues/types";
import type { WorkflowState, Resolution } from "../../shared/types/enrichment";

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

  const {
    investigationStatus,
    lastInvestigationResult,
    startInvestigation,
    resetInvestigationStatus,
  } = useGitHubInvestigation(selectedProject?.id);

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

  // Enrichment state
  const enrichments = useEnrichmentStore((s) => s.enrichments);
  const enrichmentLoaded = useEnrichmentStore((s) => s.isLoaded);
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowState[]>([]);

  // Compute state counts from enrichments (must be derived via useMemo, not
  // via a store selector that returns a new object — that causes infinite loops).
  const stateCounts = useMemo(() => {
    const counts: Record<WorkflowState, number> = {
      new: 0, triage: 0, ready: 0, in_progress: 0, review: 0, done: 0, blocked: 0,
    };
    for (const e of Object.values(enrichments)) {
      counts[e.triageState]++;
    }
    return counts;
  }, [enrichments]);

  // Apply workflow filter to issues
  const workflowFilteredIssues = useMemo(() => {
    if (workflowFilter.length === 0) return filteredIssues;
    return filteredIssues.filter((issue) => {
      const state = enrichments[String(issue.number)]?.triageState ?? 'new';
      return workflowFilter.includes(state);
    });
  }, [filteredIssues, workflowFilter, enrichments]);

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
    setSelectedIssueNumbers(new Set(workflowFilteredIssues.map((i) => i.number)));
  }, [workflowFilteredIssues]);

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

  // Bulk operation results (GAP-09)
  const bulkResult = useMutationStore((s) => s.bulkResult);
  const clearBulkResult = useMutationStore((s) => s.clearBulkResult);

  // Label sync (Phase 4)
  const labelSync = useLabelSync();

  // AI Triage
  const aiTriage = useAITriage(selectedProject?.id ?? '');
  const lastBatchSnapshot = useAITriageStore((s) => s.lastBatchSnapshot);

  // Check for existing AI comment when enrichment result is available
  const [hasExistingAIComment, setHasExistingAIComment] = useState(false);
  useEffect(() => {
    if (!aiTriage.enrichmentResult || !selectedIssue || !selectedProject?.id) {
      setHasExistingAIComment(false);
      return;
    }
    let cancelled = false;
    window.electronAPI.github.getIssueComments(selectedProject.id, selectedIssue.number)
      .then((result) => {
        if (cancelled) return;
        const comments = result?.data ?? [];
        const hasAI = comments.some((c: { body?: string }) =>
          c.body?.includes(ENRICHMENT_COMMENT_FOOTER),
        );
        setHasExistingAIComment(hasAI);
      })
      .catch(() => {
        if (!cancelled) setHasExistingAIComment(false);
      });
    return () => { cancelled = true; };
  }, [aiTriage.enrichmentResult, selectedIssue, selectedProject?.id]);

  // Triage mode (3-panel layout)
  const { isEnabled: triageModeEnabled, isAvailable: triageModeAvailable, toggle: toggleTriageMode } = useTriageMode();

  // Metrics
  const { metrics, timeWindow: metricsTimeWindow, isLoading: isMetricsLoading, computeMetrics, setTimeWindow: setMetricsTimeWindow } = useMetrics();

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
  const handleCreateSpec = useCallback(
    async (): Promise<{ specNumber: string } | null> => {
      if (!selectedIssue || !selectedProject?.id) return null;
      const result = await window.electronAPI.github.createSpecFromIssue(selectedProject.id, selectedIssue.number);
      if (result.success) return { specNumber: String(selectedIssue.number) };
      return null;
    },
    [selectedIssue, selectedProject?.id],
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

  // Compute metrics on mount when enrichment is loaded
  useEffect(() => {
    if (selectedProject?.id && enrichmentLoaded) {
      computeMetrics();
    }
  }, [selectedProject?.id, enrichmentLoaded, computeMetrics]);

  // Clear selection when filters change — deps are intentional triggers, not consumed values
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on filter/search change
  useEffect(() => {
    setSelectedIssueNumbers(new Set());
  }, [workflowFilter, filterState, searchQuery]);

  const [showInvestigateDialog, setShowInvestigateDialog] = useState(false);
  const [selectedIssueForInvestigation, setSelectedIssueForInvestigation] =
    useState<GitHubIssue | null>(null);
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

  // Load enrichment data when project is available
  useEffect(() => {
    if (selectedProject?.id && syncStatus?.connected) {
      loadEnrichment(selectedProject.id);
    }
    return () => {
      useEnrichmentStore.getState().clearEnrichment();
    };
  }, [selectedProject?.id, syncStatus?.connected]);

  // Enhanced refresh that also checks for new auto-fix issues
  const handleRefreshWithAutoFix = useCallback(() => {
    handleRefresh();
    // Also check for new auto-fix issues if enabled
    if (autoFixConfig?.enabled) {
      checkForNewIssues();
    }
    // Refresh enrichment data
    if (selectedProject?.id) {
      loadEnrichment(selectedProject.id);
    }
  }, [handleRefresh, autoFixConfig?.enabled, checkForNewIssues, selectedProject?.id]);

  const handleInvestigate = useCallback((issue: GitHubIssue) => {
    setSelectedIssueForInvestigation(issue);
    setShowInvestigateDialog(true);
  }, []);

  const handleStartInvestigation = useCallback(
    (selectedCommentIds: number[]) => {
      if (selectedIssueForInvestigation) {
        startInvestigation(selectedIssueForInvestigation, selectedCommentIds);
      }
    },
    [selectedIssueForInvestigation, startInvestigation]
  );

  const handleTransition = useCallback(
    (to: WorkflowState, resolution?: Resolution) => {
      if (selectedIssue && selectedProject?.id) {
        const oldState = enrichments[String(selectedIssue.number)]?.triageState ?? 'new';
        transitionWorkflowState(selectedProject.id, selectedIssue.number, to, resolution);
        labelSync.syncIssueLabel(selectedIssue.number, to, oldState);
      }
    },
    [selectedIssue, selectedProject?.id, enrichments, labelSync],
  );

  const handleCloseDialog = useCallback(() => {
    setShowInvestigateDialog(false);
    resetInvestigationStatus();
  }, [resetInvestigationStatus]);

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
        workflowFilter={workflowFilter}
        onWorkflowFilterChange={setWorkflowFilter}
        stateCounts={stateCounts}
        onToggleTriageMode={toggleTriageMode}
        isTriageModeEnabled={triageModeEnabled}
        isTriageModeAvailable={triageModeAvailable}
      />

      {/* Bulk Action Bar */}
      {selectedIssueNumbers.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIssueNumbers.size}
          onBulkAction={handleBulkAction}
          isOperating={isBulkOperating}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      )}

      {/* Bulk Results Panel (GAP-09) */}
      {bulkResult && (
        <BulkResultsPanel
          result={bulkResult}
          onRetry={() => { /* retry logic handled externally */ }}
          onDismiss={clearBulkResult}
        />
      )}

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Issue List */}
        <section className={`${triageModeEnabled ? 'w-1/4' : 'w-1/2'} border-r border-border flex flex-col`} aria-label={t('panels.issueList')} data-triage-panel="1" tabIndex={-1}>
          <IssueList
            issues={workflowFilteredIssues}
            selectedIssueNumber={selectedIssueNumber}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
            hasMore={hasMore && !isSearchActive}
            error={error}
            onSelectIssue={selectIssue}
            onInvestigate={handleInvestigate}
            onLoadMore={!isSearchActive ? handleLoadMore : undefined}
            enrichments={enrichments}
            selectedIssueNumbers={selectedIssueNumbers}
            onToggleSelect={handleToggleSelect}
            compact={triageModeEnabled}
          />
        </section>

        {/* Issue Detail */}
        <section className={`w-1/2 flex flex-col ${triageModeEnabled ? 'border-r border-border' : ''}`} aria-label={t('panels.issueDetail')} data-triage-panel="2" tabIndex={-1}>
          {selectedIssue ? (
            <IssueDetail
              issue={selectedIssue}
              onInvestigate={() => handleInvestigate(selectedIssue)}
              investigationResult={
                lastInvestigationResult?.issueNumber === selectedIssue.number
                  ? lastInvestigationResult
                  : null
              }
              linkedTaskId={issueToTaskMap.get(selectedIssue.number)}
              onViewTask={onNavigateToTask}
              projectId={selectedProject?.id}
              autoFixConfig={autoFixConfig}
              autoFixQueueItem={getAutoFixQueueItem(selectedIssue.number)}
              enrichment={enrichments[String(selectedIssue.number)] ?? null}
              onTransition={handleTransition}
              onAITriage={() => aiTriage.runEnrichment(selectedIssue.number)}
              onImproveIssue={() => aiTriage.runEnrichment(selectedIssue.number)}
              onSplitIssue={() => aiTriage.runSplitSuggestion(selectedIssue.number)}
              isAIBusy={aiTriage.isTriaging}
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
              onCreateSpec={handleCreateSpec}
            />
          ) : (
            <EmptyState message="Select an issue to view details" />
          )}
        </section>

        {/* Triage Sidebar (3rd panel) */}
        {triageModeEnabled && selectedIssue && (
          <section className="w-1/4 flex flex-col" aria-label={t('panels.triageSidebar')} data-triage-panel="3" tabIndex={-1}>
            <TriageSidebar
              enrichment={enrichments[String(selectedIssue.number)] ?? null}
              currentState={enrichments[String(selectedIssue.number)]?.triageState ?? 'new'}
              previousState={enrichments[String(selectedIssue.number)]?.previousState}
              isAgentLocked={enrichments[String(selectedIssue.number)]?.agentLinks?.some(l => l.status === 'active')}
              onTransition={handleTransition}
              completenessScore={enrichments[String(selectedIssue.number)]?.completenessScore ?? 0}
              onAITriage={() => aiTriage.runEnrichment(selectedIssue.number)}
              onImproveIssue={() => aiTriage.runEnrichment(selectedIssue.number)}
              onSplitIssue={() => aiTriage.runSplitSuggestion(selectedIssue.number)}
              isAIBusy={aiTriage.isTriaging}
              dependencies={dependencies}
              isDepsLoading={isDepsLoading}
              depsError={depsError}
              metrics={metrics}
              metricsTimeWindow={metricsTimeWindow}
              isMetricsLoading={isMetricsLoading}
              onTimeWindowChange={setMetricsTimeWindow}
              onRefreshMetrics={computeMetrics}
            />
          </section>
        )}
      </div>

      {/* Investigation Dialog */}
      <InvestigationDialog
        open={showInvestigateDialog}
        onOpenChange={setShowInvestigateDialog}
        selectedIssue={selectedIssueForInvestigation}
        investigationStatus={investigationStatus}
        onStartInvestigation={handleStartInvestigation}
        onClose={handleCloseDialog}
        projectId={selectedProject?.id}
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

      {/* AI Triage Progress */}
      {(aiTriage.enrichmentProgress || aiTriage.triageProgress) && (
        <TriageProgressOverlay
          progress={aiTriage.enrichmentProgress ?? aiTriage.triageProgress ?? { phase: 'generating', progress: 0, message: '' }}
          onCancel={() => {
            window.electronAPI.github.cancelTriage().catch(() => { /* best-effort */ });
          }}
        />
      )}

      {/* Batch Triage Review (GAP-16) */}
      {aiTriage.reviewItems.length > 0 && (
        <BatchTriageReview
          items={aiTriage.reviewItems}
          onAccept={aiTriage.acceptResult}
          onReject={aiTriage.rejectResult}
          onAcceptAll={() => { useAITriageStore.getState().acceptAllRemaining(); }}
          onDismiss={() => { useAITriageStore.getState().dismissReview(); }}
          onApply={() => { useAITriageStore.getState().snapshotBeforeApply(); aiTriage.applyTriageResults(); }}
          onUndo={lastBatchSnapshot ? () => { aiTriage.undoLastBatchWithGitHub(); } : undefined}
        />
      )}

      {/* Enrichment Comment Preview (GAP-10) */}
      {aiTriage.enrichmentResult && selectedIssue && (
        <EnrichmentCommentPreview
          content={formatEnrichmentComment(aiTriage.enrichmentResult)}
          onPost={(content) => {
            mutations.addComment(selectedIssue.number, content);
            aiTriage.clearEnrichmentResult();
          }}
          onCancel={aiTriage.clearEnrichmentResult}
          hasExistingAIComment={hasExistingAIComment}
        />
      )}

      {/* Split Dialog */}
      {aiTriage.splitSuggestion && (
        <IssueSplitDialog
          suggestion={aiTriage.splitSuggestion}
          progress={aiTriage.splitProgress}
          onConfirm={aiTriage.confirmSplit}
          onCancel={() => { /* reset split state */ }}
        />
      )}

      {/* GitHub Setup Modal - shown when GitHub module is not configured */}
      {selectedProject && (
        <GitHubSetupModal
          open={showGitHubSetup}
          onOpenChange={setShowGitHubSetup}
          project={selectedProject}
          onComplete={() => {
            setShowGitHubSetup(false);
            // Retry the analysis after setup is complete
            openWizard();
            startAnalysis();
          }}
          onSkip={() => setShowGitHubSetup(false)}
        />
      )}
    </div>
  );
}
