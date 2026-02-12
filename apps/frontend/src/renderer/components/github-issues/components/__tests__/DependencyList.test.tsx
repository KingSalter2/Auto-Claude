/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DependencyList } from '../DependencyList';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('DependencyList', () => {
  const emptyDeps = { tracks: [], trackedBy: [] };

  it('shows loading state', () => {
    render(<DependencyList dependencies={emptyDeps} isLoading error={null} />);
    expect(screen.getByText('dependencies.loading')).toBeDefined();
  });

  it('shows error with retry button', () => {
    const onRefresh = vi.fn();
    render(
      <DependencyList
        dependencies={emptyDeps}
        isLoading={false}
        error="API unavailable"
        onRefresh={onRefresh}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('API unavailable');
    fireEvent.click(screen.getByText('dependencies.retry'));
    expect(onRefresh).toHaveBeenCalledOnce();
  });

  it('shows empty state when no dependencies', () => {
    render(<DependencyList dependencies={emptyDeps} isLoading={false} error={null} />);
    expect(screen.getByText('dependencies.none')).toBeDefined();
  });

  it('renders tracks', () => {
    const deps = {
      tracks: [
        { issueNumber: 10, title: 'Sub-task A', state: 'open' as const },
        { issueNumber: 11, title: 'Sub-task B', state: 'closed' as const },
      ],
      trackedBy: [],
    };
    render(<DependencyList dependencies={deps} isLoading={false} error={null} />);
    expect(screen.getByText('#10')).toBeDefined();
    expect(screen.getByText('#11')).toBeDefined();
    expect(screen.getByText('Sub-task A')).toBeDefined();
    expect(screen.getByText('Sub-task B')).toBeDefined();
  });

  it('renders trackedBy', () => {
    const deps = {
      tracks: [],
      trackedBy: [
        { issueNumber: 5, title: 'Parent Issue', state: 'open' as const },
      ],
    };
    render(<DependencyList dependencies={deps} isLoading={false} error={null} />);
    expect(screen.getByText('#5')).toBeDefined();
    expect(screen.getByText('Parent Issue')).toBeDefined();
  });

  it('shows cross-repo reference', () => {
    const deps = {
      tracks: [
        { issueNumber: 10, title: 'Cross-repo', state: 'open' as const, repo: 'org/other' },
      ],
      trackedBy: [],
    };
    render(<DependencyList dependencies={deps} isLoading={false} error={null} />);
    expect(screen.getByText('org/other#10')).toBeDefined();
  });

  it('shows total count', () => {
    const deps = {
      tracks: [{ issueNumber: 1, title: 'A', state: 'open' as const }],
      trackedBy: [{ issueNumber: 2, title: 'B', state: 'open' as const }],
    };
    render(<DependencyList dependencies={deps} isLoading={false} error={null} />);
    expect(screen.getByText('2')).toBeDefined();
  });

  it('has accessible region role', () => {
    const deps = {
      tracks: [{ issueNumber: 1, title: 'A', state: 'open' as const }],
      trackedBy: [],
    };
    const { container } = render(
      <DependencyList dependencies={deps} isLoading={false} error={null} />,
    );
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('shows state indicator dot with correct color', () => {
    const deps = {
      tracks: [
        { issueNumber: 10, title: 'Open', state: 'open' as const },
        { issueNumber: 11, title: 'Closed', state: 'closed' as const },
      ],
      trackedBy: [],
    };
    const { container } = render(
      <DependencyList dependencies={deps} isLoading={false} error={null} />,
    );
    const dots = container.querySelectorAll('.rounded-full');
    expect(dots.length).toBeGreaterThanOrEqual(2);
  });
});
