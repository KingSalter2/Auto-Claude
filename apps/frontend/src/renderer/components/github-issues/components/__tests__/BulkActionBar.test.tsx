/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionBar } from '../BulkActionBar';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('BulkActionBar', () => {
  it('not rendered when selectedCount is 0', () => {
    const { container } = render(
      <BulkActionBar
        selectedCount={0}
        onBulkAction={vi.fn()}
        isOperating={false}
      />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('shows selected count text', () => {
    render(
      <BulkActionBar
        selectedCount={5}
        onBulkAction={vi.fn()}
        isOperating={false}
      />,
    );
    expect(screen.getByText('5 selected')).toBeDefined();
  });

  it('Close button fires onBulkAction with "close"', () => {
    const onBulkAction = vi.fn();
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkAction={onBulkAction}
        isOperating={false}
      />,
    );
    fireEvent.click(screen.getByText('Close'));
    expect(onBulkAction).toHaveBeenCalledWith('close');
  });

  it('has role="toolbar"', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        onBulkAction={vi.fn()}
        isOperating={false}
      />,
    );
    expect(screen.getByRole('toolbar')).toBeDefined();
  });

  it('has i18n aria-label on toolbar', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        onBulkAction={vi.fn()}
        isOperating={false}
      />,
    );
    expect(
      screen.getByRole('toolbar').getAttribute('aria-label'),
    ).toBe('bulk.actions');
  });

  it('all buttons disabled when isOperating', () => {
    render(
      <BulkActionBar
        selectedCount={2}
        onBulkAction={vi.fn()}
        isOperating={true}
        progress={{
          action: 'close',
          totalItems: 2,
          processedItems: 1,
        }}
      />,
    );
    const buttons = screen.getAllByRole('button');
    for (const button of buttons) {
      expect(button.hasAttribute('disabled')).toBe(true);
    }
  });

  it('progress text shown during operation', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkAction={vi.fn()}
        isOperating={true}
        progress={{
          action: 'close',
          totalItems: 5,
          processedItems: 2,
        }}
      />,
    );
    expect(screen.getByText('Processing 2/5...')).toBeDefined();
  });

  it('Triage All button has aria-label', () => {
    render(
      <BulkActionBar
        selectedCount={3}
        onBulkAction={vi.fn()}
        isOperating={false}
        untriagedCount={5}
        onTriageAll={vi.fn()}
      />,
    );
    const triageBtn = screen.getByRole('button', { name: 'aiTriage.triageAllButton' });
    expect(triageBtn).toBeDefined();
  });
});
