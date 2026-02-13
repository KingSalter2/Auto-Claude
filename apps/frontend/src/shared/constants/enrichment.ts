/**
 * Constants for the GitHub Issues enrichment system.
 * Workflow state machine, color mappings, completeness weights, and transition validation.
 */
import type { WorkflowState } from '../types/enrichment';

// ============================================
// Workflow State Colors (Tailwind classes)
// ============================================

export const WORKFLOW_STATE_COLORS: Record<WorkflowState, { bg: string; text: string }> = {
  new: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300' },
  triage: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
  ready: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300' },
  in_progress: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  review: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300' },
  done: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  blocked: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-700 dark:text-rose-300' },
};

// ============================================
// Workflow State Labels (fallback; components use i18n keys)
// ============================================

export const WORKFLOW_STATE_LABELS: Record<WorkflowState, string> = {
  new: 'New',
  triage: 'Triage',
  ready: 'Ready',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

// ============================================
// Valid Transitions (State Machine)
// ============================================

export const VALID_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  new: ['triage', 'ready', 'in_progress', 'blocked'],
  triage: ['ready', 'in_progress', 'blocked'],
  ready: ['triage', 'in_progress', 'blocked'],
  in_progress: ['review', 'done', 'blocked'],
  review: ['in_progress', 'done', 'blocked'],
  done: ['ready'],
  blocked: [], // Unblock returns to previousState, handled by caller
};

// ============================================
// Completeness Scoring Weights
// ============================================

export const COMPLETENESS_WEIGHTS: Record<string, number> = {
  problem: 0.20,
  goal: 0.10,
  scopeIn: 0.05,
  scopeOut: 0.05,
  acceptanceCriteria: 0.25,
  technicalContext: 0.15,
  risksEdgeCases: 0.20,
};

// ============================================
// Schema & GC Constants
// ============================================

export const ENRICHMENT_SCHEMA_VERSION = 1;

export const ORPHAN_PRUNE_DAYS = 30;

// ============================================
// Transition Validation Helpers
// ============================================

export function isValidTransition(from: WorkflowState, to: WorkflowState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function getValidTargets(from: WorkflowState): WorkflowState[] {
  return VALID_TRANSITIONS[from];
}
