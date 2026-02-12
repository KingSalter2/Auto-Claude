/**
 * Connected wrapper for ProgressiveTrustSettings that loads config via IPC.
 * Used in SectionRouter where hooks can't be called conditionally.
 */

import { useState, useEffect, useCallback } from 'react';
import { ProgressiveTrustSettings } from './ProgressiveTrustSettings';
import { useProjectStore } from '../../../stores/project-store';
import { createDefaultProgressiveTrust } from '../../../../shared/types/ai-triage';
import type { ProgressiveTrustConfig } from '../../../../shared/types/ai-triage';

export function ProgressiveTrustSettingsConnected() {
  const projectId = useProjectStore((s) => s.activeProject?.id ?? null);
  const [config, setConfig] = useState<ProgressiveTrustConfig>(createDefaultProgressiveTrust);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    window.electronAPI.github
      .getProgressiveTrust(projectId)
      .then((c) => {
        setConfig(c);
        setVisible(true);
      })
      .catch(() => {
        setVisible(true);
      });
  }, [projectId]);

  const handleSave = useCallback(
    async (updated: ProgressiveTrustConfig) => {
      if (!projectId) return;
      await window.electronAPI.github.saveProgressiveTrust(projectId, updated);
      setConfig(updated);
    },
    [projectId],
  );

  const handleCancel = useCallback(() => {
    // Reset to last saved config by re-fetching
    if (!projectId) return;
    window.electronAPI.github
      .getProgressiveTrust(projectId)
      .then(setConfig)
      .catch(() => { /* config not available yet — use defaults */ });
  }, [projectId]);

  if (!visible) return null;

  return (
    <ProgressiveTrustSettings
      config={config}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  );
}
