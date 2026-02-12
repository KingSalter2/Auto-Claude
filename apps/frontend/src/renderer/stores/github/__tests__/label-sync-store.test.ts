import { describe, it, expect, beforeEach } from 'vitest';
import { useLabelSyncStore } from '../label-sync-store';

describe('useLabelSyncStore', () => {
  beforeEach(() => {
    useLabelSyncStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useLabelSyncStore.getState();
    expect(state.config.enabled).toBe(false);
    expect(state.config.lastSyncedAt).toBeNull();
    expect(state.isLoaded).toBe(false);
    expect(state.isSyncing).toBe(false);
    expect(state.error).toBeNull();
    expect(state.lastResult).toBeNull();
  });

  it('setConfig updates config and marks loaded', () => {
    useLabelSyncStore.getState().setConfig({
      enabled: true,
      lastSyncedAt: '2026-01-01T00:00:00Z',
    });

    const state = useLabelSyncStore.getState();
    expect(state.config.enabled).toBe(true);
    expect(state.config.lastSyncedAt).toBe('2026-01-01T00:00:00Z');
    expect(state.isLoaded).toBe(true);
    expect(state.error).toBeNull();
  });

  it('setSyncing updates syncing state', () => {
    useLabelSyncStore.getState().setSyncing(true);
    expect(useLabelSyncStore.getState().isSyncing).toBe(true);

    useLabelSyncStore.getState().setSyncing(false);
    expect(useLabelSyncStore.getState().isSyncing).toBe(false);
  });

  it('setError updates error and clears syncing', () => {
    useLabelSyncStore.getState().setSyncing(true);
    useLabelSyncStore.getState().setError('Rate limited');

    const state = useLabelSyncStore.getState();
    expect(state.error).toBe('Rate limited');
    expect(state.isSyncing).toBe(false);
  });

  it('setLastResult stores sync result', () => {
    const result = { created: 7, updated: 0, removed: 0, errors: [] };
    useLabelSyncStore.getState().setLastResult(result);

    expect(useLabelSyncStore.getState().lastResult).toEqual(result);
  });

  it('reset returns to initial state', () => {
    useLabelSyncStore.getState().setConfig({ enabled: true, lastSyncedAt: 'now' });
    useLabelSyncStore.getState().setSyncing(true);
    useLabelSyncStore.getState().setError('fail');

    useLabelSyncStore.getState().reset();

    const state = useLabelSyncStore.getState();
    expect(state.config.enabled).toBe(false);
    expect(state.isLoaded).toBe(false);
    expect(state.isSyncing).toBe(false);
    expect(state.error).toBeNull();
  });
});
