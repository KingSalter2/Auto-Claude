/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowStateDropdown } from '../WorkflowStateDropdown';
import { WORKFLOW_STATE_LABELS } from '../../../../../shared/constants/enrichment';

/** Radix DropdownMenu requires pointer events to open in jsdom */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
}

describe('WorkflowStateDropdown', () => {
  it('shows current state label on trigger', () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    expect(screen.getByText(WORKFLOW_STATE_LABELS.new)).toBeDefined();
  });

  it('has aria-label on trigger', () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    expect(screen.getByRole('button', { name: 'Change workflow state' })).toBeDefined();
  });

  it('shows valid targets for "new" state', async () => {
    render(<WorkflowStateDropdown currentState="new" onTransition={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'Change workflow state' }));

    // new → triage, ready, in_progress, blocked
    for (const target of ['Triage', 'Ready', 'In Progress', 'Blocked']) {
      await waitFor(() => {
        expect(screen.getAllByText(target).length).toBeGreaterThan(0);
      });
    }
  });

  it('shows only "Ready" (reopen) for "done" state', async () => {
    render(<WorkflowStateDropdown currentState="done" onTransition={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'Change workflow state' }));

    await waitFor(() => {
      expect(screen.getAllByText('Ready').length).toBeGreaterThan(0);
    });

    // done only transitions to ready — no Triage in menu
    const menu = document.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu!.textContent).not.toContain('Triage');
  });

  it('shows "Unblock" option for blocked state with previousState', async () => {
    render(
      <WorkflowStateDropdown
        currentState="blocked"
        previousState="in_progress"
        onTransition={() => {}}
      />,
    );
    openDropdown(screen.getByRole('button', { name: 'Change workflow state' }));

    await waitFor(() => {
      expect(screen.getAllByText(/Unblock/).length).toBeGreaterThan(0);
    });
  });

  it('fires onTransition when selecting a target', async () => {
    const onTransition = vi.fn();
    render(<WorkflowStateDropdown currentState="new" onTransition={onTransition} />);
    openDropdown(screen.getByRole('button', { name: 'Change workflow state' }));

    await waitFor(() => {
      expect(screen.getAllByText('Triage').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('Triage')[0]);
    expect(onTransition).toHaveBeenCalledWith('triage');
  });

  it('is disabled when isAgentLocked is true', () => {
    render(
      <WorkflowStateDropdown currentState="new" isAgentLocked onTransition={() => {}} />,
    );
    const button = screen.getByRole('button', { name: 'Change workflow state' });
    expect(
      button.hasAttribute('disabled') || button.getAttribute('data-disabled') !== null,
    ).toBe(true);
  });
});
