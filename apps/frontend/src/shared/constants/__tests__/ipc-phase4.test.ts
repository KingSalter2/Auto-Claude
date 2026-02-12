import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../ipc';

describe('Phase 4 IPC channel constants', () => {
  it('defines label sync channels', () => {
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_ENABLE).toBe('github:label-sync:enable');
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_DISABLE).toBe('github:label-sync:disable');
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_ISSUE).toBe('github:label-sync:issue');
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_STATUS).toBe('github:label-sync:status');
    expect(IPC_CHANNELS.GITHUB_LABEL_SYNC_SAVE).toBe('github:label-sync:save');
  });

  it('defines dependency channels', () => {
    expect(IPC_CHANNELS.GITHUB_DEPS_FETCH).toBe('github:deps:fetch');
  });

  it('defines metrics channels', () => {
    expect(IPC_CHANNELS.GITHUB_METRICS_COMPUTE).toBe('github:metrics:compute');
    expect(IPC_CHANNELS.GITHUB_METRICS_STATE_COUNTS).toBe('github:metrics:state-counts');
  });

  it('all Phase 4 channel values are unique', () => {
    const phase4Channels = [
      IPC_CHANNELS.GITHUB_LABEL_SYNC_ENABLE,
      IPC_CHANNELS.GITHUB_LABEL_SYNC_DISABLE,
      IPC_CHANNELS.GITHUB_LABEL_SYNC_ISSUE,
      IPC_CHANNELS.GITHUB_LABEL_SYNC_STATUS,
      IPC_CHANNELS.GITHUB_LABEL_SYNC_SAVE,
      IPC_CHANNELS.GITHUB_DEPS_FETCH,
      IPC_CHANNELS.GITHUB_METRICS_COMPUTE,
      IPC_CHANNELS.GITHUB_METRICS_STATE_COUNTS,
    ];
    const unique = new Set(phase4Channels);
    expect(unique.size).toBe(phase4Channels.length);
  });

  it('Phase 4 channels do not collide with existing channels', () => {
    const allValues = Object.values(IPC_CHANNELS);
    const unique = new Set(allValues);
    expect(unique.size).toBe(allValues.length);
  });
});
