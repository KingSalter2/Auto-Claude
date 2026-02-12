/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriageResultCard } from '../TriageResultCard';
import type { TriageReviewItem } from '../../../../../shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function createItem(overrides: Partial<TriageReviewItem> = {}): TriageReviewItem {
  return {
    issueNumber: 42,
    issueTitle: 'Test Bug Report',
    result: {
      category: 'bug',
      confidence: 0.85,
      labelsToAdd: ['bug', 'priority:high'],
      labelsToRemove: ['needs-triage'],
      isDuplicate: false,
      isSpam: false,
      isFeatureCreep: false,
      suggestedBreakdown: [],
      priority: 'high',
      triagedAt: '2026-01-01T00:00:00Z',
    },
    status: 'pending',
    ...overrides,
  };
}

describe('TriageResultCard', () => {
  it('renders issue number and title', () => {
    render(<TriageResultCard item={createItem()} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('#42')).toBeDefined();
    expect(screen.getByText('Test Bug Report')).toBeDefined();
  });

  it('renders category and confidence', () => {
    render(<TriageResultCard item={createItem()} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText('bug')).toBeDefined();
    expect(screen.getByText('85%')).toBeDefined();
  });

  it('renders labels to add and remove', () => {
    render(<TriageResultCard item={createItem()} onAccept={vi.fn()} onReject={vi.fn()} />);
    // Labels are prefixed with + or -
    expect(screen.getByText((_, el) => el?.textContent === '+priority:high')).toBeDefined();
    expect(screen.getByText((_, el) => el?.textContent === '-needs-triage')).toBeDefined();
  });

  it('calls onAccept when accept button clicked', () => {
    const onAccept = vi.fn();
    render(<TriageResultCard item={createItem()} onAccept={onAccept} onReject={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /accept/i }));
    expect(onAccept).toHaveBeenCalledWith(42);
  });

  it('calls onReject when reject button clicked', () => {
    const onReject = vi.fn();
    render(<TriageResultCard item={createItem()} onAccept={vi.fn()} onReject={onReject} />);
    fireEvent.click(screen.getByRole('button', { name: /reject/i }));
    expect(onReject).toHaveBeenCalledWith(42);
  });

  it('shows high confidence with green styling', () => {
    render(<TriageResultCard item={createItem()} onAccept={vi.fn()} onReject={vi.fn()} />);
    const badge = screen.getByText('85%');
    expect(badge.className).toContain('green');
  });

  it('shows medium confidence with yellow styling', () => {
    const item = createItem();
    item.result.confidence = 0.65;
    render(<TriageResultCard item={item} onAccept={vi.fn()} onReject={vi.fn()} />);
    const badge = screen.getByText('65%');
    expect(badge.className).toContain('yellow');
  });

  it('shows duplicate indicator when isDuplicate', () => {
    const item = createItem();
    item.result.isDuplicate = true;
    item.result.duplicateOf = 10;
    render(<TriageResultCard item={item} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.getByText(/#10/)).toBeDefined();
  });

  it('hides action buttons for accepted items', () => {
    render(<TriageResultCard item={createItem({ status: 'accepted' })} onAccept={vi.fn()} onReject={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /accept/i })).toBeNull();
  });
});
