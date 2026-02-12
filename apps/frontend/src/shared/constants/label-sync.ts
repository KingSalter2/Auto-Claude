/**
 * Label sync constants for Phase 4 (Polish + Extras).
 * WORKFLOW_LABEL_MAP is the single source of truth for state → GitHub label mapping.
 */
import type { WorkflowState } from '../types/enrichment';
import type { WorkflowLabel } from '../types/label-sync';

// ============================================
// Label Prefix
// ============================================

export const LABEL_PREFIX = 'ac:';

// ============================================
// Workflow State → Label Name Mapping
// ============================================

export const WORKFLOW_LABEL_MAP: Record<WorkflowState, string> = {
  new: 'ac:new',
  triage: 'ac:triage',
  ready: 'ac:ready',
  in_progress: 'ac:in-progress',
  review: 'ac:review',
  done: 'ac:done',
  blocked: 'ac:blocked',
};

// ============================================
// Label Colors (6-char hex, no # prefix for gh CLI)
// ============================================

export const WORKFLOW_LABEL_COLORS: Record<WorkflowState, string> = {
  new: 'C2E0F4',
  triage: '0E8A16',
  ready: '1D76DB',
  in_progress: 'FBCA04',
  review: 'D93F0B',
  done: '91CA55',
  blocked: 'B60205',
};

// ============================================
// Label Description
// ============================================

export const LABEL_DESCRIPTION = 'Managed by Auto-Claude';

// ============================================
// Sync Timing
// ============================================

export const SYNC_DEBOUNCE_MS = 2000;

// ============================================
// 3-Panel Layout
// ============================================

export const TRIAGE_MODE_MIN_WIDTH = 1200;

// ============================================
// Utility Functions
// ============================================

export function getLabelForState(state: WorkflowState): string {
  return WORKFLOW_LABEL_MAP[state];
}

export function getStateFromLabel(label: string): WorkflowState | null {
  for (const [state, labelName] of Object.entries(WORKFLOW_LABEL_MAP)) {
    if (labelName === label) return state as WorkflowState;
  }
  return null;
}

export function getWorkflowLabels(): WorkflowLabel[] {
  return (Object.keys(WORKFLOW_LABEL_MAP) as WorkflowState[]).map((state) => ({
    name: WORKFLOW_LABEL_MAP[state],
    color: WORKFLOW_LABEL_COLORS[state],
    description: LABEL_DESCRIPTION,
  }));
}

export function isAutoClaudeLabel(label: string): boolean {
  return label.startsWith(LABEL_PREFIX);
}
