/**
 * Enrichment types for GitHub Issues workflow tracking.
 * These types define the enrichment data layer that augments GitHub issues
 * with workflow state, completeness scoring, and triage metadata.
 */

// ============================================
// String Union Types
// ============================================

export type WorkflowState =
  | 'new'
  | 'triage'
  | 'ready'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'blocked';

export type Resolution =
  | 'completed'
  | 'split'
  | 'duplicate'
  | 'wontfix'
  | 'stale';

export type TriageCategory =
  | 'bug'
  | 'feature'
  | 'enhancement'
  | 'question'
  | 'documentation'
  | 'chore'
  | 'security'
  | 'performance';

export type TransitionActor =
  | 'user'
  | 'agent'
  | 'ai-triage'
  | 'auto-reconcile'
  | 'bootstrap';

// ============================================
// Core Interfaces
// ============================================

export interface IssueEnrichment {
  issueNumber: number;
  triageState: WorkflowState;
  previousState?: WorkflowState;
  resolution?: Resolution;
  priority: 'critical' | 'high' | 'medium' | 'low' | null;
  completenessScore: number;
  enrichment: {
    problem?: string;
    goal?: string;
    scopeIn?: string[];
    scopeOut?: string[];
    acceptanceCriteria?: string[];
    technicalContext?: string;
    risksEdgeCases?: string[];
  };
  triageResult?: {
    category: TriageCategory;
    confidence: number;
    labelsToAdd: string[];
    labelsToRemove: string[];
    isDuplicate: boolean;
    duplicateOf?: number;
    isSpam: boolean;
    suggestedBreakdown: string[];
    comment?: string;
    triagedAt: string;
  };
  splitFrom?: number;
  splitInto?: number[];
  agentLinks: Array<{
    specNumber: string;
    phase: 'planning' | 'coding' | 'qa';
    status: 'active' | 'completed' | 'failed';
    linkedAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
  lastTriagedAt?: string;
}

// ============================================
// File Schema Interfaces
// ============================================

export interface EnrichmentFile {
  schemaVersion: number;
  issues: Record<string, IssueEnrichment>;
}

export interface TransitionRecord {
  issueNumber: number;
  from: WorkflowState;
  to: WorkflowState;
  actor: TransitionActor;
  reason?: string;
  resolution?: Resolution;
  timestamp: string;
}

export interface TransitionsFile {
  transitions: TransitionRecord[];
}

// ============================================
// Type Guards
// ============================================

const WORKFLOW_STATES: readonly string[] = [
  'new',
  'triage',
  'ready',
  'in_progress',
  'review',
  'done',
  'blocked',
];

const RESOLUTIONS: readonly string[] = [
  'completed',
  'split',
  'duplicate',
  'wontfix',
  'stale',
];

export function isWorkflowState(value: string): value is WorkflowState {
  return WORKFLOW_STATES.includes(value);
}

export function isResolution(value: string): value is Resolution {
  return RESOLUTIONS.includes(value);
}

// ============================================
// Factory
// ============================================

export function createDefaultEnrichment(issueNumber: number): IssueEnrichment {
  const now = new Date().toISOString();
  return {
    issueNumber,
    triageState: 'new',
    priority: null,
    completenessScore: 0,
    enrichment: {},
    agentLinks: [],
    createdAt: now,
    updatedAt: now,
  };
}
