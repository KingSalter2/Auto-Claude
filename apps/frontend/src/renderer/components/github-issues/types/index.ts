import type { GitHubIssue, GitHubInvestigationResult, InvestigationState, InvestigationReport, InvestigationDismissReason, SuggestedLabel } from '@shared/types';
import type { AutoFixConfig, AutoFixQueueItem } from '../../../../preload/api/modules/github-api';
import type { WorkflowState, Resolution, IssueEnrichment } from '@shared/types/enrichment';
import type { IssueDependencies } from '@shared/types/dependencies';
import type { TriageMetrics, MetricsTimeWindow } from '@shared/types/metrics';

export type FilterState = 'open' | 'closed' | 'all';

/**
 * Classification types for GitHub API errors.
 * Used to determine appropriate icon, message, and actions for error display.
 */
export type GitHubErrorType =
  | 'rate_limit'
  | 'auth'
  | 'permission'
  | 'network'
  | 'not_found'
  | 'unknown';

/**
 * Parsed GitHub error information with metadata.
 * Returned by the github-error-parser utility.
 *
 * IMPORTANT: The `message` field contains hardcoded English strings intended
 * ONLY as a fallback defaultValue for i18n translation. Direct consumers should
 * use the `type` field to look up the appropriate translation key (e.g.,
 * 'githubErrors.rateLimitMessage') via react-i18next rather than displaying
 * `message` directly. This ensures proper localization for all users.
 */
export interface GitHubErrorInfo {
  /** The classified error type */
  type: GitHubErrorType;
  /**
   * User-friendly error message in English.
   * NOTE: Use only as defaultValue for i18n - do not display directly.
   * Use type field to look up translation key (e.g., 'githubErrors.rateLimitMessage').
   */
  message: string;
  /** Original raw error string (for debugging/details) */
  rawMessage?: string;
  /** Rate limit reset time (only for rate_limit type) */
  rateLimitResetTime?: Date;
  /** Required OAuth scopes that are missing (only for permission type) */
  requiredScopes?: string[];
  /** HTTP status code if available */
  statusCode?: number;
}

export interface GitHubIssuesProps {
  onOpenSettings?: () => void;
  /** Navigate to view a task in the kanban board */
  onNavigateToTask?: (taskId: string) => void;
}

export interface IssueListItemProps {
  issue: GitHubIssue;
  isSelected: boolean;
  onClick: () => void;
  onInvestigate: () => void;
  /** @deprecated Use investigationState instead. Kept for F6 migration. */
  triageState?: WorkflowState;
  /** @deprecated Use investigationProgress instead. Kept for F6 migration. */
  completenessScore?: number;
  isSelectable?: boolean;
  isChecked?: boolean;
  onToggleSelect?: () => void;
  compact?: boolean;
  /** Investigation state for this issue */
  investigationState?: InvestigationState;
  /** Investigation progress percentage (0-100) */
  investigationProgress?: number;
  /** Linked task ID (shown as badge after task creation) */
  linkedTaskId?: string;
  /** Handler to navigate to the linked task */
  onViewTask?: (taskId: string) => void;
  /** Whether the issue is stale (no longer exists in GitHub) */
  isStale?: boolean;
}

