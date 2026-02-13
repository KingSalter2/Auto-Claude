/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueList } from '../IssueList';
import type { GitHubIssue } from '../../../../../shared/types';
import type { IssueEnrichment } from '../../../../../shared/types/enrichment';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

function makeEnrichment(issueNumber: number, state: string, score: number): IssueEnrichment {
  return {
    issueNumber,
    triageState: state,
    completenessScore: score,
    enrichment: {
      problem: '',
      goal: '',
      scopeIn: [],
      scopeOut: [],
      acceptanceCriteria: [],
      technicalContext: '',
    },
  } as unknown as IssueEnrichment;
}

describe('IssueList enrichment integration', () => {
  const defaultProps = {
    issues: [makeIssue(1), makeIssue(2), makeIssue(3)],
    selectedIssueNumber: null,
    isLoading: false,
    error: null,
    onSelectIssue: vi.fn(),
    onInvestigate: vi.fn(),
  };

  it('passes triageState from enrichments to IssueListItem', () => {
    const enrichments = {
      '1': makeEnrichment(1, 'triage', 40),
      '2': makeEnrichment(2, 'ready', 80),
    };
    render(<IssueList {...defaultProps} enrichments={enrichments} />);
    // Issue 1 should show 'triage' badge, Issue 2 'ready' (via i18n keys)
    expect(screen.getByText('enrichment.states.triage')).toBeDefined();
    expect(screen.getByText('enrichment.states.ready')).toBeDefined();
  });

  it('defaults to new state when no enrichment exists', () => {
    render(<IssueList {...defaultProps} enrichments={{}} />);
    // All 3 issues should show 'New' badge (via i18n key)
    const newBadges = screen.getAllByText('enrichment.states.new');
    expect(newBadges.length).toBe(3);
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
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes[0].checked).toBe(false); // issue 1
    expect(checkboxes[1].checked).toBe(true);  // issue 2
    expect(checkboxes[2].checked).toBe(false); // issue 3
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
