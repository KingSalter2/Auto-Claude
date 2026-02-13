import { create } from 'zustand';
import type {
  IssueEnrichment,
  WorkflowState,
  Resolution,
  EnrichmentFile,
} from '@shared/types/enrichment';

interface EnrichmentState {
  // Data
  enrichments: Record<string, IssueEnrichment>;
  isLoaded: boolean;

  // UI State
  isLoading: boolean;
  error: string | null;

  // Actions
  setEnrichments: (enrichments: Record<string, IssueEnrichment>) => void;
  setEnrichment: (issueNumber: number, enrichment: IssueEnrichment) => void;
  removeEnrichment: (issueNumber: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearEnrichment: () => void;

  // Selectors
  getEnrichment: (issueNumber: number) => IssueEnrichment | null;
  getEnrichmentsByState: (state: WorkflowState) => IssueEnrichment[];
}

export const useEnrichmentStore = create<EnrichmentState>((set, get) => ({
  // Initial state
  enrichments: {},
  isLoaded: false,
  isLoading: false,
  error: null,

  // Actions
  setEnrichments: (enrichments) => set({ enrichments, isLoaded: true, error: null }),

  setEnrichment: (issueNumber, enrichment) =>
    set((state) => ({
      enrichments: { ...state.enrichments, [String(issueNumber)]: enrichment },
    })),

  removeEnrichment: (issueNumber) =>
    set((state) => {
      const { [String(issueNumber)]: _, ...rest } = state.enrichments;
      return { enrichments: rest };
    }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error, isLoading: false }),

  clearEnrichment: () => set({ enrichments: {}, isLoaded: false, error: null }),

  // Selectors
  getEnrichment: (issueNumber) => {
    return get().enrichments[String(issueNumber)] ?? null;
  },

  getEnrichmentsByState: (state) => {
    return Object.values(get().enrichments).filter(
      (e) => e.triageState === state,
    );
  },

}));

// External async actions

export async function loadEnrichment(projectId: string): Promise<void> {
  const store = useEnrichmentStore.getState();
  store.setLoading(true);
  try {
    const data: EnrichmentFile = await window.electronAPI.github.getAllEnrichment(projectId);
    store.setEnrichments(data.issues ?? {});
  } catch (err) {
    store.setError(String(err));
  } finally {
    store.setLoading(false);
  }
}

export async function transitionWorkflowState(
  projectId: string,
  issueNumber: number,
  to: WorkflowState,
  resolution?: Resolution,
): Promise<void> {
  const store = useEnrichmentStore.getState();
  try {
    const updated: IssueEnrichment = await window.electronAPI.github.transitionWorkflowState(
      projectId,
      issueNumber,
      to,
      resolution,
    );
    store.setEnrichment(issueNumber, updated);
  } catch (err) {
    store.setError(String(err));
    throw err;
  }
}

export async function bootstrapEnrichment(
  projectId: string,
  issues: import('@shared/types/integrations').GitHubIssue[],
): Promise<void> {
  const store = useEnrichmentStore.getState();
  try {
    const data: EnrichmentFile = await window.electronAPI.github.bootstrapEnrichment(
      projectId,
      issues,
    );
    store.setEnrichments(data.issues ?? {});
  } catch (err) {
    store.setError(String(err));
  }
}

export async function reconcileEnrichment(
  projectId: string,
  issues: import('@shared/types/integrations').GitHubIssue[],
): Promise<void> {
  const store = useEnrichmentStore.getState();
  try {
    const data: EnrichmentFile = await window.electronAPI.github.reconcileEnrichment(
      projectId,
      issues,
    );
    store.setEnrichments(data.issues ?? {});
  } catch (err) {
    store.setError(String(err));
  }
}