export interface IssueDetailProps {
  issue: GitHubIssue;
  onInvestigate: () => void;
  /** @deprecated Use investigationReport instead. Kept for F6 migration. */
  investigationResult?: GitHubInvestigationResult | null;
  /** ID of existing task linked to this issue (from metadata.githubIssueNumber) */
  linkedTaskId?: string;
  /** Handler to navigate to view the linked task */
  onViewTask?: (taskId: string) => void;
  /** Project ID for auto-fix functionality */
  projectId?: string;
  /** Auto-fix configuration */
  autoFixConfig?: AutoFixConfig | null;
  /** Auto-fix queue item for this issue */
  autoFixQueueItem?: AutoFixQueueItem | null;
  /** @deprecated Legacy enrichment — no longer wired in F6+. Will be deleted in a future pass. */
  enrichment?: IssueEnrichment | null;
  /** @deprecated Legacy workflow transition — no longer wired in F6+. */
  onTransition?: (to: WorkflowState, resolution?: Resolution) => void;
  /** @deprecated Legacy AI triage — replaced by investigation system. */
  onAITriage?: () => void;
  /** @deprecated Legacy improve issue — replaced by investigation system. */
  onImproveIssue?: () => void;
  /** @deprecated Legacy split issue — replaced by investigation system. */
  onSplitIssue?: () => void;
  /** @deprecated Legacy AI busy flag — no longer wired in F6+. */
  isAIBusy?: boolean;
  onEditTitle?: (title: string) => Promise<void>;
  onEditBody?: (body: string) => Promise<void>;
  onAddLabels?: (labels: string[]) => Promise<void>;
  onRemoveLabels?: (labels: string[]) => Promise<void>;
  repoLabels?: Array<{ name: string; color: string }>;
  onAddAssignees?: (logins: string[]) => Promise<void>;
  onRemoveAssignees?: (logins: string[]) => Promise<void>;
  collaborators?: string[];
  /** @deprecated Legacy create spec — replaced by investigation system task creation. */
  onCreateSpec?: () => Promise<{ specNumber: string } | null>;
  onClose?: (comment?: string) => Promise<void>;
  onReopen?: () => Promise<void>;
  onComment?: (body: string) => Promise<void>;
  dependencies?: IssueDependencies;
  isDepsLoading?: boolean;
  depsError?: string | null;
  onNavigateDependency?: (issueNumber: number) => void;
  /** @deprecated Legacy enrichment comment — replaced by investigation postToGitHub. */
  onPostEnrichmentComment?: () => void;
  /** @deprecated Legacy enrichment comment — replaced by investigation postToGitHub. */
  onDismissEnrichmentComment?: () => void;
  /** @deprecated Legacy enrichment comment — replaced by investigation postToGitHub. */
  hasExistingAIComment?: boolean;
  // --- Investigation system (F5) ---
  /** Investigation derived state for this issue */
  investigationState?: InvestigationState;
  /** Investigation report (when complete) */
  investigationReport?: InvestigationReport | null;
  /** Investigation progress percentage (0-100) */
  investigationProgress?: number;
  /** Whether investigation is currently running */
  isInvestigating?: boolean;
  /** Investigation error message */
  investigationError?: string | null;
  /** Cancel ongoing investigation */
  onCancelInvestigation?: () => void;
  /** Create a kanban task from investigation results */
  onCreateTask?: () => void;
  /** Dismiss issue with a reason */
  onDismissIssue?: (reason: InvestigationDismissReason) => void;
  /** Post investigation results as GitHub comment */
  onPostToGitHub?: () => void;
  /** Accept a suggested label */
  onAcceptLabel?: (label: SuggestedLabel) => void;
  /** Reject a suggested label */
  onRejectLabel?: (label: SuggestedLabel) => void;
  /** Whether posting to GitHub is in progress */
  isPostingToGitHub?: boolean;
  /** Activity log entries for the investigation lifecycle */
  investigationActivityLog?: Array<{ event: string; timestamp: string }>;
}

/** @deprecated Removed in F9. Use InvestigateButton + InvestigationPanel instead. */
export interface InvestigationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIssue: GitHubIssue | null;
  investigationStatus: {
    phase: string;
    progress: number;
    message: string;
    error?: string;
  };
  onStartInvestigation: (selectedCommentIds: number[]) => void;
  onClose: () => void;
  projectId?: string;
}

