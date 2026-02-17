import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process - execFile is used async via promisify
import { promisify } from 'util';
const mockExecFile = vi.fn();
vi.mock('child_process', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>;
  // Create execFile mock that supports both callback and promisify patterns
  const execFileMock = (...args: unknown[]) => {
    const cb = args[args.length - 1];
    try {
      const result = mockExecFile(...args.slice(0, typeof cb === 'function' ? -1 : undefined) as []);
      if (typeof cb === 'function') {
        (cb as (err: null, stdout: string, stderr: string) => void)(null, String(result ?? ''), '');
      }
    } catch (err) {
      if (typeof cb === 'function') {
        (cb as (err: Error) => void)(err as Error);
      }
    }
  };
  // Add custom promisify so promisify(execFile) returns { stdout, stderr }
  (execFileMock as unknown as Record<string | symbol, unknown>)[promisify.custom] = (...args: unknown[]) => {
    try {
      const result = mockExecFile(...args as []);
      return Promise.resolve({ stdout: String(result ?? ''), stderr: '' });
    } catch (err) {
      return Promise.reject(err);
    }
  };
  return {
    ...actual,
    execFile: execFileMock,
  };
});

// Mock cli-tool-manager
vi.mock('../../../cli-tool-manager', () => ({
  getToolPath: vi.fn((tool: string) => `/usr/bin/${tool}`),
}));

// Mock electron
const mockSend = vi.fn();
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
  getAugmentedEnv: vi.fn(() => ({ PATH: '/usr/bin' })),
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  createContextLogger: () => ({ debug: vi.fn() }),
}));

import { ipcMain } from 'electron';
import { registerBulkHandlers } from '../bulk-handlers';
import type { BulkExecuteParams, BulkOperationResult } from '../../../../shared/types/mutations';

type HandlerFn = (event: unknown, ...args: unknown[]) => Promise<unknown>;
const handlers: Record<string, HandlerFn> = {};

const mockGetMainWindow = () => ({
  isDestroyed: () => false,
  webContents: { send: mockSend },
}) as unknown as import('electron').BrowserWindow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockExecFile.mockReturnValue('');

  (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation(
    (channel: string, handler: HandlerFn) => {
      handlers[channel] = handler;
    },
  );

  registerBulkHandlers(mockGetMainWindow);
});

describe('bulk execute handler', () => {
  const execute = async (params: BulkExecuteParams) => {
    const promise = handlers['github:bulk:execute']({}, params);
    // Flush all timers for inter-item delays
    await vi.runAllTimersAsync();
    return promise as Promise<BulkOperationResult>;
  };

  it('executes close on 3 issues, all succeed', async () => {
    const result = await execute({
      projectId: 'test-project',
      action: 'close',
      issueNumbers: [1, 2, 3],
    });

    expect(result.totalItems).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
    expect(result.results).toHaveLength(3);
    expect(result.results.every((r) => r.status === 'success')).toBe(true);
  });

  it('continues when 2nd item fails, reports partial result', async () => {
    mockExecFile
      .mockReturnValueOnce('')
      .mockImplementationOnce(() => { throw new Error('rate limited'); })
      .mockReturnValueOnce('');

    const result = await execute({
      projectId: 'test-project',
      action: 'close',
      issueNumbers: [1, 2, 3],
    });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.results[1]).toEqual(
      expect.objectContaining({ issueNumber: 2, status: 'failed' }),
    );
  });

  it('sends progress events for each item', async () => {
    await execute({
      projectId: 'test-project',
      action: 'close',
      issueNumbers: [1, 2],
    });

    const progressCalls = mockSend.mock.calls.filter(
      (c) => c[0] === 'github:bulk:progress',
    );
    expect(progressCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('sends completion event at end', async () => {
    await execute({
      projectId: 'test-project',
      action: 'close',
      issueNumbers: [1],
    });

    const completeCalls = mockSend.mock.calls.filter(
      (c) => c[0] === 'github:bulk:complete',
    );
    expect(completeCalls).toHaveLength(1);
  });

  it('returns empty result for empty issue list', async () => {
    const result = await execute({
      projectId: 'test-project',
      action: 'close',
      issueNumbers: [],
    });

    expect(result.totalItems).toBe(0);
    expect(result.results).toHaveLength(0);
    expect(mockExecFile).not.toHaveBeenCalled();
  });

  it('all items fail returns 0 success, N failed', async () => {
    mockExecFile.mockImplementation(() => {
      throw new Error('all fail');
    });

    const result = await execute({
      projectId: 'test-project',
      action: 'close',
      issueNumbers: [1, 2, 3],
    });

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(3);
  });
});
