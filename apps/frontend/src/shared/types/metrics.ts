/**
 * Metrics types for Phase 4 (Polish + Extras).
 * Triage dashboard aggregations computed from transitions and enrichment data.
 */
import type { WorkflowState } from './enrichment';

// ============================================
// Metrics Types
// ============================================

export interface TriageMetrics {
  stateCounts: Record<WorkflowState, number>;
  avgTimeInState: Record<WorkflowState, number>; // milliseconds
  weeklyThroughput: Array<{ week: string; count: number }>;
  completenessDistribution: {
    low: number;     // 0-25
    medium: number;  // 25-50
    high: number;    // 50-75
    excellent: number; // 75-100
  };
  avgBacklogAge: number; // milliseconds
  totalTransitions: number;
  computedAt: string;
}

export type MetricsTimeWindow = '7d' | '30d' | 'all';

// ============================================
// Factory Functions
// ============================================

export function createEmptyMetrics(): TriageMetrics {
  return {
    stateCounts: {
      new: 0,
      triage: 0,
      ready: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    },
    avgTimeInState: {
      new: 0,
      triage: 0,
      ready: 0,
      in_progress: 0,
      review: 0,
      done: 0,
      blocked: 0,
    },
    weeklyThroughput: [],
    completenessDistribution: { low: 0, medium: 0, high: 0, excellent: 0 },
    avgBacklogAge: 0,
    totalTransitions: 0,
    computedAt: new Date().toISOString(),
  };
}

// ============================================
// Utility Functions
// ============================================

export function getCompletenessCategory(
  score: number,
): 'low' | 'medium' | 'high' | 'excellent' {
  if (score >= 75) return 'excellent';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0s';
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(ms / 60_000);
  if (minutes > 0) return `${minutes}m`;
  return `${Math.floor(ms / 1000)}s`;
}
