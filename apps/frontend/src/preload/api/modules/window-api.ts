/**
 * Window Management API for renderer process
 *
 * Provides access to multi-window pop-out features:
 * - Pop out entire projects into separate windows
 * - Pop out individual views (terminals, PRs, kanban, etc.)
 * - Manage window lifecycle (merge, focus, close)
 * - Synchronize state across all windows
 */

import { IPC_CHANNELS } from '../../../shared/constants';
import type { WindowConfig, GlobalState } from '../../../shared/types';
import { createIpcListener, invokeIpc, IpcListenerCleanup } from './ipc-utils';

/**
 * Window Management API interface exposed to renderer
 */
export interface WindowAPI {
  /**
   * Pop out entire project into a new window
   * @param projectId - ID of the project to pop out
   * @returns Promise resolving to the new window's ID
   * @throws Error if project is already popped out
   */
  popOutProject: (projectId: string) => Promise<{ windowId: number }>;

  /**
   * Pop out specific view into a new window
   * @param projectId - ID of the project containing the view
   * @param view - View identifier (e.g., 'terminals', 'github-prs', 'kanban')
   * @returns Promise resolving to the new window's ID
   * @throws Error if view is already popped out
   */
  popOutView: (projectId: string, view: string) => Promise<{ windowId: number }>;

  /**
   * Merge a pop-out window back to the main window
   * @param windowId - ID of the window to merge
   * @returns Promise resolving when window is merged
   */
  mergeWindow: (windowId: number) => Promise<void>;

  /**
   * Get list of all open windows with their configurations
   * @returns Promise resolving to array of window configurations
   */
  getWindows: () => Promise<WindowConfig[]>;

  /**
   * Get current window's configuration
   * @returns Promise resolving to the current window's configuration
   */
  getConfig: () => Promise<WindowConfig>;

  /**
   * Focus an existing window (brings it to front)
   * @param windowId - ID of the window to focus
   * @returns Promise resolving when window is focused
   */
  focusWindow: (windowId: number) => Promise<void>;

  /**
   * Listen for window configuration changes
   * @param callback - Function called when window config changes
   * @returns Cleanup function to remove the listener
   */
  onConfigChanged: (callback: (config: WindowConfig) => void) => IpcListenerCleanup;

  /**
   * Listen for global state synchronization events
   * @param callback - Function called when state changes should sync across windows
   * @returns Cleanup function to remove the listener
   */
  onSyncState: (callback: (state: GlobalState) => void) => IpcListenerCleanup;
}

/**
 * Creates the Window Management API implementation
 */
export const createWindowAPI = (): WindowAPI => ({
  popOutProject: (projectId: string): Promise<{ windowId: number }> =>
    invokeIpc(IPC_CHANNELS.WINDOW_POP_OUT_PROJECT, projectId),

  popOutView: (projectId: string, view: string): Promise<{ windowId: number }> =>
    invokeIpc(IPC_CHANNELS.WINDOW_POP_OUT_VIEW, projectId, view),

  mergeWindow: (windowId: number): Promise<void> =>
    invokeIpc(IPC_CHANNELS.WINDOW_MERGE_WINDOW, windowId),

  getWindows: (): Promise<WindowConfig[]> =>
    invokeIpc(IPC_CHANNELS.WINDOW_GET_WINDOWS),

  getConfig: (): Promise<WindowConfig> =>
    invokeIpc(IPC_CHANNELS.WINDOW_GET_CONFIG),

  focusWindow: (windowId: number): Promise<void> =>
    invokeIpc(IPC_CHANNELS.WINDOW_FOCUS_WINDOW, windowId),

  onConfigChanged: (callback: (config: WindowConfig) => void): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.WINDOW_CONFIG_CHANGED, callback),

  onSyncState: (callback: (state: GlobalState) => void): IpcListenerCleanup =>
    createIpcListener(IPC_CHANNELS.WINDOW_SYNC_STATE, callback)
});
