/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProgressiveTrustSettingsConnected } from '../ProgressiveTrustSettingsConnected';
import { createDefaultProgressiveTrust } from '../../../../../shared/types/ai-triage';

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock project store
vi.mock('../../../../stores/project-store', () => ({
  useProjectStore: vi.fn((selector: (s: { activeProject: { id: string } | null }) => unknown) =>
    selector({ activeProject: { id: 'proj-1' } }),
  ),
}));

// Mock electronAPI
const mockGithub = {
  getProgressiveTrust: vi.fn(),
  saveProgressiveTrust: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (window as Record<string, unknown>).electronAPI = { github: mockGithub };
  mockGithub.getProgressiveTrust.mockResolvedValue(createDefaultProgressiveTrust());
  mockGithub.saveProgressiveTrust.mockResolvedValue(true);
});

describe('ProgressiveTrustSettingsConnected', () => {
  it('renders ProgressiveTrustSettings after config loaded', async () => {
    render(<ProgressiveTrustSettingsConnected />);
    await waitFor(() => {
      expect(screen.getByText('common:progressiveTrust.crawl')).toBeDefined();
    });
  });

  it('loads config from IPC on mount', async () => {
    render(<ProgressiveTrustSettingsConnected />);
    await waitFor(() => {
      expect(mockGithub.getProgressiveTrust).toHaveBeenCalledWith('proj-1');
    });
  });

  it('saves config via IPC on save', async () => {
    render(<ProgressiveTrustSettingsConnected />);
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeDefined();
    });
    fireEvent.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(mockGithub.saveProgressiveTrust).toHaveBeenCalledWith('proj-1', expect.any(Object));
    });
  });
});
