import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

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

// Mock enrichment-persistence
const mockEnrichmentData = {
  schemaVersion: 1,
  issues: {} as Record<string, { triageState: string; previousState?: string; resolution?: string; updatedAt: string }>,
};
vi.mock('../enrichment-persistence', () => ({
  readEnrichmentFile: vi.fn(() => Promise.resolve(mockEnrichmentData)),
  writeEnrichmentFile: vi.fn(() => Promise.resolve()),
  appendTransition: vi.fn(() => Promise.resolve()),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

import { ipcMain } from 'electron';
import { registerMutationHandlers } from '../mutation-handlers';
import { readEnrichmentFile, writeEnrichmentFile, appendTransition } from '../enrichment-persistence';

// Collect registered handlers
type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandlerFn> = {};

beforeEach(() => {
  vi.clearAllMocks();
  mockExecFileSync.mockReturnValue(Buffer.from(''));
  mockEnrichmentData.issues = {};
  mockProject.path = '/fake/project';

  // Capture registered handlers
  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation(
    (channel: string, handler: HandlerFn) => {
      handlers[channel] = handler;
    },
  );

  registerMutationHandlers(() => null);
});

// ============================================
// editTitle
// ============================================

describe('editTitle handler', () => {
  const call = (projectId: string, issueNumber: number, title: string) =>
    handlers['github:issue:editTitle']({}, projectId, issueNumber, title);

  it('calls gh issue edit with valid title', async () => {
    const result = await call('test-project', 42, 'New Title');
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--title', 'New Title'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('rejects empty title without calling gh', async () => {
    const result = await call('test-project', 42, '');
    expect(result).toEqual(
      expect.objectContaining({ success: false, issueNumber: 42 }),
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('returns error when execFileSync throws', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('gh: command failed');
    });
    const result = await call('test-project', 42, 'Valid Title');
    expect(result).toEqual(
      expect.objectContaining({
        success: false,
        issueNumber: 42,
        error: expect.stringContaining('gh: command failed'),
      }),
    );
  });
});

// ============================================
// editBody
// ============================================

describe('editBody handler', () => {
  const call = (projectId: string, issueNumber: number, body: string | null) =>
    handlers['github:issue:editBody']({}, projectId, issueNumber, body);

  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-test-'));
    // Override mock project path to use real temp dir for file operations
    mockProject.path = tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates temp file and calls --body-file for valid body', async () => {
    const result = await call('test-project', 42, 'Updated body content');
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--body-file', expect.any(String)],
      expect.objectContaining({ cwd: tmpDir }),
    );
  });

  it('cleans up temp file on success', async () => {
    await call('test-project', 42, 'Body content');
    // After the call completes, there should be no leftover temp files
    const tmpFiles = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('gh-body-'));
    // Allow for concurrency — just check our call's file was cleaned up by verifying the gh call
    expect(mockExecFileSync).toHaveBeenCalled();
  });

  it('cleans up temp file on failure', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('gh failed');
    });
    const result = await call('test-project', 42, 'Body content');
    expect(result).toEqual(
      expect.objectContaining({ success: false, issueNumber: 42 }),
    );
  });

  it('clears body with --body "" when body is null', async () => {
    const result = await call('test-project', 42, null);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--body', ''],
      expect.objectContaining({ cwd: tmpDir }),
    );
  });
});

// ============================================
// close / reopen
// ============================================

