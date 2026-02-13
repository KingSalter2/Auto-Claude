import { useCallback, useEffect, useRef } from 'react';
import { useProjectStore } from '../../../stores/project-store';
import { useLabelSyncStore } from '../../../stores/github/label-sync-store';
import { SYNC_DEBOUNCE_MS } from '../../../../shared/constants/label-sync';
import type { LabelSyncConfig } from '../../../../shared/types/label-sync';

export function useLabelSync() {
  const projectId = useProjectStore((s) => s.activeProjectId);
  const store = useLabelSyncStore();

  const loadStatus = useCallback(async () => {
    if (!projectId) return;
    try {
      const config = await window.electronAPI.github.getLabelSyncStatus(projectId);
      store.setConfig(config);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to load label sync status');
    }
  }, [projectId, store]);

  const enableSync = useCallback(async () => {
    if (!projectId) return;
    store.setSyncing(true);
    try {
      const result = await window.electronAPI.github.enableLabelSync(projectId);
      store.setLastResult(result);
      store.setConfig({ enabled: true, lastSyncedAt: new Date().toISOString() });
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to enable label sync');
    } finally {
      store.setSyncing(false);
    }
  }, [projectId, store]);

  const disableSync = useCallback(async (cleanup: boolean) => {
    if (!projectId) return;
    store.setSyncing(true);
    try {
      await window.electronAPI.github.disableLabelSync(projectId, cleanup);
      store.setConfig({ enabled: false, lastSyncedAt: null });
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to disable label sync');
    } finally {
      store.setSyncing(false);
    }
  }, [projectId, store]);

  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clean up debounce timer on unmount
  useEffect(() => {
    return () => {
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  const syncIssueLabel = useCallback((
    issueNumber: number,
    newState: string,
    oldState: string | null,
  ) => {
    if (!projectId || !store.config.enabled) return;

    if (syncTimerRef.current) {
      clearTimeout(syncTimerRef.current);
    }

    syncTimerRef.current = setTimeout(async () => {
      try {
        await window.electronAPI.github.syncIssueLabel(projectId, issueNumber, newState, oldState);
      } catch {
        // Non-blocking — label sync failures shouldn't disrupt workflow
      }
    }, SYNC_DEBOUNCE_MS);
  }, [projectId, store.config.enabled]);

  const bulkLabelSync = useCallback(async (issueNumbers: number[]) => {
    if (!projectId || !store.config.enabled) return { synced: 0, errors: 0 };
    store.setSyncing(true);
    try {
      const result = await window.electronAPI.github.bulkLabelSync(projectId, issueNumbers);
      return result;
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Bulk sync failed');
      return { synced: 0, errors: 0 };
    } finally {
      store.setSyncing(false);
    }
  }, [projectId, store]);

  const saveConfig = useCallback(async (config: LabelSyncConfig) => {
    if (!projectId) return;
    try {
      await window.electronAPI.github.saveLabelSyncConfig(projectId, config);
      store.setConfig(config);
    } catch (error) {
      store.setError(error instanceof Error ? error.message : 'Failed to save config');
    }
  }, [projectId, store]);

  return {
    config: store.config,
    isLoaded: store.isLoaded,
    isSyncing: store.isSyncing,
    error: store.error,
    lastResult: store.lastResult,
    loadStatus,
    enableSync,
    disableSync,
    syncIssueLabel,
    bulkLabelSync,
    saveConfig,
  };
}
