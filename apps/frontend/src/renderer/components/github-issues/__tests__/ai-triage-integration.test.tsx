/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TriageProgressOverlay } from '../components/TriageProgressOverlay';
import { IssueSplitDialog } from '../components/IssueSplitDialog';
import { EnrichmentCommentPreview } from '../components/EnrichmentCommentPreview';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../../../shared/constants/ai-triage', () => ({
  ENRICHMENT_COMMENT_FOOTER: '---\n_AI-generated_',
}));

describe('AI Triage integration', () => {
  it('TriageProgressOverlay renders progress bar and message', () => {
    const progress = { progress: 60, message: 'Enriching issue...' };
    render(<TriageProgressOverlay progress={progress} onCancel={vi.fn()} />);
    expect(screen.getByText('Enriching issue...')).toBeDefined();
    expect(screen.getByRole('progressbar')).toBeDefined();
  });

  it('TriageProgressOverlay cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    const progress = { progress: 30, message: 'Working...' };
    render(<TriageProgressOverlay progress={progress} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('IssueSplitDialog renders sub-issues from suggestion', () => {
    const suggestion = {
      issueNumber: 42,
      rationale: 'This issue should be split',
      subIssues: [
        { title: 'Sub-issue A', body: 'Body A', labels: ['bug'] },
        { title: 'Sub-issue B', body: 'Body B', labels: [] },
      ],
    };
    render(
      <IssueSplitDialog
        suggestion={suggestion}
        progress={null}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('Sub-issue A')).toBeDefined();
    expect(screen.getByDisplayValue('Sub-issue B')).toBeDefined();
    expect(screen.getByText('This issue should be split')).toBeDefined();
  });

  it('IssueSplitDialog onConfirm passes sub-issues', () => {
    const onConfirm = vi.fn();
    const suggestion = {
      issueNumber: 42,
      rationale: 'Split needed',
      subIssues: [{ title: 'Sub A', body: 'Body A', labels: [] }],
    };
    render(
      <IssueSplitDialog
        suggestion={suggestion}
        progress={null}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    // Click the confirm button
    const confirmBtn = screen.getByRole('button', { name: 'common:issueSplit.confirm' });
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledWith(42, [{ title: 'Sub A', body: 'Body A', labels: [] }]);
  });

  it('EnrichmentCommentPreview renders content and post button', () => {
    render(
      <EnrichmentCommentPreview
        content="AI analysis comment"
        onPost={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByDisplayValue('AI analysis comment')).toBeDefined();
  });

  it('EnrichmentCommentPreview calls onCancel on discard', () => {
    const onCancel = vi.fn();
    render(
      <EnrichmentCommentPreview content="test" onPost={vi.fn()} onCancel={onCancel} />,
    );
    const cancelBtn = screen.getByRole('button', { name: 'common:enrichmentComment.cancel' });
    fireEvent.click(cancelBtn);
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
