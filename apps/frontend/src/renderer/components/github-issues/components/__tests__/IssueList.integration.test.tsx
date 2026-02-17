/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueList } from '../IssueList';
import type { GitHubIssue } from '@shared/types';
import type { InvestigationState } from '@shared/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, i) => ({
        index: i,
        key: i,
        start: i * 80,
        size: 80,
        end: (i + 1) * 80,
      })),
    getTotalSize: () => count * 80,
    measureElement: () => {},
  }),
}));

function makeIssue(num: number): GitHubIssue {
  return {
    id: num,
    number: num,
    title: `Issue #${num}`,
    body: '',
    state: 'open',
    url: `https://api.github.com/repos/owner/repo/issues/${num}`,
    htmlUrl: `https://github.com/owner/repo/issues/${num}`,
    repoFullName: 'owner/repo',
    author: { login: 'user', avatarUrl: '' },
    labels: [],
    assignees: [],
    commentsCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

describe('IssueList investigation integration', () => {
  const defaultProps = {
    issues: [makeIssue(1), makeIssue(2), makeIssue(3)],
    selectedIssueNumber: null,
    isLoading: false,
    error: null,
    onSelectIssue: vi.fn(),
    onInvestigate: vi.fn(),
  };

  it('passes investigationStates to IssueListItem and renders progress bars', () => {
    const investigationStates: Record<string, { state: InvestigationState; progress?: number }> = {
      '1': { state: 'investigating', progress: 40 },
      '2': { state: 'failed' },
    };
    render(<IssueList {...defaultProps} investigationStates={investigationStates} />);
    // Issue 1 should show a progress bar with 40%
    expect(screen.getByText('40%')).toBeDefined();
    // Issue 2 should have a red border stripe for failed state
    const issue2Items = screen.getAllByText('Issue #2');
    expect(issue2Items.length).toBeGreaterThan(0);
  });

  it('renders no progress bar when investigationStates is empty (new issues)', () => {
    render(<IssueList {...defaultProps} investigationStates={{}} />);
    // No progress bars should render for issues without investigation state
    expect(screen.queryByText('40%')).toBeNull();
    // All 3 issues should still render their titles
    expect(screen.getByText('Issue #1')).toBeDefined();
    expect(screen.getByText('Issue #2')).toBeDefined();
    expect(screen.getByText('Issue #3')).toBeDefined();
  });

  it('renders selection checkbox when onToggleSelect provided', () => {
    const onToggleSelect = vi.fn();
    render(
      <IssueList
        {...defaultProps}
        onToggleSelect={onToggleSelect}
        selectedIssueNumbers={new Set()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(3);
  });

  it('checkbox click calls onToggleSelect with issue number', () => {
    const onToggleSelect = vi.fn();
    render(
      <IssueList
        {...defaultProps}
        onToggleSelect={onToggleSelect}
        selectedIssueNumbers={new Set()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onToggleSelect).toHaveBeenCalledWith(1);
  });

  it('checkbox click does not trigger issue selection', () => {
    const onSelectIssue = vi.fn();
    const onToggleSelect = vi.fn();
    render(
      <IssueList
        {...defaultProps}
        onSelectIssue={onSelectIssue}
        onToggleSelect={onToggleSelect}
        selectedIssueNumbers={new Set()}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    expect(onSelectIssue).not.toHaveBeenCalled();
  });

  it('shows checked state for selected issues', () => {
    const onToggleSelect = vi.fn();
    render(
      <IssueList
        {...defaultProps}
        onToggleSelect={onToggleSelect}
        selectedIssueNumbers={new Set([2])}
      />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0].getAttribute('aria-checked')).toBe('false'); // issue 1
    expect(checkboxes[1].getAttribute('aria-checked')).toBe('true');  // issue 2
    expect(checkboxes[2].getAttribute('aria-checked')).toBe('false'); // issue 3
  });
});

describe('IssueList ARIA listbox', () => {
  const defaultProps = {
    issues: [makeIssue(1), makeIssue(2), makeIssue(3)],
    selectedIssueNumber: null,
    isLoading: false,
    error: null,
    onSelectIssue: vi.fn(),
    onInvestigate: vi.fn(),
  };

  it('items container has role="listbox"', () => {
    render(<IssueList {...defaultProps} />);
    expect(screen.getByRole('listbox')).toBeDefined();
  });

  it('listbox has an accessible label', () => {
    render(<IssueList {...defaultProps} />);
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-label')).toBe('issues.listLabel');
  });

  it('each issue item has role="option"', () => {
    render(<IssueList {...defaultProps} />);
    const options = screen.getAllByRole('option');
    expect(options.length).toBe(3);
  });

  it('selected issue has aria-selected=true', () => {
    render(<IssueList {...defaultProps} selectedIssueNumber={2} />);
    const options = screen.getAllByRole('option');
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
    expect(options[2].getAttribute('aria-selected')).toBe('false');
  });
});