export interface IssueListHeaderProps {
  repoFullName: string;
  openIssuesCount: number;
  isLoading: boolean;
  searchQuery: string;
  filterState: FilterState;
  onSearchChange: (query: string) => void;
  onFilterChange: (state: FilterState) => void;
  onRefresh: () => void;
  // Auto-fix toggle (reactive - for new issues)
  autoFixEnabled?: boolean;
  autoFixRunning?: boolean;
  autoFixProcessing?: number; // Number of issues being processed
  onAutoFixToggle?: (enabled: boolean) => void;
  /** @deprecated Legacy analyze/group — replaced by investigation system. */
  onAnalyzeAndGroup?: () => void;
  /** @deprecated Legacy analyze/group — replaced by investigation system. */
  isAnalyzing?: boolean;
  /** @deprecated Legacy workflow filter — replaced by investigationStateFilter. */
  workflowFilter?: WorkflowState[];
  /** @deprecated Legacy workflow filter — replaced by onInvestigationStateFilterChange. */
  onWorkflowFilterChange?: (states: WorkflowState[]) => void;
  /** @deprecated Legacy workflow state counts — replaced by investigationStateCounts. */
  stateCounts?: Record<WorkflowState, number>;
  /** @deprecated Legacy triage mode — replaced by investigation system. */
  onToggleTriageMode?: () => void;
  /** @deprecated Legacy triage mode — replaced by investigation system. */
  isTriageModeEnabled?: boolean;
  /** @deprecated Legacy triage mode — replaced by investigation system. */
  isTriageModeAvailable?: boolean;
  // --- Investigation system (F5) ---
  /** Filter by investigation states */
  investigationStateFilter?: InvestigationState[];
  /** Callback when investigation state filter changes */
  onInvestigationStateFilterChange?: (states: InvestigationState[]) => void;
  /** Counts per investigation state for filter chip badges */
  investigationStateCounts?: Partial<Record<InvestigationState, number>>;
  /** Whether dismissed issues are shown */
  showDismissed?: boolean;
  /** Toggle dismissed issue visibility */
  onToggleShowDismissed?: () => void;
  /** Count of active investigations */
  activeInvestigationCount?: number;
  /** Cancel all active investigations for this project */
  onCancelAllInvestigations?: () => void;
}

export interface IssueListProps {
  issues: GitHubIssue[];
  selectedIssueNumber: number | null;
  isLoading: boolean;
  isLoadingMore?: boolean;
  hasMore?: boolean;
  error: string | null;
  onSelectIssue: (issueNumber: number) => void;
  onInvestigate: (issue: GitHubIssue) => void;
  onLoadMore?: () => void;
  /** @deprecated Use investigationStates instead. Kept for F6 migration. */
  enrichments?: Record<string, IssueEnrichment>;
  selectedIssueNumbers?: Set<number>;
  onToggleSelect?: (issueNumber: number) => void;
  compact?: boolean;
  /** Investigation states keyed by issue number */
  investigationStates?: Record<string, { state: InvestigationState; progress?: number; linkedTaskId?: string; isStale?: boolean }>;
  /** Handler to navigate to a linked task */
  onViewTask?: (taskId: string) => void;
}

export interface EmptyStateProps {
  searchQuery?: string;
  icon?: React.ComponentType<{ className?: string }>;
  message: string;
}

export interface NotConnectedStateProps {
  error: string | null;
  onOpenSettings?: () => void;
}

/** @deprecated Legacy triage sidebar props — replaced by investigation system. */
export interface TriageSidebarProps {
  enrichment: IssueEnrichment | null;
  currentState: WorkflowState;
  previousState?: WorkflowState | null;
  isAgentLocked?: boolean;
  onTransition: (to: WorkflowState, resolution?: Resolution) => void;
  completenessScore: number;
  onAITriage?: () => void;
  onImproveIssue?: () => void;
  onSplitIssue?: () => void;
  isAIBusy?: boolean;
  dependencies?: IssueDependencies;
  isDepsLoading?: boolean;
  depsError?: string | null;
  metrics?: TriageMetrics;
  metricsTimeWindow?: MetricsTimeWindow;
  isMetricsLoading?: boolean;
  onTimeWindowChange?: (tw: MetricsTimeWindow) => void;
  onRefreshMetrics?: () => void;
}
