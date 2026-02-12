import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

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

// Mock constants
vi.mock('../../../../shared/constants', () => ({
  IPC_CHANNELS: {
    GITHUB_ISSUE_CREATE: 'github:issue:create',
  },
}));

// Mock fs
vi.mock('fs', () => ({
  default: {
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock os
vi.mock('os', () => ({
  default: { tmpdir: () => '/tmp' },
  tmpdir: () => '/tmp',
}));

// Mock path
vi.mock('path', () => ({
  default: { join: (...args: string[]) => args.join('/') },
  join: (...args: string[]) => args.join('/'),
}));

import { ipcMain } from 'electron';
import { registerIssueCreateHandler } from '../issue-create-handler';

// Collect registered handlers
type HandleHandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandleHandlerFn> = {};

beforeEach(() => {
  vi.clearAllMocks();

  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation(
    (channel: string, handler: HandleHandlerFn) => {
      handlers[channel] = handler;
    },
  );

  registerIssueCreateHandler(() => null);
});

const call = (projectId: string, params: { title: string; body: string; labels?: string[]; assignees?: string[] }) =>
  handlers['github:issue:create']({}, projectId, params);

describe('createIssue handler', () => {
  it('creates issue with title and body via temp file', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('https://github.com/owner/repo/issues/42\n'));

    const result = await call('test-project', {
      title: 'New Bug',
      body: 'Bug description',
    }) as { number: number; url: string };

    expect(result.number).toBe(42);
    expect(result.url).toContain('/issues/42');
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it('creates issue with labels', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('https://github.com/owner/repo/issues/10\n'));

    await call('test-project', {
      title: 'Feature',
      body: 'Feature description',
      labels: ['enhancement', 'priority:high'],
    });

    const ghArgs = mockExecFileSync.mock.calls[0][1] as string[];
    expect(ghArgs).toContain('--label');
    expect(ghArgs).toContain('enhancement,priority:high');
  });

  it('creates issue with assignees', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('https://github.com/owner/repo/issues/11\n'));

    await call('test-project', {
      title: 'Task',
      body: 'Task body',
      assignees: ['user1', 'user2'],
    });

    const ghArgs = mockExecFileSync.mock.calls[0][1] as string[];
    expect(ghArgs).toContain('--assignee');
    expect(ghArgs).toContain('user1,user2');
  });

  it('returns issue number and URL from gh CLI output', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('https://github.com/myorg/myrepo/issues/99\n'));

    const result = await call('test-project', {
      title: 'Test',
      body: 'Body',
    }) as { number: number; url: string };

    expect(result.number).toBe(99);
    expect(result.url).toBe('https://github.com/myorg/myrepo/issues/99');
  });

  it('validates title — rejects empty', async () => {
    await expect(call('test-project', {
      title: '',
      body: 'Body',
    })).rejects.toThrow('Title is required');
  });

  it('validates title — rejects too long', async () => {
    await expect(call('test-project', {
      title: 'A'.repeat(257),
      body: 'Body',
    })).rejects.toThrow('Title too long');
  });

  it('handles gh CLI error', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('gh: authentication required');
    });

    await expect(call('test-project', {
      title: 'Test',
      body: 'Body',
    })).rejects.toThrow();
  });

  it('cleans up temp file on success', async () => {
    mockExecFileSync.mockReturnValue(Buffer.from('https://github.com/o/r/issues/1\n'));

    await call('test-project', { title: 'Test', body: 'Body' });

    expect(fs.unlinkSync).toHaveBeenCalled();
  });

  it('cleans up temp file on failure', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('Failed');
    });

    try {
      await call('test-project', { title: 'Test', body: 'Body' });
    } catch {
      // Expected
    }

    expect(fs.unlinkSync).toHaveBeenCalled();
  });
});
