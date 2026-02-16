import { create } from 'zustand';
import i18next from 'i18next';
import type {
  GitHubInvestigationStatus,
  GitHubInvestigationResult,
  InvestigationProgress,
  InvestigationResult,
  InvestigationReport,
  InvestigationDismissReason,
  InvestigationSettings,
  InvestigationState,
  PersistedInvestigationState,
} from '@shared/types';
import { toast } from '../../hooks/use-toast';

// ============================================
// Per-Issue Investigation State
// ============================================

/**
 * Investigation state for a single issue.
 * Keyed by `${projectId}:${issueNumber}` in the store.
 */
export interface IssueInvestigationState {
  issueNumber: number;
  projectId: string;
  isInvestigating: boolean;
  /** Real-time progress during investigation */
  progress: InvestigationProgress | null;
  /** Final investigation report */
  report: InvestigationReport | null;
  /** Previous report (kept during re-investigation for continuity) */
  previousReport: InvestigationReport | null;
  /** Error message if investigation failed */
  error: string | null;
  /** Pre-allocated spec ID for task creation */
  specId: string | null;
  /** Dismiss reason if issue was dismissed */
  dismissReason: InvestigationDismissReason | null;
  /** GitHub comment ID if results were posted */
  githubCommentId: number | null;
  /** Timestamp when investigation started */
  startedAt: string | null;
  /** Timestamp when investigation completed */
  completedAt: string | null;
  /** Timestamp when results were posted to GitHub */
  postedAt: string | null;
  /** Linked task status (synced from task store for building/done states) */
  linkedTaskStatus: string | null;
  /** Activity log tracking key lifecycle events */
  activityLog: Array<{ event: string; timestamp: string }>;
  /** True if the issue no longer exists in the GitHub response (stale/deleted) */
  isStale?: boolean;
  /** True if the investigation was explicitly cancelled (prevents late completion overwrite) */
  isCancelled?: boolean;
}

// ============================================
// Store Interface
// ============================================

interface InvestigationStoreState {
  // Per-issue investigation state
  // Key: `${projectId}:${issueNumber}`
  investigations: Record<string, IssueInvestigationState>;

  // Settings (per project, keyed by projectId)
  settings: Record<string, InvestigationSettings>;

  // ---- Label Sync ----
  // Label sync callback state
  stateChangeCallback?: (projectId: string, issueNumber: number, newState: string) => void;

  // ---- Legacy state (backwards compat with useGitHubInvestigation hook) ----
  investigationStatus: GitHubInvestigationStatus;
  lastInvestigationResult: GitHubInvestigationResult | null;
  setInvestigationStatus: (status: GitHubInvestigationStatus) => void;
  setInvestigationResult: (result: GitHubInvestigationResult | null) => void;
  clearInvestigation: () => void;

  // ---- New system actions ----
  startInvestigation: (projectId: string, issueNumber: number) => void;
  setProgress: (projectId: string, progress: InvestigationProgress) => void;
  setResult: (projectId: string, result: InvestigationResult) => void;
  setError: (projectId: string, issueNumber: number, error: string) => void;
  dismiss: (projectId: string, issueNumber: number, reason: InvestigationDismissReason) => void;
  clearIssueInvestigation: (projectId: string, issueNumber: number) => void;
  setSettings: (projectId: string, settings: InvestigationSettings) => void;
  syncTaskState: (projectId: string, issueNumber: number, taskStatus: string) => void;
  clearLinkedTask: (projectId: string, issueNumber: number) => void;
  loadPersistedInvestigations: (projectId: string, states: PersistedInvestigationState[]) => void;
  setGithubCommentId: (projectId: string, issueNumber: number, commentId: number) => void;
  setSpecId: (projectId: string, issueNumber: number, specId: string) => void;
  cancelAllInvestigations: (projectId: string) => void;
  markStaleInvestigations: (projectId: string, activeIssueNumbers: Set<number>) => void;

  // ---- Selectors ----
  getInvestigationState: (projectId: string, issueNumber: number) => IssueInvestigationState | null;
  getDerivedState: (projectId: string, issueNumber: number) => InvestigationState;
  getActiveInvestigations: (projectId: string) => IssueInvestigationState[];
  getSettings: (projectId: string) => InvestigationSettings | null;
}

