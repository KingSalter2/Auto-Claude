/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { LabelSyncSettingsConnected } from '../LabelSyncSettingsConnected';
import { useLabelSyncStore } from '../../../../stores/github/label-sync-store';

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
  getLabelSyncStatus: vi.fn(),
  enableLabelSync: vi.fn(),
  disableLabelSync: vi.fn(),
  syncIssueLabel: vi.fn(),
  saveLabelSyncConfig: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  useLabelSyncStore.getState().reset();
  (window as unknown as Record<string, unknown>).electronAPI = { github: mockGithub };
  mockGithub.getLabelSyncStatus.mockResolvedValue({ enabled: false, lastSyncedAt: null });
});

describe('LabelSyncSettingsConnected', () => {
  it('renders LabelSyncSettings with hook data', async () => {
    render(<LabelSyncSettingsConnected />);
    await waitFor(() => {
      expect(screen.getByText('labelSync.enable')).toBeDefined();
    });
  });

  it('calls loadStatus on mount', async () => {
    render(<LabelSyncSettingsConnected />);
    await waitFor(() => {
      expect(mockGithub.getLabelSyncStatus).toHaveBeenCalledWith('proj-1');
    });
  });

  it('shows enabled state when sync is on', async () => {
    mockGithub.getLabelSyncStatus.mockResolvedValue({ enabled: true, lastSyncedAt: '2026-01-01' });
    render(<LabelSyncSettingsConnected />);
    await waitFor(() => {
      expect(screen.getByText('labelSync.disable')).toBeDefined();
    });
  });
});
