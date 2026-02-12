import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
const mockExecFileSync = vi.fn();
vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

// Mock electron
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
  },
}));

// Mock project-middleware
const mockProject = { id: 'test-project', path: '/fake/project', name: 'Test' };
vi.mock('../utils/project-middleware', () => ({
  withProject: vi.fn((_id: string, handler: (p: typeof mockProject) => Promise<unknown>) =>
    handler(mockProject),
  ),
  withProjectOrNull: vi.fn((_id: string | null, handler: (p: typeof mockProject) => Promise<unknown>) =>
    handler(mockProject),
  ),
}));

// Mock env-utils
vi.mock('../../../env-utils', () => ({
  getAugmentedEnv: vi.fn(() => ({ PATH: '/usr/bin', GH_TOKEN: 'test-token' })),
}));

// Mock enrichment-persistence
const mockEnrichmentData = {
  schemaVersion: 1,
  issues: {} as Record<string, { triageState: string }>,
};
vi.mock('../enrichment-persistence', () => ({
  readEnrichmentFile: vi.fn(() => Promise.resolve(mockEnrichmentData)),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

// Mock settings-utils
vi.mock('../../../settings-utils', () => ({
  readSettingsFile: vi.fn(() => ({})),
}));

// Mock atomic-file
vi.mock('../../../atomic-file', () => ({
  atomicWriteJSON: vi.fn(() => Promise.resolve()),
  atomicReadJSON: vi.fn(() => Promise.resolve(null)),
}));

// Mock fs and path
vi.mock('node:fs', () => {
  const mock = {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
  };
  return { default: mock, ...mock };
});
vi.mock('fs', () => {
  const mock = {
    existsSync: vi.fn(() => false),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(() => '{}'),
    writeFileSync: vi.fn(),
  };
  return { default: mock, ...mock };
});

vi.mock('node:path', () => {
  const join = (...args: string[]) => args.join('/');
  return { default: { join }, join };
});
vi.mock('path', () => {
  const join = (...args: string[]) => args.join('/');
  return { default: { join }, join };
});

import { ipcMain } from 'electron';
import { registerLabelSyncHandlers } from '../label-sync-handlers';

// Collect registered handlers
type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandlerFn> = {};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecFileSync.mockReturnValue(Buffer.from(''));
  mockEnrichmentData.issues = {};

  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation((channel: string, handler: HandlerFn) => {
    handlers[channel] = handler;
  });

  registerLabelSyncHandlers(() => null as never);
});

describe('enableLabelSync handler', () => {
  it('creates all 7 workflow labels via execFileSync', async () => {
    await handlers['github:label-sync:enable']({}, 'test-project');

    // 7 label create calls
    const labelCalls = mockExecFileSync.mock.calls.filter(
      (call: unknown[]) => Array.isArray(call[1]) && (call[1] as string[]).includes('label') && (call[1] as string[]).includes('create'),
    );
    expect(labelCalls).toHaveLength(7);
  });

  it('uses --force flag to update existing labels', async () => {
    await handlers['github:label-sync:enable']({}, 'test-project');

    const firstCall = mockExecFileSync.mock.calls[0];
    expect((firstCall[1] as string[]).includes('--force')).toBe(true);
  });

  it('returns result with created count', async () => {
    const result = await handlers['github:label-sync:enable']({}, 'test-project');
    expect(result).toHaveProperty('created');
  });

  it('handles partial label creation failure', async () => {
    let callCount = 0;
    mockExecFileSync.mockImplementation(() => {
      callCount++;
      if (callCount === 3) throw new Error('API rate limited');
      return Buffer.from('');
    });

    const result = await handlers['github:label-sync:enable']({}, 'test-project') as { errors: unknown[] };
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe('syncIssueLabel handler', () => {
  it('removes old label and adds new label', async () => {
    // First call: gh issue view returns current labels with old ac:new label
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([{ name: 'ac:new' }]),
    );

    await handlers['github:label-sync:issue']({}, 'test-project', 42, 'triage', 'new');

    const calls = mockExecFileSync.mock.calls;
    const editCall = calls.find(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as string[]).includes('issue') && (c[1] as string[]).includes('edit'),
    );
    expect(editCall).toBeDefined();
    const args = editCall?.[1] as string[];
    expect(args).toContain('--remove-label');
    expect(args).toContain('--add-label');
  });

  it('skips when correct label already present', async () => {
    // Issue already has the target label
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([{ name: 'ac:triage' }]),
    );

    await handlers['github:label-sync:issue']({}, 'test-project', 42, 'triage', null);

    // Only the view call, no edit call
    const editCalls = mockExecFileSync.mock.calls.filter(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as string[]).includes('edit'),
    );
    expect(editCalls).toHaveLength(0);
  });

  it('handles missing old label gracefully', async () => {
    // No existing ac: labels
    mockExecFileSync.mockReturnValueOnce(
      JSON.stringify([]),
    );

    await handlers['github:label-sync:issue']({}, 'test-project', 42, 'triage', null);

    // Should not throw
    const editCalls = mockExecFileSync.mock.calls.filter(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as string[]).includes('edit'),
    );
    expect(editCalls).toHaveLength(1);
  });
});

describe('disableLabelSync handler', () => {
  it('removes labels from issues and deletes definitions when cleanup true', async () => {
    mockEnrichmentData.issues = {
      '1': { triageState: 'triage' },
      '2': { triageState: 'done' },
    };

    await handlers['github:label-sync:disable']({}, 'test-project', true);

    // Should have edit calls to remove labels + delete calls
    const deleteCalls = mockExecFileSync.mock.calls.filter(
      (c: unknown[]) => Array.isArray(c[1]) && (c[1] as string[]).includes('label') && (c[1] as string[]).includes('delete'),
    );
    expect(deleteCalls.length).toBeGreaterThan(0);
  });

  it('skips cleanup when cleanup false', async () => {
    await handlers['github:label-sync:disable']({}, 'test-project', false);

    // No gh CLI calls for cleanup
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

describe('getLabelSyncStatus handler', () => {
  it('returns default config when no saved config', async () => {
    const result = await handlers['github:label-sync:status']({}, 'test-project') as { enabled: boolean };
    expect(result.enabled).toBe(false);
  });
});

describe('saveLabelSyncConfig handler', () => {
  it('saves config successfully', async () => {
    const config = { enabled: true, lastSyncedAt: '2026-01-01T00:00:00Z' };
    const result = await handlers['github:label-sync:save']({}, 'test-project', config);
    expect(result).toEqual({ success: true });
  });
});