// ============================================
// Store Implementation
// ============================================

export const useInvestigationStore = create<InvestigationStoreState>((set, get) => ({
  // Initial state
  investigations: {},
  settings: {},

  // Legacy state
  investigationStatus: { phase: 'idle', progress: 0, message: '' },
  lastInvestigationResult: null,

  // Legacy actions (backwards compat)
  setInvestigationStatus: (investigationStatus) => set({ investigationStatus }),
  setInvestigationResult: (lastInvestigationResult) => set({ lastInvestigationResult }),
  clearInvestigation: () => set({
    investigationStatus: { phase: 'idle', progress: 0, message: '' },
    lastInvestigationResult: null
  }),

  // ---- New system actions ----

  startInvestigation: (projectId: string, issueNumber: number) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    const now = new Date().toISOString();
    const event = existing?.report ? 're-investigation started' : 'investigation started';
    const log = [...(existing?.activityLog ?? []), { event, timestamp: now }].slice(-50);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber,
          projectId,
          isInvestigating: true,
          progress: null,
          report: null,
          previousReport: existing?.report ?? null,
          error: null,
          specId: existing?.specId ?? null,
          dismissReason: null, // clear dismiss on re-investigation
          githubCommentId: existing?.githubCommentId ?? null,
          startedAt: now,
          completedAt: null,
          postedAt: existing?.postedAt ?? null,
          linkedTaskStatus: existing?.linkedTaskStatus ?? null,
          activityLog: log,
          isCancelled: false, // clear cancelled flag on new investigation
        }
      }
    };
  }),

  setProgress: (projectId: string, progress: InvestigationProgress) => set((state) => {
    const key = `${projectId}:${progress.issueNumber}`;
    const existing = state.investigations[key];
    // Don't create ghost entries for cancelled/unknown investigations
    if (!existing?.isInvestigating) return state;
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber: progress.issueNumber,
          projectId,
          isInvestigating: true,
          progress,
          report: existing?.report ?? null,
          previousReport: existing?.previousReport ?? null,
          error: null,
          specId: existing?.specId ?? null,
          dismissReason: existing?.dismissReason ?? null,
          githubCommentId: existing?.githubCommentId ?? null,
          startedAt: existing?.startedAt ?? null,
          completedAt: null,
          postedAt: existing?.postedAt ?? null,
          linkedTaskStatus: existing?.linkedTaskStatus ?? null,
          activityLog: existing?.activityLog ?? [],
          isCancelled: existing?.isCancelled ?? false,
        }
      }
    };
  }),

  setResult: (projectId: string, result: InvestigationResult) => set((state) => {
    const key = `${projectId}:${result.issueNumber}`;
    const existing = state.investigations[key];
    // Don't overwrite cancelled state with late completion
    if (existing?.isCancelled) return state;
    const log = [...(existing?.activityLog ?? []), { event: 'investigation completed', timestamp: result.completedAt }].slice(-50);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber: result.issueNumber,
          projectId,
          isInvestigating: false,
          progress: null,
          report: result.report,
          previousReport: existing?.previousReport ?? null,
          error: null,
          specId: result.specId ?? existing?.specId ?? null,
          dismissReason: existing?.dismissReason ?? null,
          githubCommentId: result.githubCommentId ?? existing?.githubCommentId ?? null,
          startedAt: existing?.startedAt ?? null,
          completedAt: result.completedAt,
          postedAt: existing?.postedAt ?? null,
          linkedTaskStatus: existing?.linkedTaskStatus ?? null,
          activityLog: log,
          isCancelled: false, // clear cancelled flag on successful completion
        }
      }
    };
  }),

  setError: (projectId: string, issueNumber: number, error: string) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    const log = [...(existing?.activityLog ?? []), { event: 'investigation failed', timestamp: new Date().toISOString() }].slice(-50);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          issueNumber,
          projectId,
          isInvestigating: false,
          progress: null,
          report: existing?.report ?? null,
          previousReport: existing?.previousReport ?? null,
          error,
          specId: existing?.specId ?? null,
          dismissReason: existing?.dismissReason ?? null,
          githubCommentId: existing?.githubCommentId ?? null,
          startedAt: existing?.startedAt ?? null,
          completedAt: null,
          postedAt: existing?.postedAt ?? null,
          linkedTaskStatus: existing?.linkedTaskStatus ?? null,
          activityLog: log,
          isCancelled: existing?.isCancelled ?? false,
        }
      }
    };
  }),

  dismiss: (projectId: string, issueNumber: number, reason: InvestigationDismissReason) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    if (!existing) return state;
    const log = [...(existing.activityLog ?? []), { event: `dismissed: ${reason}`, timestamp: new Date().toISOString() }].slice(-50);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          ...existing,
          dismissReason: reason,
          activityLog: log
        }
      }
    };
  }),

  clearIssueInvestigation: (projectId: string, issueNumber: number) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const { [key]: _, ...rest } = state.investigations;
    return { investigations: rest };
  }),

  setSettings: (projectId: string, settings: InvestigationSettings) => set((state) => ({
    settings: {
      ...state.settings,
      [projectId]: settings
    }
  })),

  syncTaskState: (projectId: string, issueNumber: number, taskStatus: string) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    if (!existing) return state;

    // Only update if there's a linked task (specId set)
    if (!existing.specId) return state;

    // Define state ordering to prevent backward transitions
    const stateOrder: Record<string, number> = {
      'task_created': 0,
      'building': 1,
      'done': 2,
    };

    // Map task status to a linked task status value
    let newLinkedStatus: string | null = null;
    if (taskStatus === 'in_progress' || taskStatus === 'ai_review') {
      newLinkedStatus = 'building';
    } else if (taskStatus === 'done' || taskStatus === 'pr_created') {
      newLinkedStatus = 'done';
    } else if (taskStatus === 'error') {
      newLinkedStatus = 'failed';
    }

    if (!newLinkedStatus) return state;

    // Prevent backward transitions (don't go from "done" back to "building")
    const currentOrder = stateOrder[existing.linkedTaskStatus ?? 'task_created'] ?? -1;
    const newOrder = stateOrder[newLinkedStatus] ?? -1;
    if (newOrder <= currentOrder && newLinkedStatus !== 'failed') return state;

    return {
      investigations: {
        ...state.investigations,
        [key]: {
          ...existing,
          linkedTaskStatus: newLinkedStatus,
        }
      }
    };
  }),

  clearLinkedTask: (projectId: string, issueNumber: number) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    if (!existing) return state;
    const log = [...(existing.activityLog ?? []), { event: 'linked task deleted', timestamp: new Date().toISOString() }].slice(-50);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          ...existing,
          specId: null,
          linkedTaskStatus: null,
          activityLog: log
        }
      }
    };
  }),

  setGithubCommentId: (projectId: string, issueNumber: number, commentId: number) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    if (!existing) {
      console.warn(`[InvestigationStore] setGithubCommentId called for non-existent investigation ${key}`);
      return state;
    }
    const now = new Date().toISOString();
    const log = [...(existing.activityLog ?? []), { event: 'posted to GitHub', timestamp: now }].slice(-50);
    console.log(`[InvestigationStore] Setting githubCommentId=${commentId} and postedAt=${now} for ${key}`);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          ...existing,
          githubCommentId: commentId,
          postedAt: now,
          activityLog: log,
        }
      }
    };
  }),

  setSpecId: (projectId: string, issueNumber: number, specId: string) => set((state) => {
    const key = `${projectId}:${issueNumber}`;
    const existing = state.investigations[key];
    if (!existing) {
      console.warn(`[InvestigationStore] setSpecId called for non-existent investigation ${key}`);
      return state;
    }
    const now = new Date().toISOString();
    const log = [...(existing.activityLog ?? []), { event: `task created: ${specId}`, timestamp: now }].slice(-50);
    console.log(`[InvestigationStore] Setting specId=${specId} for ${key}`);
    return {
      investigations: {
        ...state.investigations,
        [key]: {
          ...existing,
          specId,
          linkedTaskStatus: 'task_created',
          activityLog: log,
        }
      }
    };
  }),

  loadPersistedInvestigations: (projectId: string, states: PersistedInvestigationState[]) => set((state) => {
    const newInvestigations = { ...state.investigations };

    for (const persisted of states) {
      const key = `${projectId}:${persisted.issueNumber}`;

      // Don't overwrite investigations that are already in-memory
      // (e.g., currently running or already loaded)
      // Prevents race condition where fresh data gets overwritten by stale disk data
      if (newInvestigations[key]?.isInvestigating) {
        console.log(`[InvestigationStore] Skipping overwrite of active investigation ${key}`);
        continue;
      }

      const isError = persisted.status === 'failed' || persisted.wasInterrupted;

      // Defensive: Never overwrite a valid githubCommentId with null
      // This prevents losing the "posted" state during race conditions
      const existingHasCommentId = newInvestigations[key]?.githubCommentId;
      const persistedHasCommentId = persisted.githubCommentId;

      if (existingHasCommentId && !persistedHasCommentId) {
        console.warn(`[InvestigationStore] Skipping overwrite of ${key} - would lose githubCommentId (${existingHasCommentId})`);
        continue;
      }

      newInvestigations[key] = {
        issueNumber: persisted.issueNumber,
        projectId,
        isInvestigating: false,
        progress: null,
        report: (persisted.report as InvestigationReport) ?? null,
        previousReport: null,
        error: isError
          ? (persisted.wasInterrupted ? 'investigation.interrupted' : null)
          : null,
        specId: persisted.specId ?? null,
        dismissReason: null,
        githubCommentId: persisted.githubCommentId ?? null,
        startedAt: null,
        completedAt: persisted.completedAt ?? null,
        postedAt: persisted.postedAt ?? null,
        linkedTaskStatus: null,
        activityLog: persisted.activityLog ?? []
      };
    }

    return { investigations: newInvestigations };
  }),

  cancelAllInvestigations: (projectId: string) => set((state) => {
    const updated = { ...state.investigations };
    let changed = false;
    const now = new Date().toISOString();
    for (const [key, inv] of Object.entries(updated)) {
      if (inv.projectId !== projectId || !inv.isInvestigating) continue;
      const log = [...(inv.activityLog ?? []), { event: 'cancelled (cancel all)', timestamp: now }].slice(-50);
      updated[key] = {
        ...inv,
        isInvestigating: false,
        progress: null,
        error: 'Investigation cancelled',
        activityLog: log,
        isCancelled: true,
      };
      changed = true;
    }
    return changed ? { investigations: updated } : state;
  }),

  markStaleInvestigations: (projectId: string, activeIssueNumbers: Set<number>) => set((state) => {
    const updated = { ...state.investigations };
    let changed = false;
    for (const [key, inv] of Object.entries(updated)) {
      if (inv.projectId !== projectId) continue;
      const shouldBeStale = !activeIssueNumbers.has(inv.issueNumber);
      if (inv.isStale !== shouldBeStale) {
        updated[key] = { ...inv, isStale: shouldBeStale };
        changed = true;
      }
    }
    return changed ? { investigations: updated } : state;
  }),

  // ---- Selectors ----

  getInvestigationState: (projectId: string, issueNumber: number) => {
    const { investigations } = get();
    const key = `${projectId}:${issueNumber}`;
    return investigations[key] ?? null;
  },

  /**
   * Compute the derived investigation state for an issue.
   * This is the 8-state machine from the design doc, fully derived
   * from investigation data + linked task status (never manually set).
   */
  getDerivedState: (projectId: string, issueNumber: number): InvestigationState => {
    const { investigations } = get();
    const key = `${projectId}:${issueNumber}`;
    const inv = investigations[key];

    if (!inv) return 'new';
    if (inv.isInvestigating && inv.progress?.phase === 'queued') return 'queued';
    if (inv.isInvestigating) return 'investigating';
    if (inv.error === 'investigation.interrupted' && !inv.specId) return 'interrupted';
    if (inv.error && !inv.specId) return 'failed';
    if (inv.report?.likelyResolved && !inv.specId) return 'resolved';
    if (inv.report && !inv.specId) return 'findings_ready';
    if (inv.specId) {
      // Task has been created — check linked task status for advanced states
      if (inv.linkedTaskStatus === 'done') return 'done';
      if (inv.linkedTaskStatus === 'building') return 'building';
      return 'task_created';
    }
    return 'new';
  },

  getActiveInvestigations: (projectId: string) => {
    const { investigations } = get();
    return Object.values(investigations).filter(
      inv => inv.projectId === projectId && inv.isInvestigating
    );
  },

  getSettings: (projectId: string) => {
    const { settings } = get();
    return settings[projectId] ?? null;
  }
}));

