/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressiveTrustSettings } from '../ProgressiveTrustSettings';
import { createDefaultProgressiveTrust } from '../../../../../shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const defaultProps = {
  config: createDefaultProgressiveTrust(),
  onSave: vi.fn(),
  onCancel: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProgressiveTrustSettings', () => {
  it('renders four category rows', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    expect(screen.getByText(/type/i)).toBeDefined();
    expect(screen.getByText(/priority/i)).toBeDefined();
    expect(screen.getByText(/labels/i)).toBeDefined();
    expect(screen.getByText(/duplicate/i)).toBeDefined();
  });

  it('renders toggle for each category', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBeGreaterThanOrEqual(4);
  });

  it('calls onSave when save button clicked', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    expect(defaultProps.onSave).toHaveBeenCalled();
  });

  it('calls onCancel when cancel button clicked', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('shows batch size input', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const batchInput = screen.getByDisplayValue('50');
    expect(batchInput).toBeDefined();
  });

  it('shows confirm-above input', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const confirmInput = screen.getByDisplayValue('10');
    expect(confirmInput).toBeDefined();
  });

  it('toggles category enabled state', () => {
    render(<ProgressiveTrustSettings {...defaultProps} />);
    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[0]);
    // After save, the config should reflect the change
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    const savedConfig = defaultProps.onSave.mock.calls[0][0];
    expect(savedConfig.autoApply.type.enabled).toBe(true);
  });
});
