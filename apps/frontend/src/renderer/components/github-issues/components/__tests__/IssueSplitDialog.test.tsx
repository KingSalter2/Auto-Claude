/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { IssueSplitDialog } from '../IssueSplitDialog';
import type { SplitSuggestion, SplitProgress } from '../../../../../shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const suggestion: SplitSuggestion = {
  issueNumber: 42,
  subIssues: [
    { title: 'Sub Issue 1', body: 'Body of sub issue 1', labels: ['bug'] },
    { title: 'Sub Issue 2', body: 'Body of sub issue 2', labels: ['enhancement'] },
  ],
  rationale: 'This issue covers too many concerns',
  confidence: 0.88,
};

const defaultProps = {
  suggestion,
  progress: null as SplitProgress | null,
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('IssueSplitDialog', () => {
  it('renders sub-issue titles', () => {
    render(<IssueSplitDialog {...defaultProps} />);
    expect(screen.getByDisplayValue('Sub Issue 1')).toBeDefined();
    expect(screen.getByDisplayValue('Sub Issue 2')).toBeDefined();
  });

  it('renders rationale', () => {
    render(<IssueSplitDialog {...defaultProps} />);
    expect(screen.getByText(/too many concerns/)).toBeDefined();
  });

  it('calls onConfirm with sub-issues when confirmed', () => {
    render(<IssueSplitDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith(42, suggestion.subIssues);
  });

  it('calls onCancel when cancelled', () => {
    render(<IssueSplitDialog {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('allows editing sub-issue titles', () => {
    render(<IssueSplitDialog {...defaultProps} />);
    const input = screen.getByDisplayValue('Sub Issue 1');
    fireEvent.change(input, { target: { value: 'Updated Title' } });
    expect((input as HTMLInputElement).value).toBe('Updated Title');
  });

  it('shows progress when in progress', () => {
    const progress: SplitProgress = {
      phase: 'creating',
      progress: 50,
      message: 'Creating sub-issues...',
      createdCount: 1,
      totalCount: 2,
    };
    render(<IssueSplitDialog {...defaultProps} progress={progress} />);
    expect(screen.getByText(/Creating sub-issues/)).toBeDefined();
  });

  it('disables confirm button when in progress', () => {
    const progress: SplitProgress = {
      phase: 'creating',
      progress: 50,
      message: 'Creating...',
    };
    render(<IssueSplitDialog {...defaultProps} progress={progress} />);
    const button = screen.getByRole('button', { name: /confirm/i });
    expect(button).toHaveProperty('disabled', true);
  });
});
