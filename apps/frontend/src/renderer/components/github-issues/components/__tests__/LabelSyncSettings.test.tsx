/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LabelSyncSettings } from '../LabelSyncSettings';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('LabelSyncSettings', () => {
  const defaultProps = {
    enabled: false,
    isSyncing: false,
    lastSyncedAt: null,
    error: null,
    onEnable: vi.fn(),
    onDisable: vi.fn(),
  };

  it('renders enable button when disabled', () => {
    render(<LabelSyncSettings {...defaultProps} />);
    expect(screen.getByText('labelSync.enable')).toBeDefined();
  });

  it('renders disable button when enabled', () => {
    render(<LabelSyncSettings {...defaultProps} enabled />);
    expect(screen.getByText('labelSync.disable')).toBeDefined();
  });

  it('calls onEnable when enable clicked', () => {
    const onEnable = vi.fn();
    render(<LabelSyncSettings {...defaultProps} onEnable={onEnable} />);
    fireEvent.click(screen.getByText('labelSync.enable'));
    expect(onEnable).toHaveBeenCalledOnce();
  });

  it('calls onDisable(false) when disable clicked', () => {
    const onDisable = vi.fn();
    render(<LabelSyncSettings {...defaultProps} enabled onDisable={onDisable} />);
    fireEvent.click(screen.getByText('labelSync.disable'));
    expect(onDisable).toHaveBeenCalledWith(false);
  });

  it('shows syncing state', () => {
    render(<LabelSyncSettings {...defaultProps} isSyncing />);
    expect(screen.getByText('labelSync.syncing')).toBeDefined();
  });

  it('shows last synced date when enabled', () => {
    render(
      <LabelSyncSettings
        {...defaultProps}
        enabled
        lastSyncedAt="2026-01-15T00:00:00Z"
      />,
    );
    // Translation key is used directly in tests
    expect(screen.getByText(/labelSync\.lastSynced/)).toBeDefined();
  });

  it('shows cleanup option when enabled', () => {
    render(<LabelSyncSettings {...defaultProps} enabled />);
    expect(screen.getByText('labelSync.disableAndCleanup')).toBeDefined();
  });

  it('calls onDisable(true) when cleanup clicked', () => {
    const onDisable = vi.fn();
    render(<LabelSyncSettings {...defaultProps} enabled onDisable={onDisable} />);
    fireEvent.click(screen.getByText('labelSync.disableAndCleanup'));
    expect(onDisable).toHaveBeenCalledWith(true);
  });

  it('shows error message', () => {
    render(<LabelSyncSettings {...defaultProps} error="Rate limited" />);
    expect(screen.getByRole('alert').textContent).toBe('Rate limited');
  });

  it('uses semantic section element', () => {
    const { container } = render(<LabelSyncSettings {...defaultProps} />);
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('disables buttons while syncing', () => {
    render(<LabelSyncSettings {...defaultProps} isSyncing />);
    const button = screen.getByText('labelSync.syncing');
    expect(button.getAttribute('disabled')).not.toBeNull();
  });
});