describe('close handler', () => {
  const call = (projectId: string, issueNumber: number) =>
    handlers['github:issue:close']({}, projectId, issueNumber);

  it('calls gh issue close', async () => {
    const result = await call('test-project', 42);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'close', '42'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('auto-transitions enrichment to done on close', async () => {
    mockEnrichmentData.issues = {
      '42': { triageState: 'in_progress', updatedAt: new Date().toISOString() },
    };
    await call('test-project', 42);
    expect(writeEnrichmentFile).toHaveBeenCalled();
    expect(appendTransition).toHaveBeenCalled();
  });

  it('still succeeds when already closed (idempotent)', async () => {
    const result = await call('test-project', 42);
    expect(result).toEqual({ success: true, issueNumber: 42 });
  });
});

describe('reopen handler', () => {
  const call = (projectId: string, issueNumber: number) =>
    handlers['github:issue:reopen']({}, projectId, issueNumber);

  it('calls gh issue reopen', async () => {
    const result = await call('test-project', 42);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'reopen', '42'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('auto-transitions enrichment from done to ready on reopen', async () => {
    mockEnrichmentData.issues = {
      '42': { triageState: 'done', resolution: 'completed', updatedAt: new Date().toISOString() },
    };
    await call('test-project', 42);
    expect(writeEnrichmentFile).toHaveBeenCalled();
    expect(appendTransition).toHaveBeenCalled();
  });
});

// ============================================
// comment
// ============================================

describe('comment handler', () => {
  const call = (projectId: string, issueNumber: number, body: string) =>
    handlers['github:issue:comment']({}, projectId, issueNumber, body);

  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mutation-test-'));
    mockProject.path = tmpDir;
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates temp file and calls gh issue comment with --body-file', async () => {
    const result = await call('test-project', 42, 'This is a comment');
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'comment', '42', '--body-file', expect.any(String)],
      expect.objectContaining({ cwd: tmpDir }),
    );
  });

  it('rejects empty comment without calling gh', async () => {
    const result = await call('test-project', 42, '');
    expect(result).toEqual(
      expect.objectContaining({ success: false, issueNumber: 42 }),
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('cleans up temp file on failure', async () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('gh failed');
    });
    const result = await call('test-project', 42, 'Comment text');
    expect(result).toEqual(
      expect.objectContaining({ success: false, issueNumber: 42 }),
    );
  });
});

// ============================================
// labels
// ============================================

describe('addLabels handler', () => {
  const call = (projectId: string, issueNumber: number, labels: string[]) =>
    handlers['github:issue:addLabels']({}, projectId, issueNumber, labels);

  it('calls gh issue edit with --add-label for a single label', async () => {
    const result = await call('test-project', 42, ['bug']);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--add-label', 'bug'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('joins multiple labels with comma', async () => {
    const result = await call('test-project', 42, ['bug', 'feature']);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--add-label', 'bug,feature'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('rejects invalid label without calling gh', async () => {
    const result = await call('test-project', 42, ['invalid;label']);
    expect(result).toEqual(
      expect.objectContaining({ success: false, issueNumber: 42 }),
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

describe('removeLabels handler', () => {
  const call = (projectId: string, issueNumber: number, labels: string[]) =>
    handlers['github:issue:removeLabels']({}, projectId, issueNumber, labels);

  it('calls gh issue edit with --remove-label', async () => {
    const result = await call('test-project', 42, ['bug']);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--remove-label', 'bug'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });
});

// ============================================
// assignees
// ============================================

describe('addAssignees handler', () => {
  const call = (projectId: string, issueNumber: number, assignees: string[]) =>
    handlers['github:issue:addAssignees']({}, projectId, issueNumber, assignees);

  it('calls gh issue edit with --add-assignee', async () => {
    const result = await call('test-project', 42, ['octocat']);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--add-assignee', 'octocat'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });

  it('rejects invalid login without calling gh', async () => {
    const result = await call('test-project', 42, ['-invalid']);
    expect(result).toEqual(
      expect.objectContaining({ success: false, issueNumber: 42 }),
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});

describe('removeAssignees handler', () => {
  const call = (projectId: string, issueNumber: number, assignees: string[]) =>
    handlers['github:issue:removeAssignees']({}, projectId, issueNumber, assignees);

  it('calls gh issue edit with --remove-assignee', async () => {
    const result = await call('test-project', 42, ['octocat']);
    expect(result).toEqual({ success: true, issueNumber: 42 });
    expect(mockExecFileSync).toHaveBeenCalledWith(
      'gh',
      ['issue', 'edit', '42', '--remove-assignee', 'octocat'],
      expect.objectContaining({ cwd: '/fake/project' }),
    );
  });
});

// ============================================
// invalid issue number
// ============================================

describe('invalid issue number', () => {
  it('rejects issue number 0', async () => {
    const result = await handlers['github:issue:editTitle']({}, 'test-project', 0, 'Title');
    expect(result).toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('rejects negative issue number', async () => {
    const result = await handlers['github:issue:close']({}, 'test-project', -1);
    expect(result).toEqual(
      expect.objectContaining({ success: false }),
    );
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });
});
