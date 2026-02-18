/**
 * Tests for Sentry utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { IpcMainInvokeEvent } from 'electron';

const mockCaptureException = vi.fn();

vi.mock('@sentry/electron/main', () => ({
  init: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: mockCaptureException,
}));

vi.mock('electron', () => ({
  app: { isPackaged: false, getVersion: () => '0.0.0-test' },
  ipcMain: { on: vi.fn(), handle: vi.fn() },
  crashReporter: { start: vi.fn() },
}));

vi.mock('../settings-utils', () => ({
  readSettingsFile: () => ({}),
}));

vi.mock('../../shared/constants', () => ({
  DEFAULT_APP_SETTINGS: { sentryEnabled: true },
}));

vi.mock('../../shared/constants/ipc', () => ({
  IPC_CHANNELS: {
    SENTRY_STATE_CHANGED: 'sentry-state-changed',
    GET_SENTRY_DSN: 'get-sentry-dsn',
    GET_SENTRY_CONFIG: 'get-sentry-config',
  },
}));

vi.mock('../../shared/utils/sentry-privacy', () => ({
  processEvent: vi.fn((e) => e),
  PRODUCTION_TRACE_SAMPLE_RATE: 0.1,
}));

describe('withSentryIpc', () => {
  let withSentryIpc: typeof import('../sentry').withSentryIpc;
  const fakeEvent = {} as IpcMainInvokeEvent;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('../sentry');
    withSentryIpc = mod.withSentryIpc;
  });

  it('passes through successful handler result', async () => {
    const handler = vi.fn().mockResolvedValue('ok');
    const wrapped = withSentryIpc('test-channel', handler);
    const result = await wrapped(fakeEvent, 'arg1');
    expect(result).toBe('ok');
    expect(handler).toHaveBeenCalledWith(fakeEvent, 'arg1');
  });

  it('re-throws and captures exception on handler error', async () => {
    const err = new Error('boom');
    const handler = vi.fn().mockRejectedValue(err);
    const wrapped = withSentryIpc('test-channel', handler);
    await expect(wrapped(fakeEvent)).rejects.toThrow('boom');
    expect(mockCaptureException).toHaveBeenCalledWith(
      err,
      { tags: { ipc_channel: 'test-channel' } }
    );
  });

  it('tags error with the correct ipc_channel', async () => {
    const handler = vi.fn().mockRejectedValue(new Error('fail'));
    const wrapped = withSentryIpc('my-custom-channel', handler);
    await expect(wrapped(fakeEvent)).rejects.toThrow('fail');
    expect(mockCaptureException).toHaveBeenCalledWith(
      expect.any(Error),
      { tags: { ipc_channel: 'my-custom-channel' } }
    );
  });
});
