import { describe, it, expect, vi } from 'vitest';

/**
 * GAP-15: Tests for the transition-with-sync pattern used in GitHubIssues.
 * Verifies that label sync is called correctly after workflow transitions.
 */

function transitionWithSync(
  transition: (to: string, resolution?: string) => void,
  syncLabel: (issueNumber: number, newState: string, oldState: string | null) => void,
  issueNumber: number,
  currentState: string,
  newState: string,
  resolution?: string,
) {
  transition(newState, resolution);
  syncLabel(issueNumber, newState, currentState);
}

describe('Label sync after transition', () => {
  it('calls syncIssueLabel with correct old and new state after transition', () => {
    const transition = vi.fn();
    const syncLabel = vi.fn();

    transitionWithSync(transition, syncLabel, 42, 'new', 'triage');

    expect(transition).toHaveBeenCalledWith('triage', undefined);
    expect(syncLabel).toHaveBeenCalledWith(42, 'triage', 'new');
  });

  it('passes resolution to transition but not to sync', () => {
    const transition = vi.fn();
    const syncLabel = vi.fn();

    transitionWithSync(transition, syncLabel, 10, 'review', 'done', 'fixed');

    expect(transition).toHaveBeenCalledWith('done', 'fixed');
    expect(syncLabel).toHaveBeenCalledWith(10, 'done', 'review');
  });

  it('calls sync even when transitioning from default "new" state', () => {
    const transition = vi.fn();
    const syncLabel = vi.fn();

    transitionWithSync(transition, syncLabel, 5, 'new', 'in_progress');

    expect(syncLabel).toHaveBeenCalledWith(5, 'in_progress', 'new');
  });
});
