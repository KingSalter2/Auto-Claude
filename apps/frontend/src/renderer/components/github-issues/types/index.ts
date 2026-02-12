import type { GitHubIssue, GitHubInvestigationResult } from '../../../../shared/types';
import type { AutoFixConfig, AutoFixQueueItem } from '../../../../preload/api/modules/github-api';
import type { WorkflowState, Resolution, IssueEnrichment } from '../../../../shared/types/enrichment';
import type { IssueDependencies } from '../../../../shared/types/dependencies';
import type { TriageMetrics, MetricsTimeWindow } from '../../../../shared/types/metrics';

export type FilterState = 'open' | 'closed' | 'all';

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
  triageState?: WorkflowState;
  completenessScore?: number;
  isSelectable?: boolean;
  isChecked?: boolean;
  onToggleSelect?: () => void;
  compact?: boolean;
}

export interface IssueDetailProps {
  issue: GitHubIssue;
  onInvestigate: () => void;
  investigationResult: GitHubInvestigationResult | null;
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
  enrichment?: IssueEnrichment | null;
  onTransition?: (to: WorkflowState, resolution?: Resolution) => void;
  onAITriage?: () => void;
  onImproveIssue?: () => void;
  onSplitIssue?: () => void;
  isAIBusy?: boolean;
  onEditTitle?: (title: string) => Promise<void>;
  onEditBody?: (body: string) => Promise<void>;
  onAddLabels?: (labels: string[]) => Promise<void>;
  onRemoveLabels?: (labels: string[]) => Promise<void>;
  repoLabels?: Array<{ name: string; color: string }>;
  onAddAssignees?: (logins: string[]) => Promise<void>;
  onRemoveAssignees?: (logins: string[]) => Promise<void>;
  collaborators?: string[];
  onCreateSpec?: () => Promise<{ specNumber: string } | null>;
  onClose?: (comment?: string) => Promise<void>;
  onReopen?: () => Promise<void>;
  onComment?: (body: string) => Promise<void>;
  dependencies?: IssueDependencies;
  isDepsLoading?: boolean;
  depsError?: string | null;
  onNavigateDependency?: (issueNumber: number) => void;
}

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
  // Analyze & Group (proactive - for existing issues)
  onAnalyzeAndGroup?: () => void;
  isAnalyzing?: boolean;
  workflowFilter?: WorkflowState[];
  onWorkflowFilterChange?: (states: WorkflowState[]) => void;
  stateCounts?: Record<WorkflowState, number>;
  onToggleTriageMode?: () => void;
  isTriageModeEnabled?: boolean;
  isTriageModeAvailable?: boolean;
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
  enrichments?: Record<string, IssueEnrichment>;
  selectedIssueNumbers?: Set<number>;
  onToggleSelect?: (issueNumber: number) => void;
  compact?: boolean;
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