// ============================================
// Global IPC Listeners
// ============================================

let investigationListenersInitialized = false;
let cleanupFunctions: (() => void)[] = [];

/**
 * Initialize global IPC listeners for investigation events.
 * Call this once at app startup to ensure events are captured
 * regardless of which component is mounted.
 */
export function initializeInvestigationListeners(): void {
  if (investigationListenersInitialized) return;

  // Check if the new investigation API is available
  if (!window.electronAPI?.github?.onInvestigationProgress) {
    console.warn('[InvestigationStore] Investigation API not available, skipping listener setup');
    return;
  }

  const store = useInvestigationStore.getState();

  // Listen for investigation progress events
  const cleanupProgress = window.electronAPI.github.onInvestigationProgress(
    (projectId: string, progress: InvestigationProgress) => {
      store.setProgress(projectId, progress);
    }
  );
  cleanupFunctions.push(cleanupProgress);

  // Listen for investigation completion events
  const cleanupComplete = window.electronAPI.github.onInvestigationComplete(
    (projectId: string, result: InvestigationResult) => {
      store.setResult(projectId, result);
      toast({
        title: i18next.t('common:investigation.toast.investigationComplete', { issueNumber: result.issueNumber }),
      });
    }
  );
  cleanupFunctions.push(cleanupComplete);

  // Listen for investigation error events
  const cleanupError = window.electronAPI.github.onInvestigationError(
    (projectId: string, errorPayload: string | { error: string; issueNumber?: number }) => {
      const errorMsg = typeof errorPayload === 'string' ? errorPayload : errorPayload.error;
      const issueNum = typeof errorPayload === 'object' ? errorPayload.issueNumber : undefined;

      if (issueNum) {
        // Target the specific investigation that failed
        store.setError(projectId, issueNum, errorMsg);
        toast({
          title: i18next.t('common:investigation.toast.investigationFailed', { issueNumber: issueNum }),
          variant: 'destructive',
        });
      } else {
        // Legacy fallback: no issueNumber, mark all active (shouldn't happen with updated handlers)
        const active = store.getActiveInvestigations(projectId);
        for (const inv of active) {
          store.setError(projectId, inv.issueNumber, errorMsg);
          toast({
            title: i18next.t('common:investigation.toast.investigationFailed', { issueNumber: inv.issueNumber }),
            variant: 'destructive',
          });
        }
      }
    }
  );
  cleanupFunctions.push(cleanupError);

  // Listen for GitHub auth changes - clear all investigation state
  if (window.electronAPI.github.onGitHubAuthChanged) {
    const cleanupAuthChanged = window.electronAPI.github.onGitHubAuthChanged(
      () => {
        useInvestigationStore.setState({ investigations: {}, settings: {} });
      }
    );
    cleanupFunctions.push(cleanupAuthChanged);
  }

  investigationListenersInitialized = true;
}

