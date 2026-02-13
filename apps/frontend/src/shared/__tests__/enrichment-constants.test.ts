import { describe, it, expect } from 'vitest';
import {
  VALID_TRANSITIONS,
  COMPLETENESS_WEIGHTS,
  WORKFLOW_STATE_COLORS,
  isValidTransition,
  getValidTargets,
} from '../constants/enrichment';
import { WORKFLOW_LABEL_MAP } from '../constants/label-sync';
import type { WorkflowState } from '../types/enrichment';

const ALL_STATES: WorkflowState[] = [
  'new',
  'triage',
  'ready',
  'in_progress',
  'review',
  'done',
  'blocked',
];

describe('VALID_TRANSITIONS', () => {
  it('has an entry for every WorkflowState', () => {
    for (const state of ALL_STATES) {
      expect(VALID_TRANSITIONS).toHaveProperty(state);
    }
  });

  it('every target state is a valid WorkflowState', () => {
    for (const targets of Object.values(VALID_TRANSITIONS)) {
      for (const target of targets) {
        expect(ALL_STATES).toContain(target);
      }
    }
  });
});

describe('COMPLETENESS_WEIGHTS', () => {
  it('values sum to exactly 1.0', () => {
    const sum = Object.values(COMPLETENESS_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 10);
  });
});

describe('WORKFLOW_LABEL_MAP', () => {
  it('has an entry for every WorkflowState', () => {
    for (const state of ALL_STATES) {
      expect(WORKFLOW_LABEL_MAP).toHaveProperty(state);
    }
  });
});

describe('WORKFLOW_STATE_COLORS', () => {
  it('has entries for all states', () => {
    for (const state of ALL_STATES) {
      expect(WORKFLOW_STATE_COLORS).toHaveProperty(state);
      expect(WORKFLOW_STATE_COLORS[state]).toHaveProperty('bg');
      expect(WORKFLOW_STATE_COLORS[state]).toHaveProperty('text');
    }
  });
});

describe('isValidTransition', () => {
  it('new → triage is valid', () => {
    expect(isValidTransition('new', 'triage')).toBe(true);
  });

  it('done → triage is invalid', () => {
    expect(isValidTransition('done', 'triage')).toBe(false);
  });

  it('done → ready is valid (reopen)', () => {
    expect(isValidTransition('done', 'ready')).toBe(true);
  });

  it('review → in_progress is valid (QA reject)', () => {
    expect(isValidTransition('review', 'in_progress')).toBe(true);
  });
});

describe('getValidTargets', () => {
  it('blocked returns empty array (uses previousState)', () => {
    expect(getValidTargets('blocked')).toEqual([]);
  });

  it('new returns triage, ready, in_progress, blocked', () => {
    const targets = getValidTargets('new');
    expect(targets).toContain('triage');
    expect(targets).toContain('ready');
    expect(targets).toContain('in_progress');
    expect(targets).toContain('blocked');
  });
});
