import type { GitHubIssue, GitHubInvestigationResult, InvestigationState, InvestigationReport, InvestigationProgress, InvestigationDismissReason, SuggestedLabel } from '@shared/types';
import type { AutoFixConfig, AutoFixQueueItem } from '../../../../preload/api/modules/github-api';
import type { IssueDependencies } from '@shared/types/dependencies';

export type FilterState = 'open' | 'closed' | 'all';

export type IssueStatusFilter = 'open' | 'closed';

export type IssueSortOption = 'newest' | 'oldest' | 'most_commented';

export interface IssueFilterState {
  searchQuery: string;
  reporters: string[];
  statuses: IssueStatusFilter[];
  sortBy: IssueSortOption;
}

export interface IssueFilterBarProps {
  filters: IssueFilterState;
  reporters: string[];
  hasActiveFilters: boolean;
  onSearchChange: (query: string) => void;
  onReportersChange: (reporters: string[]) => void;
  onStatusesChange: (statuses: IssueStatusFilter[]) => void;
  onSortChange: (sortBy: IssueSortOption) => void;
  onClearFilters: () => void;
}

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
  onEditTitle?: (title: string) => Promise<void>;
  onEditBody?: (body: string) => Promise<void>;
  onAddLabels?: (labels: string[]) => Promise<void>;
  onRemoveLabels?: (labels: string[]) => Promise<void>;
  repoLabels?: Array<{ name: string; color: string }>;
  onAddAssignees?: (logins: string[]) => Promise<void>;
  onRemoveAssignees?: (logins: string[]) => Promise<void>;
  collaborators?: string[];
  onClose?: (comment?: string) => Promise<void>;
  onReopen?: () => Promise<void>;
  onComment?: (body: string) => Promise<void>;
  dependencies?: IssueDependencies;
  isDepsLoading?: boolean;
  depsError?: string | null;
  onNavigateDependency?: (issueNumber: number) => void;
  // --- Investigation system (F5) ---
  /** Investigation derived state for this issue */
  investigationState?: InvestigationState;
  /** Investigation report (when complete) */
  investigationReport?: InvestigationReport | null;
  /** Investigation progress percentage (0-100) */
  investigationProgress?: number;
  /** Full investigation progress object (for status tree agent statuses) */
  investigationProgressData?: InvestigationProgress | null;
  /** Whether investigation is currently running */
  isInvestigating?: boolean;
  /** Investigation error message */
  investigationError?: string | null;
  /** Timestamp when investigation started */
  investigationStartedAt?: string | null;
  /** Timestamp when investigation completed */
  investigationCompletedAt?: string | null;
  /** Spec ID from investigation (for task creation tracking) */
  investigationSpecId?: string | null;
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
  /** GitHub comment ID if investigation results have been posted */
  githubCommentId?: number | null;
  /** Activity log entries for the investigation lifecycle */
  investigationActivityLog?: Array<{ event: string; timestamp: string }>;
}

export interface IssueListHeaderProps {
  repoFullName: string;
  openIssuesCount: number;
  isLoading: boolean;
  onRefresh: () => void;
  // Auto-fix toggle (reactive - for new issues)
  autoFixEnabled?: boolean;
  autoFixRunning?: boolean;
  autoFixProcessing?: number; // Number of issues being processed
  onAutoFixToggle?: (enabled: boolean) => void;
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
  /** Optional content rendered below the search/filter bar */
  children?: React.ReactNode;
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
