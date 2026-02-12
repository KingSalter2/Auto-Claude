/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchTriageReview } from '../BatchTriageReview';
import type { TriageReviewItem } from '../../../../../shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function createItem(issueNumber: number, status: TriageReviewItem['status'] = 'pending'): TriageReviewItem {
  return {
    issueNumber,
    issueTitle: `Issue #${issueNumber}`,
    result: {
      category: 'bug',
      confidence: 0.85,
      labelsToAdd: ['bug'],
      labelsToRemove: [],
      isDuplicate: false,
      isSpam: false,
      isFeatureCreep: false,
      suggestedBreakdown: [],
      priority: 'high',
      triagedAt: '2026-01-01T00:00:00Z',
    },
    status,
  };
}

const defaultProps = {
  onAccept: vi.fn(),
  onReject: vi.fn(),
  onAcceptAll: vi.fn(),
  onDismiss: vi.fn(),
  onApply: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('BatchTriageReview', () => {
  it('renders review items', () => {
    const items = [createItem(1), createItem(2)];
    render(<BatchTriageReview items={items} {...defaultProps} />);
    expect(screen.getByText('#1')).toBeDefined();
    expect(screen.getByText('#2')).toBeDefined();
  });

  it('shows counter text', () => {
    const items = [createItem(1, 'accepted'), createItem(2), createItem(3)];
    render(<BatchTriageReview items={items} {...defaultProps} />);
    // i18n mock returns the key
    expect(screen.getByText(/batchReview\.reviewed/)).toBeDefined();
  });

  it('calls onAcceptAll when button clicked', () => {
    const items = [createItem(1), createItem(2)];
    render(<BatchTriageReview items={items} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /accept.*all/i }));
    expect(defaultProps.onAcceptAll).toHaveBeenCalled();
  });

  it('calls onDismiss when dismiss button clicked', () => {
    const items = [createItem(1)];
    render(<BatchTriageReview items={items} {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(defaultProps.onDismiss).toHaveBeenCalled();
  });

  it('shows auto-applied badge on auto-applied items', () => {
    const items = [createItem(1, 'auto-applied')];
    render(<BatchTriageReview items={items} {...defaultProps} />);
    expect(screen.getByText(/batchReview\.auto/)).toBeDefined();
  });

  it('shows empty state when no items', () => {
    render(<BatchTriageReview items={[]} {...defaultProps} />);
    expect(screen.getByText(/no.*results/i)).toBeDefined();
  });

  it('shows undo button when onUndo provided', () => {
    const items = [createItem(1, 'accepted')];
    const onUndo = vi.fn();
    render(<BatchTriageReview items={items} {...defaultProps} onUndo={onUndo} />);
    const undoBtn = screen.getByRole('button', { name: /undo/i });
    expect(undoBtn).toBeDefined();
    fireEvent.click(undoBtn);
    expect(onUndo).toHaveBeenCalled();
  });

  it('does not show undo button when onUndo is not provided', () => {
    const items = [createItem(1, 'accepted')];
    render(<BatchTriageReview items={items} {...defaultProps} />);
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
  });
});
