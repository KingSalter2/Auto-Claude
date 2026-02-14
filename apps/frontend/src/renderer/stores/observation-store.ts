import { create } from 'zustand';
import type { Observation, ObservationStats, ObservationCategory } from '../../shared/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Observation API methods added by subtask-6-5
const api = () => window.electronAPI as any;

interface ObservationState {
  // Data
  observations: Observation[];
  observationStats: ObservationStats | null;
  observationLoading: boolean;
  observationSearchResults: Observation[];
  observationSearchLoading: boolean;

  // Actions
  setObservations: (observations: Observation[]) => void;
  setObservationStats: (stats: ObservationStats | null) => void;
  setObservationLoading: (loading: boolean) => void;
  setObservationSearchResults: (results: Observation[]) => void;
  setObservationSearchLoading: (loading: boolean) => void;
  clearAll: () => void;
}

export const useObservationStore = create<ObservationState>((set) => ({
  // Initial state
  observations: [],
  observationStats: null,
  observationLoading: false,
  observationSearchResults: [],
  observationSearchLoading: false,

  // Actions
  setObservations: (observations) => set({ observations }),
  setObservationStats: (stats) => set({ observationStats: stats }),
  setObservationLoading: (loading) => set({ observationLoading: loading }),
  setObservationSearchResults: (results) => set({ observationSearchResults: results }),
  setObservationSearchLoading: (loading) => set({ observationSearchLoading: loading }),
  clearAll: () =>
    set({
      observations: [],
      observationStats: null,
      observationLoading: false,
      observationSearchResults: [],
      observationSearchLoading: false
    })
}));

/**
 * Load observations for a project, optionally filtered by spec
 */
export async function loadObservations(
  projectHash: string,
  specId?: string
): Promise<void> {
  const store = useObservationStore.getState();
  store.setObservationLoading(true);

  try {
    const result = await api().observationList(projectHash, specId);
    if (result.success && result.data) {
      store.setObservations(result.data);
    } else {
      store.setObservations([]);
    }
  } catch (_error) {
    store.setObservations([]);
  } finally {
    store.setObservationLoading(false);
  }
}

/**
 * Search observations by query with optional filters
 */
export async function searchObservations(
  projectHash: string,
  query: string,
  category?: ObservationCategory,
  scope?: string
): Promise<void> {
  const store = useObservationStore.getState();

  if (!query.trim()) {
    store.setObservationSearchResults([]);
    return;
  }

  store.setObservationSearchLoading(true);

  try {
    const result = await api().observationSearch(projectHash, query, category, scope);
    if (result.success && result.data) {
      store.setObservationSearchResults(result.data);
    } else {
      store.setObservationSearchResults([]);
    }
  } catch (_error) {
    store.setObservationSearchResults([]);
  } finally {
    store.setObservationSearchLoading(false);
  }
}

/**
 * Pin or unpin an observation
 */
export async function pinObservation(
  projectHash: string,
  id: string,
  pinned: boolean
): Promise<void> {
  try {
    const result = await api().observationPin(projectHash, id, pinned);
    if (result.success) {
      const store = useObservationStore.getState();
      store.setObservations(
        store.observations.map((obs) =>
          obs.id === id ? { ...obs, pin: pinned } : obs
        )
      );
    }
  } catch (_error) {
    // Silently fail
  }
}

/**
 * Edit an observation's fields
 */
export async function editObservation(
  projectHash: string,
  id: string,
  fields: Partial<Observation>
): Promise<void> {
  try {
    const result = await api().observationEdit(projectHash, id, fields);
    if (result.success) {
      const store = useObservationStore.getState();
      store.setObservations(
        store.observations.map((obs) =>
          obs.id === id ? { ...obs, ...fields } : obs
        )
      );
    }
  } catch (_error) {
    // Silently fail
  }
}

/**
 * Delete an observation
 */
export async function deleteObservation(
  projectHash: string,
  id: string
): Promise<void> {
  try {
    const result = await api().observationDelete(projectHash, id);
    if (result.success) {
      const store = useObservationStore.getState();
      store.setObservations(
        store.observations.filter((obs) => obs.id !== id)
      );
    }
  } catch (_error) {
    // Silently fail
  }
}

/**
 * Promote an observation to a task/issue
 */
export async function promoteObservation(
  projectHash: string,
  id: string
): Promise<void> {
  try {
    await api().observationPromote(projectHash, id);
  } catch (_error) {
    // Silently fail
  }
}

/**
 * Load observation statistics for a project
 */
export async function loadObservationStats(
  projectHash: string
): Promise<void> {
  const store = useObservationStore.getState();

  try {
    const result = await api().observationGetStats(projectHash);
    if (result.success && result.data) {
      store.setObservationStats(result.data);
    } else {
      store.setObservationStats(null);
    }
  } catch (_error) {
    store.setObservationStats(null);
  }
}
