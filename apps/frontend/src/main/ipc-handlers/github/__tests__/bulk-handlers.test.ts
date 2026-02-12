import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock child_process
const mockExecFileSync = vi.fn();
vi.mock('child_process', () => ({
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
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
  webContents: { send: mockSend },
}) as unknown as import('electron').BrowserWindow;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockExecFileSync.mockReturnValue(Buffer.from(''));

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
    mockExecFileSync
      .mockReturnValueOnce(Buffer.from(''))
      .mockImplementationOnce(() => { throw new Error('rate limited'); })
      .mockReturnValueOnce(Buffer.from(''));

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
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('all items fail returns 0 success, N failed', async () => {
    mockExecFileSync.mockImplementation(() => {
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
