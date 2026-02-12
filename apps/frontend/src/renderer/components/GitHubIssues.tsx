import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useProjectStore } from "../stores/project-store";
import { useTaskStore } from "../stores/task-store";
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
  TriageProgressOverlay,
  IssueSplitDialog,
  TriageSidebar,
} from "./github-issues/components";
import { GitHubSetupModal } from "./GitHubSetupModal";
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
    getFilteredIssues,
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

  const { searchQuery, setSearchQuery, filteredIssues, isSearchActive } = useIssueFiltering(
    getFilteredIssues(),
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

  // AI Triage
  const aiTriage = useAITriage(selectedProject?.id ?? '');

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
        transitionWorkflowState(selectedProject.id, selectedIssue.number, to, resolution);
      }
    },
    [selectedIssue, selectedProject?.id],
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

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Issue List */}
        <section className={`${triageModeEnabled ? 'w-1/4' : 'w-1/2'} border-r border-border flex flex-col`} aria-label={t('panels.issueList')}>
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
          />
        </section>

        {/* Issue Detail */}
        <section className={`w-1/2 flex flex-col ${triageModeEnabled ? 'border-r border-border' : ''}`} aria-label={t('panels.issueDetail')}>
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
            />
          ) : (
            <EmptyState message="Select an issue to view details" />
          )}
        </section>

        {/* Triage Sidebar (3rd panel) */}
        {triageModeEnabled && selectedIssue && (
          <section className="w-1/4 flex flex-col" aria-label={t('panels.triageSidebar')}>
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
          progress={aiTriage.enrichmentProgress ?? aiTriage.triageProgress ?? { progress: 0, message: '' }}
          onCancel={() => { /* cancel handled by store */ }}
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
