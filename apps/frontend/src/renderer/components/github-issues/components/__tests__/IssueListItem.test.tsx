/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
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
  labels: [{ name: 'bug', color: 'ff0000' }],
  assignees: [],
  commentsCount: 3,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
  url: 'https://github.com/owner/repo/issues/42',
};

describe('IssueListItem compact mode', () => {
  const baseProps = {
    issue: mockIssue,
    isSelected: false,
    onClick: vi.fn(),
    onInvestigate: vi.fn(),
  };

  it('shows metadata footer in normal mode', () => {
    render(<IssueListItem {...baseProps} />);
    expect(screen.getByText('alice')).toBeDefined();
  });

  it('hides metadata footer when compact=true', () => {
    render(<IssueListItem {...baseProps} compact />);
    expect(screen.queryByText('alice')).toBeNull();
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
