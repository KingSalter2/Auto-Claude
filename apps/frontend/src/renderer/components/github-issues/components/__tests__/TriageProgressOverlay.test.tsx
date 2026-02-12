/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriageProgressOverlay } from '../TriageProgressOverlay';
import type { EnrichmentProgress } from '../../../../../shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('TriageProgressOverlay', () => {
  it('renders progress message', () => {
    const progress: EnrichmentProgress = {
      phase: 'analyzing',
      progress: 42,
      message: 'Analyzing issue #42...',
    };
    render(<TriageProgressOverlay progress={progress} onCancel={vi.fn()} />);
    expect(screen.getByText('Analyzing issue #42...')).toBeDefined();
  });

  it('renders progress bar', () => {
    const progress: EnrichmentProgress = {
      phase: 'generating',
      progress: 65,
      message: 'Generating...',
    };
    render(<TriageProgressOverlay progress={progress} onCancel={vi.fn()} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('65');
  });

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn();
    const progress: EnrichmentProgress = {
      phase: 'analyzing',
      progress: 10,
      message: 'Working...',
    };
    render(<TriageProgressOverlay progress={progress} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows 0% at start', () => {
    const progress: EnrichmentProgress = {
      phase: 'analyzing',
      progress: 0,
      message: 'Starting...',
    };
    render(<TriageProgressOverlay progress={progress} onCancel={vi.fn()} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
  });
});
