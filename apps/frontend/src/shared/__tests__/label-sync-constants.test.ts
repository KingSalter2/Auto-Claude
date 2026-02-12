import { describe, it, expect } from 'vitest';
import {
  LABEL_PREFIX,
  WORKFLOW_LABEL_MAP,
  WORKFLOW_LABEL_COLORS,
  LABEL_DESCRIPTION,
  SYNC_DEBOUNCE_MS,
  TRIAGE_MODE_MIN_WIDTH,
  getLabelForState,
  getStateFromLabel,
  getWorkflowLabels,
  isAutoClaudeLabel,
} from '../constants/label-sync';
import type { WorkflowState } from '../types/enrichment';

const ALL_STATES: WorkflowState[] = [
  'new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked',
];

describe('LABEL_PREFIX', () => {
  it('is ac:', () => {
    expect(LABEL_PREFIX).toBe('ac:');
  });
});

describe('WORKFLOW_LABEL_MAP', () => {
  it('has entry for every WorkflowState', () => {
    for (const state of ALL_STATES) {
      expect(WORKFLOW_LABEL_MAP).toHaveProperty(state);
    }
  });

  it('all label names start with LABEL_PREFIX', () => {
    for (const label of Object.values(WORKFLOW_LABEL_MAP)) {
      expect(label.startsWith(LABEL_PREFIX)).toBe(true);
    }
  });

  it('maps in_progress to ac:in-progress (underscore to hyphen)', () => {
    expect(WORKFLOW_LABEL_MAP.in_progress).toBe('ac:in-progress');
  });

  it('has 7 entries', () => {
    expect(Object.keys(WORKFLOW_LABEL_MAP)).toHaveLength(7);
  });
});

describe('WORKFLOW_LABEL_COLORS', () => {
  it('has entry for every WorkflowState', () => {
    for (const state of ALL_STATES) {
      expect(WORKFLOW_LABEL_COLORS).toHaveProperty(state);
    }
  });

  it('all colors are valid 6-char hex (no # prefix)', () => {
    for (const color of Object.values(WORKFLOW_LABEL_COLORS)) {
      expect(color).toMatch(/^[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('LABEL_DESCRIPTION', () => {
  it('contains Auto-Claude', () => {
    expect(LABEL_DESCRIPTION).toContain('Auto-Claude');
  });
});

describe('SYNC_DEBOUNCE_MS', () => {
  it('is 2000', () => {
    expect(SYNC_DEBOUNCE_MS).toBe(2000);
  });
});

describe('TRIAGE_MODE_MIN_WIDTH', () => {
  it('is 1200', () => {
    expect(TRIAGE_MODE_MIN_WIDTH).toBe(1200);
  });
});

describe('getLabelForState', () => {
  it('returns correct label for each state', () => {
    for (const state of ALL_STATES) {
      expect(getLabelForState(state)).toBe(WORKFLOW_LABEL_MAP[state]);
    }
  });
});

describe('getStateFromLabel', () => {
  it('returns correct state for each label', () => {
    for (const state of ALL_STATES) {
      const label = WORKFLOW_LABEL_MAP[state];
      expect(getStateFromLabel(label)).toBe(state);
    }
  });

  it('returns null for unknown labels', () => {
    expect(getStateFromLabel('unknown')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getStateFromLabel('')).toBeNull();
  });

  it('returns null for partial match', () => {
    expect(getStateFromLabel('ac:')).toBeNull();
  });
});

describe('getLabelForState ↔ getStateFromLabel roundtrip', () => {
  it('roundtrips for all states', () => {
    for (const state of ALL_STATES) {
      const label = getLabelForState(state);
      expect(getStateFromLabel(label)).toBe(state);
    }
  });
});

describe('getWorkflowLabels', () => {
  it('returns 7 labels', () => {
    expect(getWorkflowLabels()).toHaveLength(7);
  });

  it('each label has name, color, and description', () => {
    for (const label of getWorkflowLabels()) {
      expect(label.name).toBeTruthy();
      expect(label.color).toMatch(/^[0-9A-Fa-f]{6}$/);
      expect(label.description).toBe(LABEL_DESCRIPTION);
    }
  });
});

describe('isAutoClaudeLabel', () => {
  it('returns true for ac: prefixed labels', () => {
    expect(isAutoClaudeLabel('ac:new')).toBe(true);
    expect(isAutoClaudeLabel('ac:in-progress')).toBe(true);
  });

  it('returns false for non-prefixed labels', () => {
    expect(isAutoClaudeLabel('bug')).toBe(false);
    expect(isAutoClaudeLabel('enhancement')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isAutoClaudeLabel('')).toBe(false);
  });
});
