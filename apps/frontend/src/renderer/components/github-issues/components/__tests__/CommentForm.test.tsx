/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommentForm } from '../CommentForm';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown-preview">{children}</div>,
}));

describe('CommentForm', () => {
  it('renders textarea', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    expect(screen.getByRole('textbox')).toBeDefined();
  });

  it('empty submit shows error', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByText('commentForm.submit'));
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('submit with text fires onSubmit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Nice work!' } });
    fireEvent.click(screen.getByText('commentForm.submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('Nice work!');
    });
  });

  it('submitting shows loading state', () => {
    render(<CommentForm onSubmit={vi.fn()} isSubmitting />);
    expect(screen.getByText('commentForm.submitting')).toBeDefined();
  });

  it('after success, textarea clears', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} />);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'A comment' } });
    fireEvent.click(screen.getByText('commentForm.submit'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith('A comment');
    });

    await waitFor(() => {
      expect(textarea.value).toBe('');
    });
  });

  it('shows Write/Preview tabs', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    expect(screen.getByText('commentForm.write')).toBeDefined();
    expect(screen.getByText('commentForm.preview')).toBeDefined();
  });

  it('clicking Preview shows markdown preview', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '**bold text**' } });
    fireEvent.click(screen.getByText('commentForm.preview'));

    expect(screen.getByTestId('markdown-preview')).toBeDefined();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('clicking Write returns to textarea with content preserved', () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'my content' } });
    fireEvent.click(screen.getByText('commentForm.preview'));
    fireEvent.click(screen.getByText('commentForm.write'));

    const restoredTextarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(restoredTextarea.value).toBe('my content');
  });
});
