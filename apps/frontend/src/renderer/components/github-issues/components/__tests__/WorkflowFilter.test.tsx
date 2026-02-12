/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WorkflowFilter } from '../WorkflowFilter';
import { WORKFLOW_STATE_LABELS } from '../../../../../shared/constants/enrichment';

/** Radix DropdownMenu requires pointer events to open in jsdom */
function openDropdown(trigger: HTMLElement) {
  fireEvent.pointerDown(trigger, { button: 0, pointerType: 'mouse' });
}

describe('WorkflowFilter', () => {
  it('renders trigger button with "All states" when no selection', () => {
    render(<WorkflowFilter selectedStates={[]} onChange={() => {}} />);
    expect(screen.getByText('All states')).toBeDefined();
  });

  it('shows selected count when states are selected', () => {
    render(<WorkflowFilter selectedStates={['new', 'triage']} onChange={() => {}} />);
    expect(screen.getByText('2 selected')).toBeDefined();
  });

  it('has aria-label on filter trigger', () => {
    render(<WorkflowFilter selectedStates={[]} onChange={() => {}} />);
    const trigger = screen.getByRole('button', { name: 'Filter by workflow state' });
    expect(trigger).toBeDefined();
  });

  it('renders all 7 states plus "All" when menu is open', async () => {
    render(<WorkflowFilter selectedStates={[]} onChange={() => {}} />);
    openDropdown(screen.getByRole('button', { name: 'Filter by workflow state' }));

    for (const label of Object.values(WORKFLOW_STATE_LABELS)) {
      await waitFor(() => {
        expect(screen.getAllByText(label).length).toBeGreaterThan(0);
      });
    }
    await waitFor(() => {
      expect(screen.getAllByText('All').length).toBeGreaterThan(0);
    });
  });

  it('calls onChange when a state is toggled on', async () => {
    const onChange = vi.fn();
    render(<WorkflowFilter selectedStates={[]} onChange={onChange} />);
    openDropdown(screen.getByRole('button', { name: 'Filter by workflow state' }));

    await waitFor(() => {
      expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('New')[0]);
    expect(onChange).toHaveBeenCalledWith(['new']);
  });

  it('calls onChange removing a state when toggled off', async () => {
    const onChange = vi.fn();
    render(<WorkflowFilter selectedStates={['new', 'triage']} onChange={onChange} />);
    openDropdown(screen.getByRole('button'));

    await waitFor(() => {
      expect(screen.getAllByText('New').length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getAllByText('New')[0]);
    expect(onChange).toHaveBeenCalledWith(['triage']);
  });
});
