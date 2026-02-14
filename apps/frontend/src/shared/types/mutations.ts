/**
 * Mutation types for GitHub Issues Phase 2 (Core Triage).
 * These types define the mutation data layer for editing issues,
 * bulk operations, and spec creation from issues.
 */

// ============================================
// Action Types
// ============================================

export type BulkActionType =
  | 'close'
  | 'reopen'
  | 'add-label'
  | 'remove-label'
  | 'add-assignee'
  | 'remove-assignee';

// ============================================
// Result Interfaces
// ============================================

export interface MutationResult {
  success: boolean;
  issueNumber: number;
  error?: string;
}

export interface BulkItemResult {
  issueNumber: number;
  status: 'success' | 'failed' | 'skipped';
  error?: string;
}

export interface BulkOperationResult {
  action: BulkActionType;
  totalItems: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: BulkItemResult[];
}

// ============================================
// Progress & Execution
// ============================================

export interface BulkOperationProgress {
  action: BulkActionType;
  totalItems: number;
  processedItems: number;
  currentIssueNumber?: number;
}

export interface BulkExecuteParams {
  projectId: string;
  action: BulkActionType;
  issueNumbers: number[];
  payload?: {
    labels?: string[];
    assignees?: string[];
    targetState?: string;
    resolution?: string;
  };
}
