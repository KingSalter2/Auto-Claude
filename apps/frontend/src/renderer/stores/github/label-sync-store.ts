import { create } from 'zustand';
import type { LabelSyncConfig, LabelSyncResult } from '../../../shared/types/label-sync';
import { createDefaultLabelSyncConfig } from '../../../shared/types/label-sync';

interface LabelSyncState {
  // Data
  config: LabelSyncConfig;
  isLoaded: boolean;

  // UI State
  isSyncing: boolean;
  error: string | null;
  lastResult: LabelSyncResult | null;

  // Actions
  setConfig: (config: LabelSyncConfig) => void;
  setSyncing: (syncing: boolean) => void;
  setError: (error: string | null) => void;
  setLastResult: (result: LabelSyncResult | null) => void;
  reset: () => void;
}

export const useLabelSyncStore = create<LabelSyncState>((set) => ({
  // Initial state
  config: createDefaultLabelSyncConfig(),
  isLoaded: false,
  isSyncing: false,
  error: null,
  lastResult: null,

  // Actions
  setConfig: (config) => set({ config, isLoaded: true, error: null }),
  setSyncing: (isSyncing) => set({ isSyncing }),
  setError: (error) => set({ error, isSyncing: false }),
  setLastResult: (lastResult) => set({ lastResult }),
  reset: () => set({
    config: createDefaultLabelSyncConfig(),
    isLoaded: false,
    isSyncing: false,
    error: null,
    lastResult: null,
  }),
}));
