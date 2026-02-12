/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MetricsDashboard } from '../MetricsDashboard';
import { createEmptyMetrics } from '../../../../../shared/types/metrics';
import type { TriageMetrics } from '../../../../../shared/types/metrics';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function makeMetrics(overrides?: Partial<TriageMetrics>): TriageMetrics {
  return { ...createEmptyMetrics(), ...overrides };
}

describe('MetricsDashboard', () => {
  const defaultProps = {
    metrics: makeMetrics(),
    timeWindow: '30d' as const,
    isLoading: false,
    error: null,
    onTimeWindowChange: vi.fn(),
    onRefresh: vi.fn(),
  };

  it('renders title', () => {
    render(<MetricsDashboard {...defaultProps} />);
    expect(screen.getByText('metrics.title')).toBeDefined();
  });

  it('renders time window toggle buttons', () => {
    render(<MetricsDashboard {...defaultProps} />);
    expect(screen.getByText('7 days')).toBeDefined();
    expect(screen.getByText('30 days')).toBeDefined();
    expect(screen.getByText('All time')).toBeDefined();
  });

  it('highlights current time window', () => {
    render(<MetricsDashboard {...defaultProps} timeWindow="7d" />);
    const btn7d = screen.getByText('7 days');
    expect(btn7d.getAttribute('aria-pressed')).toBe('true');
  });

  it('calls onTimeWindowChange', () => {
    const onChange = vi.fn();
    render(<MetricsDashboard {...defaultProps} onTimeWindowChange={onChange} />);
    fireEvent.click(screen.getByText('All time'));
    expect(onChange).toHaveBeenCalledWith('all');
  });

  it('shows refresh button', () => {
    render(<MetricsDashboard {...defaultProps} />);
    fireEvent.click(screen.getByText('metrics.refresh'));
    expect(defaultProps.onRefresh).toHaveBeenCalledOnce();
  });

  it('shows computing state', () => {
    render(<MetricsDashboard {...defaultProps} isLoading />);
    expect(screen.getByText('metrics.computing')).toBeDefined();
  });

  it('shows error message', () => {
    render(<MetricsDashboard {...defaultProps} error="Failed" />);
    expect(screen.getByRole('alert').textContent).toBe('Failed');
  });

  it('renders state counts', () => {
    const metrics = makeMetrics({
      stateCounts: { new: 5, triage: 3, ready: 2, in_progress: 1, review: 0, done: 4, blocked: 0 },
    });
    render(<MetricsDashboard {...defaultProps} metrics={metrics} />);
    // State count badges should show values
    expect(screen.getByText('5')).toBeDefined(); // new count
    expect(screen.getByText('3')).toBeDefined(); // triage count
    expect(screen.getByText('4')).toBeDefined(); // done count
  });

  it('renders completeness distribution', () => {
    const metrics = makeMetrics({
      completenessDistribution: { low: 2, medium: 3, high: 4, excellent: 1 },
    });
    render(<MetricsDashboard {...defaultProps} metrics={metrics} />);
    expect(screen.getByText('2')).toBeDefined(); // low
    expect(screen.getByText('3')).toBeDefined(); // medium
    expect(screen.getByText('4')).toBeDefined(); // high
  });

  it('renders total transitions', () => {
    const metrics = makeMetrics({ totalTransitions: 42 });
    render(<MetricsDashboard {...defaultProps} metrics={metrics} />);
    expect(screen.getByText('42')).toBeDefined();
  });

  it('shows dash for zero backlog age', () => {
    render(<MetricsDashboard {...defaultProps} />);
    expect(screen.getByText('—')).toBeDefined();
  });

  it('formats backlog age', () => {
    const metrics = makeMetrics({ avgBacklogAge: 86_400_000 }); // 1 day
    render(<MetricsDashboard {...defaultProps} metrics={metrics} />);
    expect(screen.getByText('1d')).toBeDefined();
  });

  it('shows this week throughput', () => {
    const metrics = makeMetrics({
      weeklyThroughput: [
        { week: '2026-02-03', count: 5 },
        { week: '2026-02-10', count: 8 },
      ],
    });
    render(<MetricsDashboard {...defaultProps} metrics={metrics} />);
    expect(screen.getByText('8')).toBeDefined(); // latest week
  });

  it('uses semantic section element', () => {
    const { container } = render(<MetricsDashboard {...defaultProps} />);
    expect(container.querySelector('section')).not.toBeNull();
  });
});
