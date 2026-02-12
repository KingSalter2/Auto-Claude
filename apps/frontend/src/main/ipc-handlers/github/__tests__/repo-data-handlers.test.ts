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
  },
}));

// Mock project-middleware
const mockProject = { id: 'test-project', path: '/fake/project', name: 'Test' };
vi.mock('../utils/project-middleware', () => ({
  withProject: vi.fn((_id: string, handler: (p: typeof mockProject) => Promise<unknown>) =>
    handler(mockProject),
  ),
}));

// Mock env-utils
vi.mock('../../../env-utils', () => ({
  getAugmentedEnv: vi.fn(() => ({ PATH: '/usr/bin', GH_TOKEN: 'test-token' })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

import { ipcMain } from 'electron';
import { registerRepoDataHandlers } from '../repo-data-handlers';

type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandlerFn> = {};

beforeEach(() => {
  vi.clearAllMocks();

  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation(
    (channel: string, handler: HandlerFn) => {
      handlers[channel] = handler;
    },
  );

  registerRepoDataHandlers(() => null);
});

// ============================================
// getLabels
// ============================================

describe('getLabels handler', () => {
  const call = (projectId: string) =>
    handlers['github:repo:getLabels']({}, projectId);

  it('parses JSON output from gh label list', async () => {
    mockExecFileSync.mockReturnValue(
      Buffer.from(JSON.stringify([
        { name: 'bug', color: 'd73a4a', description: 'Something is broken' },
        { name: 'feature', color: 'a2eeef', description: 'New feature' },
      ])),
    );

    const result = await call('test-project');
    expect(result).toEqual({
      success: true,
      data: [
        { name: 'bug', color: 'd73a4a', description: 'Something is broken' },
        { name: 'feature', color: 'a2eeef', description: 'New feature' },
      ],
    });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['label', 'list', '--json', 'name,color,description', '--limit', '100'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('returns empty array for empty output', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('[]'));
    const result = await call('test-project');
    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns error when gh CLI fails', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('gh: command not found');
    });
    const result = await call('test-project');
    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('gh: command not found'),
      }),
    );
  });
});

// ============================================
// getCollaborators
// ============================================

describe('getCollaborators handler', () => {
  const call = (projectId: string) =>
    handlers['github:repo:getCollaborators']({}, projectId);

  it('parses newline-separated logins', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('octocat\nuser1\nuser2\n'));
    const result = await call('test-project');
    expect(result).toEqual({
      success: true,
      data: ['octocat', 'user1', 'user2'],
    });
  });

  it('returns empty array for empty output', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from(''));
    const result = await call('test-project');
    expect(result).toEqual({ success: true, data: [] });
  });

  it('returns error on 404 (no permission)', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('HTTP 404: Not Found');
    });
    const result = await call('test-project');
    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.stringContaining('HTTP 404'),
      }),
    );
  });
});
