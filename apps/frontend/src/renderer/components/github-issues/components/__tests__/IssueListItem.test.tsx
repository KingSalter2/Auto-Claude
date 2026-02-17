/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueListItem } from '../IssueListItem';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const mockIssue = {
  id: 1,
  number: 42,
  title: 'Test Issue',
  state: 'open' as const,
  body: 'Body text',
  author: { login: 'alice', avatarUrl: '' },
  labels: [{ id: 1, name: 'bug', color: 'ff0000' }],
  assignees: [],
  commentsCount: 3,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  url: 'https://api.github.com/repos/owner/repo/issues/42',
  htmlUrl: 'https://github.com/owner/repo/issues/42',
  repoFullName: 'owner/repo',
};

describe('IssueListItem compact mode', () => {
  const baseProps = {
    issue: mockIssue,
    isSelected: false,
    onClick: vi.fn(),
    onInvestigate: vi.fn(),
  };

  it('shows issue title in normal mode', () => {
    render(<IssueListItem {...baseProps} />);
    expect(screen.getByText('Test Issue')).toBeDefined();
  });

  it('shows issue title when compact=true', () => {
    render(<IssueListItem {...baseProps} compact />);
    expect(screen.getByText('Test Issue')).toBeDefined();
  });

  it('still shows title in compact mode', () => {
    render(<IssueListItem {...baseProps} compact />);
    expect(screen.getByText('Test Issue')).toBeDefined();
  });

  it('still shows issue number in compact mode', () => {
    render(<IssueListItem {...baseProps} compact />);
    expect(screen.getByText('#42')).toBeDefined();
  });
});

describe('IssueListItem ARIA', () => {
  const baseProps = {
    issue: mockIssue,
    isSelected: false,
    onClick: vi.fn(),
    onInvestigate: vi.fn(),
  };

  it('has role="option"', () => {
    render(<IssueListItem {...baseProps} />);
    expect(screen.getByRole('option')).toBeDefined();
  });

  it('aria-selected is false when not selected', () => {
    render(<IssueListItem {...baseProps} isSelected={false} />);
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('false');
  });

  it('aria-selected is true when selected', () => {
    render(<IssueListItem {...baseProps} isSelected />);
    expect(screen.getByRole('option').getAttribute('aria-selected')).toBe('true');
  });

  it('Enter key triggers onClick', () => {
    const onClick = vi.fn();
    render(<IssueListItem {...baseProps} onClick={onClick} />);
    fireEvent.keyDown(screen.getByRole('option'), { key: 'Enter' });
    expect(onClick).toHaveBeenCalledOnce();
  });
});
