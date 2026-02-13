/**
 * AI Issue Investigation types
 *
 * Defines the type contracts for the investigation system that replaces
 * the old triage/enrichment workflow. Investigation runs 4 specialist
 * agents in parallel to analyze GitHub issues.
 */

// ============================================
// Investigation State Machine
// ============================================

/**
 * Derived investigation state for an issue.
 * Computed from investigation data + linked task status, never manually set.
 */
export type InvestigationState =
  | 'new'
  | 'investigating'
  | 'findings_ready'
  | 'resolved'
  | 'failed'
  | 'task_created'
  | 'building'
  | 'done';

/**
 * The 4 specialist agent types that run during investigation.
 */
export type InvestigationAgentType = 'root_cause' | 'impact' | 'fix_advisor' | 'reproducer';

// ============================================
// Agent Output Types
// ============================================

/**
 * Code reference found by an investigation agent.
 */
export interface CodeReference {
  file: string;
  line?: number;
  endLine?: number;
  snippet?: string;
  description: string;
}

/**
 * Base output from any specialist agent.
 */
export interface InvestigationAgentResult {
  agentType: InvestigationAgentType;
  summary: string;
  findings: string[];
  codeReferences: CodeReference[];
  confidence: number; // 0-100
}

/**
 * Root Cause Analyzer output — traces the bug/issue to its source.
 */
export interface RootCauseAnalysis extends InvestigationAgentResult {
  agentType: 'root_cause';
  rootCause: string;
  codePaths: string[];
  relatedIssues?: number[];
}

/**
 * Impact Assessor output — determines blast radius.
 */
export interface ImpactAssessment extends InvestigationAgentResult {
  agentType: 'impact';
  severity: 'critical' | 'high' | 'medium' | 'low';
  affectedComponents: string[];
  userImpact: string;
  riskIfUnfixed: string;
}

/**
 * Fix Advisor output — suggests concrete fix approaches.
 */
export interface FixAdvice extends InvestigationAgentResult {
  agentType: 'fix_advisor';
  suggestedApproaches: Array<{
    title: string;
    description: string;
    filesToModify: string[];
    complexity: 'simple' | 'standard' | 'complex';
    risks: string[];
  }>;
  recommendedApproach: number; // index into suggestedApproaches
  patternsToFollow: string[];
}

/**
 * Reproducer output — reproducibility and test coverage.
 */
export interface ReproductionAnalysis extends InvestigationAgentResult {
  agentType: 'reproducer';
  reproducible: boolean | 'unknown';
  reproductionSteps?: string[];
  existingTests: string[];
  testGaps: string[];
  suggestedTests: string[];
}

// ============================================
// Investigation Report
// ============================================

/**
 * Linked PR detected during investigation.
 */
export interface LinkedPR {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url: string;
}

/**
 * AI-suggested label for the issue.
 */
export interface SuggestedLabel {
  name: string;
  reason: string;
  accepted?: boolean; // user accept/reject state
}

/**
 * Complete investigation report combining all 4 agent outputs.
 */
export interface InvestigationReport {
  rootCause: RootCauseAnalysis;
  impact: ImpactAssessment;
  fixAdvice: FixAdvice;
  reproduction: ReproductionAnalysis;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  suggestedLabels: SuggestedLabel[];
  likelyResolved: boolean;
  linkedPRs: LinkedPR[];
  timestamp: string;
}

// ============================================
// Investigation Progress & Result
// ============================================

/**
 * Per-agent status within an investigation.
 */
export interface AgentStatus {
  agentType: InvestigationAgentType;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number; // 0-100
  message?: string;
}

/**
 * Real-time progress update during investigation.
 */
export interface InvestigationProgress {
  issueNumber: number;
  phase: string;
  progress: number; // 0-100
  message: string;
  agentStatuses: AgentStatus[];
  startedAt: string;
}

/**
 * Final investigation result delivered on completion.
 */
export interface InvestigationResult {
  issueNumber: number;
  report: InvestigationReport;
  specId?: string;
  worktreePath?: string;
  githubCommentId?: number;
  completedAt: string;
}

// ============================================
// Dismiss & Settings
// ============================================

/**
 * Reason for dismissing an issue.
 */
export type InvestigationDismissReason = 'wont_fix' | 'duplicate' | 'cannot_reproduce' | 'out_of_scope';

/**
 * Pipeline mode for investigation-created tasks.
 */
export type InvestigationPipelineMode = 'full' | 'skip_to_planning' | 'minimal';

/**
 * Investigation settings (subsection of GitHub settings).
 */
export interface InvestigationSettings {
  autoCreateTasks: boolean;
  autoStartTasks: boolean;
  pipelineMode: InvestigationPipelineMode;
  autoPostToGitHub: boolean;
  autoCloseIssues: boolean;
  maxParallelInvestigations: number;
  labelIncludeFilter: string[];
  labelExcludeFilter: string[];
}

// ============================================
// Batch Staging
// ============================================

/**
 * An item in the batch staging area (auto-create review).
 */
export interface BatchStagingItem {
  issueNumber: number;
  issueTitle: string;
  report: InvestigationReport;
  specId: string;
  approved?: boolean;
  createdAt: string;
}
