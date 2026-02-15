/**
 * Label sync constants for Phase 4 (Polish + Extras).
 * WORKFLOW_LABEL_MAP is the single source of truth for state → GitHub label mapping.
 */
import type { WorkflowState } from '../types/enrichment';
import type { WorkflowLabel, WorkflowLabelCustomization, CustomWorkflowLabel } from '../types/label-sync';
import type { InvestigationState } from '../types/investigation';

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
// Default Suffixes (used by factory)
// ============================================

const DEFAULT_SUFFIXES: Record<WorkflowState, string> = {
  new: 'new',
  triage: 'triage',
  ready: 'ready',
  in_progress: 'in-progress',
  review: 'review',
  done: 'done',
  blocked: 'blocked',
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
// Customization Factory & Resolver
// ============================================

export function createDefaultWorkflowCustomization(): WorkflowLabelCustomization {
  const labels = {} as Record<WorkflowState, CustomWorkflowLabel>;
  for (const state of Object.keys(WORKFLOW_LABEL_MAP) as WorkflowState[]) {
    labels[state] = {
      suffix: DEFAULT_SUFFIXES[state],
      color: WORKFLOW_LABEL_COLORS[state],
      description: LABEL_DESCRIPTION,
    };
  }
  return { prefix: LABEL_PREFIX, labels };
}

export function resolveWorkflowCustomization(
  custom?: WorkflowLabelCustomization,
): WorkflowLabelCustomization {
  if (!custom) return createDefaultWorkflowCustomization();
  const defaults = createDefaultWorkflowCustomization();
  const labels = {} as Record<WorkflowState, CustomWorkflowLabel>;
  for (const state of Object.keys(defaults.labels) as WorkflowState[]) {
    labels[state] = {
      ...defaults.labels[state],
      ...(custom.labels?.[state] ?? {}),
    };
  }
  return { prefix: custom.prefix || defaults.prefix, labels };
}

// ============================================
// Utility Functions
// ============================================

export function getLabelForState(
  state: WorkflowState,
  customization?: WorkflowLabelCustomization,
): string {
  if (!customization) return WORKFLOW_LABEL_MAP[state];
  const resolved = resolveWorkflowCustomization(customization);
  return `${resolved.prefix}${resolved.labels[state].suffix}`;
}

export function getStateFromLabel(
  label: string,
  customization?: WorkflowLabelCustomization,
): WorkflowState | null {
  if (!customization) {
    for (const [state, labelName] of Object.entries(WORKFLOW_LABEL_MAP)) {
      if (labelName === label) return state as WorkflowState;
    }
    return null;
  }
  const resolved = resolveWorkflowCustomization(customization);
  for (const [state, cfg] of Object.entries(resolved.labels)) {
    if (`${resolved.prefix}${cfg.suffix}` === label) return state as WorkflowState;
  }
  return null;
}

export function getWorkflowLabels(
  customization?: WorkflowLabelCustomization,
): WorkflowLabel[] {
  if (!customization) {
    return (Object.keys(WORKFLOW_LABEL_MAP) as WorkflowState[]).map((state) => ({
      name: WORKFLOW_LABEL_MAP[state],
      color: WORKFLOW_LABEL_COLORS[state],
      description: LABEL_DESCRIPTION,
    }));
  }
  const resolved = resolveWorkflowCustomization(customization);
  return (Object.keys(resolved.labels) as WorkflowState[]).map((state) => ({
    name: `${resolved.prefix}${resolved.labels[state].suffix}`,
    color: resolved.labels[state].color,
    description: resolved.labels[state].description,
  }));
}

export function isAutoClaudeLabel(
  label: string,
  customization?: WorkflowLabelCustomization,
): boolean {
  const prefix = customization?.prefix || LABEL_PREFIX;
  return label.startsWith(prefix);
}

// ============================================
// Investigation State → Workflow State Mapping
// ============================================

/**
 * Map investigation state to workflow state for label sync.
 * Investigation states are derived from investigation + task status,
 * workflow states are used for GitHub labels.
 *
 * Accepts string for defensive programming (handles invalid states gracefully).
 * Valid InvestigationState values are mapped to WorkflowState, invalid values return null.
 */
export function mapInvestigationStateToWorkflowState(
  investigationState: string,
): WorkflowState | null {
  // Direct mappings (same name)
  if (investigationState === 'new') return 'new';
  if (investigationState === 'done') return 'done';

  // Investigation-specific states (no label equivalent - use "ready" as default)
  if (investigationState === 'queued') return 'ready';
  if (investigationState === 'investigating') return 'triage';
  if (investigationState === 'interrupted') return 'ready';
  if (investigationState === 'failed') return 'ready';
  if (investigationState === 'resolved') return 'done';
  if (investigationState === 'findings_ready') return 'ready';

  // Task-related states
  if (investigationState === 'task_created') return 'ready';
  if (investigationState === 'building') return 'in_progress';

  return null; // Unknown state - don't sync
}
