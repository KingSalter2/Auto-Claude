/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueListHeader } from '../IssueListHeader';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const baseProps = {
  repoFullName: 'owner/repo',
  openIssuesCount: 10,
  isLoading: false,
  searchQuery: '',
  filterState: 'open' as const,
  onSearchChange: vi.fn(),
  onFilterChange: vi.fn(),
  onRefresh: vi.fn(),
};

describe('IssueListHeader triage toggle', () => {
  it('renders triage toggle when onToggleTriageMode is provided', () => {
    render(
      <IssueListHeader
        {...baseProps}
        onToggleTriageMode={vi.fn()}
        isTriageModeEnabled={false}
        isTriageModeAvailable={true}
      />,
    );
    expect(screen.getByRole('button', { name: 'phase5.triageMode' })).toBeDefined();
  });

  it('does not render triage toggle when onToggleTriageMode is not provided', () => {
    render(<IssueListHeader {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'phase5.triageMode' })).toBeNull();
  });

  it('triage toggle fires onToggleTriageMode on click', () => {
    const onToggleTriageMode = vi.fn();
    render(
      <IssueListHeader
        {...baseProps}
        onToggleTriageMode={onToggleTriageMode}
        isTriageModeEnabled={false}
        isTriageModeAvailable={true}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'phase5.triageMode' }));
    expect(onToggleTriageMode).toHaveBeenCalled();
  });

  it('triage toggle is disabled when not available', () => {
    render(
      <IssueListHeader
        {...baseProps}
        onToggleTriageMode={vi.fn()}
        isTriageModeEnabled={false}
        isTriageModeAvailable={false}
      />,
    );
    const btn = screen.getByRole('button', { name: 'phase5.triageMode' });
    expect(btn.hasAttribute('disabled')).toBe(true);
  });

  it('triage toggle has aria-pressed when enabled', () => {
    render(
      <IssueListHeader
        {...baseProps}
        onToggleTriageMode={vi.fn()}
        isTriageModeEnabled={true}
        isTriageModeAvailable={true}
      />,
    );
    const btn = screen.getByRole('button', { name: 'phase5.triageMode' });
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});
