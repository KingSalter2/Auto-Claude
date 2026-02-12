/**
 * Connected wrapper for LabelSyncSettings that calls useLabelSync hook.
 * Used in SectionRouter where hooks can't be called conditionally.
 */

import { useEffect, useRef } from 'react';
import { LabelSyncSettings } from './LabelSyncSettings';
import { useLabelSync } from '../hooks/useLabelSync';

export function LabelSyncSettingsConnected() {
  const { config, isSyncing, error, loadStatus, enableSync, disableSync } = useLabelSync();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      loadStatus();
    }
  }, [loadStatus]);

  return (
    <LabelSyncSettings
      enabled={config.enabled}
      isSyncing={isSyncing}
      lastSyncedAt={config.lastSyncedAt}
      error={error}
      onEnable={enableSync}
      onDisable={disableSync}
    />
  );
}
