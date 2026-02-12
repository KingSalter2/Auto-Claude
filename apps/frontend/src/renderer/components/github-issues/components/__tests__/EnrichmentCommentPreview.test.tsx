/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EnrichmentCommentPreview } from '../EnrichmentCommentPreview';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  content: '## Summary\n\nThis is a bug report about login failures.',
  onPost: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('EnrichmentCommentPreview', () => {
  it('renders content in textarea', () => {
    render(<EnrichmentCommentPreview {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    expect((textarea as HTMLTextAreaElement).value).toContain('bug report');
  });

  it('shows character count', () => {
    render(<EnrichmentCommentPreview {...defaultProps} />);
    // Rendered in a <span> as "54 common:enrichmentComment.characters"
    const spans = screen.getAllByText(/characters/i);
    const charSpan = spans.find(el => el.tagName === 'SPAN');
    expect(charSpan).toBeDefined();
    expect(charSpan?.textContent).toContain(String(defaultProps.content.length));
  });

  it('calls onPost when post button clicked', () => {
    render(<EnrichmentCommentPreview {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /post/i }));
    expect(defaultProps.onPost).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<EnrichmentCommentPreview {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('allows editing content', () => {
    render(<EnrichmentCommentPreview {...defaultProps} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Updated content' } });
    expect((textarea as HTMLTextAreaElement).value).toBe('Updated content');
  });

  it('includes footer in posted content', () => {
    render(<EnrichmentCommentPreview {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /post/i }));
    const postedContent = defaultProps.onPost.mock.calls[0][0];
    expect(postedContent).toContain('Auto-Claude');
  });
});
