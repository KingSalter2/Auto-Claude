import { useState, useCallback, useMemo, useEffect } from "react";
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
  EnrichmentCommentPreview,
} from "./github-issues/components";
import { GitHubSetupModal } from "./GitHubSetupModal";
import type { GitHubIssue } from "../../shared/types";
import type { GitHubIssuesProps } from "./github-issues/types";
import type { WorkflowState, Resolution } from "../../shared/types/enrichment";

export function GitHubIssues({ onOpenSettings, onNavigateToTask }: GitHubIssuesProps) {
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
  const stateCounts = useEnrichmentStore((s) => s.getStateCounts());
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowState[]>([]);

  // Apply workflow filter to issues
  const workflowFilteredIssues = useMemo(() => {
    if (workflowFilter.length === 0) return filteredIssues;
    return filteredIssues.filter((issue) => {
      const state = enrichments[String(issue.number)]?.triageState ?? 'new';
      return workflowFilter.includes(state);
    });
  }, [filteredIssues, workflowFilter, enrichments]);

  // Bulk operations
  const { executeBulk, retryFailed, isOperating: isBulkOperating } = useBulkOperations(selectedProject?.id ?? '');
  const [selectedIssueNumbers, setSelectedIssueNumbers] = useState<Set<number>>(new Set());

  const handleToggleSelect = useCallback((issueNumber: number) => {
    setSelectedIssueNumbers(prev => {
      const next = new Set(prev);
      if (next.has(issueNumber)) next.delete(issueNumber);
      else next.add(issueNumber);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIssueNumbers(new Set(workflowFilteredIssues.map(i => i.number)));
  }, [workflowFilteredIssues]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIssueNumbers(new Set());
  }, []);

  const handleBulkAction = useCallback(
    (action: Parameters<typeof executeBulk>[0], payload?: Parameters<typeof executeBulk>[2]) => {
      executeBulk(action, [...selectedIssueNumbers], payload);
    },
    [executeBulk, selectedIssueNumbers],
  );

  // AI Triage
  const aiTriage = useAITriage(selectedProject?.id ?? '');

  // Clear selection when filters change
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
      />

      {/* Bulk Action Bar */}
      {selectedIssueNumbers.size > 0 && (
        <BulkActionBar
          selectedCount={selectedIssueNumbers.size}
          onBulkAction={handleBulkAction}
          isOperating={isBulkOperating}
        />
      )}

      {/* Content */}
      <div className="flex-1 flex min-h-0">
        {/* Issue List */}
        <div className="w-1/2 border-r border-border flex flex-col">
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
        </div>

        {/* Issue Detail */}
        <div className="w-1/2 flex flex-col">
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
            />
          ) : (
            <EmptyState message="Select an issue to view details" />
          )}
        </div>
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
