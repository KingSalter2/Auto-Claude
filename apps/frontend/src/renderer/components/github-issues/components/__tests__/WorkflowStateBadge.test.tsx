/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WorkflowStateBadge } from '../WorkflowStateBadge';
import {
  WORKFLOW_STATE_COLORS,
  WORKFLOW_STATE_LABELS,
} from '../../../../../shared/constants/enrichment';
import type { WorkflowState } from '../../../../../shared/types/enrichment';

const ALL_STATES: WorkflowState[] = [
  'new',
  'triage',
  'ready',
  'in_progress',
  'review',
  'done',
  'blocked',
];

describe('WorkflowStateBadge', () => {
  for (const state of ALL_STATES) {
    it(`renders label for "${state}"`, () => {
      render(<WorkflowStateBadge state={state} />);
      expect(screen.getByText(WORKFLOW_STATE_LABELS[state])).toBeDefined();
    });

    it(`applies correct color classes for "${state}"`, () => {
      render(<WorkflowStateBadge state={state} />);
      const badge = screen.getByRole('status');
      const colors = WORKFLOW_STATE_COLORS[state];
      for (const cls of colors.bg.split(' ')) {
        expect(badge.className).toContain(cls);
      }
    });
  }

  it('has role="status"', () => {
    render(<WorkflowStateBadge state="new" />);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('has aria-label matching state name', () => {
    render(<WorkflowStateBadge state="in_progress" />);
    const badge = screen.getByRole('status');
    expect(badge.getAttribute('aria-label')).toBe('In Progress');
  });

  it('parent container has aria-live="polite"', () => {
    const { container } = render(<WorkflowStateBadge state="new" />);
    const liveRegion = container.querySelector('[aria-live="polite"]');
    expect(liveRegion).not.toBeNull();
  });
});
