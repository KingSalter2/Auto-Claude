/**
 * Dependency types for Phase 4 (Polish + Extras).
 * Read-only display of GitHub native tracks/tracked-by relationships.
 */

// ============================================
// Dependency Types
// ============================================

export interface IssueDependency {
  issueNumber: number;
  title: string;
  state: 'open' | 'closed';
  repo?: string;
}

export interface IssueDependencies {
  tracks: IssueDependency[];
  trackedBy: IssueDependency[];
}

// ============================================
// Factory & Utility Functions
// ============================================

export function createEmptyDependencies(): IssueDependencies {
  return { tracks: [], trackedBy: [] };
}

export function hasDependencies(deps: IssueDependencies): boolean {
  return deps.tracks.length > 0 || deps.trackedBy.length > 0;
}

export function totalDependencyCount(deps: IssueDependencies): number {
  return deps.tracks.length + deps.trackedBy.length;
}