/**
 * Cleanup investigation listeners.
 * Call this during app unmount or hot-reload.
 */
export function cleanupInvestigationListeners(): void {
  for (const cleanup of cleanupFunctions) {
    try {
      cleanup();
    } catch {
      // Ignore cleanup errors
    }
  }
  cleanupFunctions = [];
  investigationListenersInitialized = false;
}

// ============================================
// Action helpers (called from outside the store)
// ============================================

/**
 * Start investigating a GitHub issue via the new investigation system.
 */
export function startIssueInvestigation(
  projectId: string,
  issueNumber: number
): void {
  const store = useInvestigationStore.getState();

  // Don't start if already investigating (concurrency guard)
  const existing = store.getInvestigationState(projectId, issueNumber);
  if (existing?.isInvestigating) return;

  store.startInvestigation(projectId, issueNumber);
  window.electronAPI.github.startInvestigation(projectId, issueNumber);
}

/**
 * Cancel a running investigation.
 */
export function cancelIssueInvestigation(
  projectId: string,
  issueNumber: number
): void {
  const store = useInvestigationStore.getState();
  const key = `${projectId}:${issueNumber}`;
  const existing = store.getInvestigationState(projectId, issueNumber);

  // Mark as cancelled before the IPC call to prevent late completion from overwriting
  if (existing) {
    useInvestigationStore.setState((state) => ({
      investigations: {
        ...state.investigations,
        [key]: {
          ...state.investigations[key],
          isCancelled: true,
        },
      },
    }));
  }

  // Mark as not investigating immediately
  store.setError(projectId, issueNumber, 'Investigation cancelled');
  window.electronAPI.github.cancelInvestigation(projectId, issueNumber);
}

