import { describe, it, expect } from 'vitest';
import { mapInvestigationStateToWorkflowState } from '../constants/label-sync';

describe('mapInvestigationStateToWorkflowState', () => {
  it('maps "new" to "new"', () => {
    expect(mapInvestigationStateToWorkflowState('new')).toBe('new');
  });

  it('maps "done" to "done"', () => {
    expect(mapInvestigationStateToWorkflowState('done')).toBe('done');
  });

  it('maps "building" to "in_progress"', () => {
    expect(mapInvestigationStateToWorkflowState('building')).toBe('in_progress');
  });

  it('maps "task_created" to "ready"', () => {
    expect(mapInvestigationStateToWorkflowState('task_created')).toBe('ready');
  });

  it('maps "findings_ready" to "ready"', () => {
    expect(mapInvestigationStateToWorkflowState('findings_ready')).toBe('ready');
  });

  it('maps "investigating" to "triage"', () => {
    expect(mapInvestigationStateToWorkflowState('investigating')).toBe('triage');
  });

  it('maps "queued" to "ready"', () => {
    expect(mapInvestigationStateToWorkflowState('queued')).toBe('ready');
  });

  it('maps "interrupted" to "ready"', () => {
    expect(mapInvestigationStateToWorkflowState('interrupted')).toBe('ready');
  });

  it('maps "failed" to "ready"', () => {
    expect(mapInvestigationStateToWorkflowState('failed')).toBe('ready');
  });

  it('maps "resolved" to "done"', () => {
    expect(mapInvestigationStateToWorkflowState('resolved')).toBe('done');
  });

  it('returns null for unknown state', () => {
    expect(mapInvestigationStateToWorkflowState('unknown' as never)).toBe(null);
  });

  it('returns null for null input', () => {
    expect(mapInvestigationStateToWorkflowState(null as never)).toBe(null);
  });

  it('returns null for undefined input', () => {
    expect(mapInvestigationStateToWorkflowState(undefined as never)).toBe(null);
  });

  it('returns null for empty string', () => {
    expect(mapInvestigationStateToWorkflowState('' as never)).toBe(null);
  });
});
