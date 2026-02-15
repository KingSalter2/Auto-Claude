import { create } from 'zustand';
import type { WindowConfig } from '../../shared/types/window';

interface WindowState {
  /** Current window configuration (null if not yet loaded) */
  windowConfig: WindowConfig | null;

  /** Set of project IDs that are currently popped out */
  poppedOutProjects: Set<string>;

  /** Map of popped-out views (key: "projectId:view", value: windowId) */
  poppedOutViews: Map<string, number>;

  /** Set of window keys currently being created (for loading states) */
  loadingWindows: Set<string>;

  // Actions
  setWindowConfig: (config: WindowConfig | null) => void;
  addPoppedOutProject: (projectId: string) => void;
  removePoppedOutProject: (projectId: string) => void;
  addPoppedOutView: (projectId: string, view: string, windowId: number) => void;
  removePoppedOutView: (projectId: string, view: string) => void;
  setWindowLoading: (key: string, loading: boolean) => void;

  // Selectors
  isProjectPoppedOut: (projectId: string) => boolean;
  isViewPoppedOut: (projectId: string, view: string) => boolean;
  isWindowLoading: (key: string) => boolean;
  getViewKey: (projectId: string, view: string) => string;
}

export const useWindowStore = create<WindowState>((set, get) => ({
  windowConfig: null,
  poppedOutProjects: new Set(),
  poppedOutViews: new Map(),
  loadingWindows: new Set(),

  setWindowConfig: (config) => set({ windowConfig: config }),

  addPoppedOutProject: (projectId) =>
    set((state) => {
      const newSet = new Set(state.poppedOutProjects);
      newSet.add(projectId);
      return { poppedOutProjects: newSet };
    }),

  removePoppedOutProject: (projectId) =>
    set((state) => {
      const newSet = new Set(state.poppedOutProjects);
      newSet.delete(projectId);
      return { poppedOutProjects: newSet };
    }),

  addPoppedOutView: (projectId, view, windowId) =>
    set((state) => {
      const newMap = new Map(state.poppedOutViews);
      const key = `${projectId}:${view}`;
      newMap.set(key, windowId);
      return { poppedOutViews: newMap };
    }),

  removePoppedOutView: (projectId, view) =>
    set((state) => {
      const newMap = new Map(state.poppedOutViews);
      const key = `${projectId}:${view}`;
      newMap.delete(key);
      return { poppedOutViews: newMap };
    }),

  setWindowLoading: (key, loading) =>
    set((state) => {
      const newSet = new Set(state.loadingWindows);
      if (loading) {
        newSet.add(key);
      } else {
        newSet.delete(key);
      }
      return { loadingWindows: newSet };
    }),

  // Selectors
  isProjectPoppedOut: (projectId) => {
    const state = get();
    return state.poppedOutProjects.has(projectId);
  },

  isViewPoppedOut: (projectId, view) => {
    const state = get();
    const key = `${projectId}:${view}`;
    return state.poppedOutViews.has(key);
  },

  isWindowLoading: (key) => {
    const state = get();
    return state.loadingWindows.has(key);
  },

  getViewKey: (projectId, view) => `${projectId}:${view}`,
}));