/**
 * Cancel all running investigations for a project.
 */
export function cancelAllIssueInvestigations(projectId: string): void {
  const store = useInvestigationStore.getState();
  store.cancelAllInvestigations(projectId);
  window.electronAPI.github.cancelAllInvestigations(projectId);
}

/**
 * Load persisted investigation state from disk.
 * Call this when the GitHub Issues view mounts with a selected project
 * to restore completed/failed investigations from a previous session.
 */
export async function loadPersistedInvestigations(projectId: string): Promise<void> {
  if (!window.electronAPI?.github?.loadPersistedInvestigations) {
    return;
  }

  try {
    const result = await window.electronAPI.github.loadPersistedInvestigations(projectId);
    if (result.success && result.data && result.data.length > 0) {
      const store = useInvestigationStore.getState();
      store.loadPersistedInvestigations(projectId, result.data);
      console.log(`[InvestigationStore] Loaded ${result.data.length} persisted investigations for project ${projectId}`);
    }
  } catch (error) {
    console.warn('[InvestigationStore] Failed to load persisted investigations:', error);
  }
}

/**
 * Start investigating a GitHub issue (legacy function, kept for backwards compat).
 * Uses the old investigateGitHubIssue IPC channel.
 */
export function investigateGitHubIssue(
  projectId: string,
  issueNumber: number,
  selectedCommentIds?: number[]
): void {
  const store = useInvestigationStore.getState();
  store.setInvestigationStatus({
    phase: 'fetching',
    issueNumber,
    progress: 0,
    message: 'Starting investigation...'
  });
  store.setInvestigationResult(null);

  window.electronAPI.investigateGitHubIssue(projectId, issueNumber, selectedCommentIds);
}

// ============================================
// Investigation Watchdog
// ============================================

const WATCHDOG_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const INVESTIGATION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

let watchdogTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the investigation watchdog timer.
 * Checks every 5 minutes for investigations that have been running
 * for more than 30 minutes and marks them as timed out.
 */
export function startInvestigationWatchdog(): void {
  if (watchdogTimer) return;

  watchdogTimer = setInterval(() => {
    const { investigations } = useInvestigationStore.getState();
    const now = Date.now();

    for (const [key, inv] of Object.entries(investigations)) {
      // Only check active investigations with a start time
      if (!inv.isInvestigating || !inv.startedAt) continue;

      const elapsed = now - new Date(inv.startedAt).getTime();
      if (elapsed > INVESTIGATION_TIMEOUT_MS) {
        console.warn(`[InvestigationWatchdog] Investigation ${key} timed out after ${Math.round(elapsed / 60000)} minutes`);
        useInvestigationStore.getState().setError(
          inv.projectId,
          inv.issueNumber,
          'Investigation timed out (exceeded 30 minutes)'
        );
      }
    }
  }, WATCHDOG_INTERVAL_MS);
}

/**
 * Stop the investigation watchdog timer.
 */
export function stopInvestigationWatchdog(): void {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
}
