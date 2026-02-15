/**
 * Window Manager
 * Manages multiple BrowserWindow instances for multi-window pop-out support
 *
 * Responsibilities:
 * - Create and track BrowserWindow instances
 * - Manage window configurations (main, project, view types)
 * - Handle parent-child window relationships
 * - Prevent duplicate pop-outs
 * - Broadcast state changes across all windows
 * - Persist and restore window positions/sizes
 *
 * Architecture:
 * - Singleton pattern for centralized window management
 * - Each window has a unique windowId (BrowserWindow.id)
 * - Windows tracked via Map<windowId, WindowConfig>
 * - URL parameters determine window type and content
 */

import { app, BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { is } from '@electron-toolkit/utils';
import { isMacOS } from './platform';
import { IPC_CHANNELS } from '../shared/constants';
import type { WindowConfig, GlobalState } from '../shared/types/window';

// Window sizing constants (reused from index.ts patterns)
const WINDOW_PREFERRED_WIDTH = 1400;
const WINDOW_PREFERRED_HEIGHT = 900;
const WINDOW_MIN_WIDTH = 800;
const WINDOW_MIN_HEIGHT = 500;
const WINDOW_SCREEN_MARGIN = 20;
const DEFAULT_SCREEN_WIDTH = 1920;
const DEFAULT_SCREEN_HEIGHT = 1080;

/**
 * Persisted window bounds storage format
 * Keys are stable identifiers: 'main', 'project-{id}', 'view-{id}-{view}'
 */
interface PersistedBounds {
  [key: string]: Electron.Rectangle;
}

/** Debounce delay for saving window state to disk (ms) */
const SAVE_DEBOUNCE_DELAY = 500;

/**
 * Window Manager singleton class
 * Manages lifecycle of all BrowserWindow instances in the application
 */
export class WindowManager {
  private static instance: WindowManager | null = null;
  private windows: Map<number, WindowConfig>;
  private mainWindowId: number | null = null;
  private saveTimer: NodeJS.Timeout | null = null;
  private persistedBounds: PersistedBounds = {};

  private constructor() {
    this.windows = new Map();
    this.loadPersistedBounds();
  }

  /**
   * Get the singleton instance of WindowManager
   * @returns WindowManager instance
   */
  static getInstance(): WindowManager {
    if (!WindowManager.instance) {
      WindowManager.instance = new WindowManager();
    }
    return WindowManager.instance;
  }

  /**
   * Get path to window bounds persistence file
   * @returns Absolute path to window-bounds.json in userData
   */
  private getBoundsFilePath(): string {
    return join(app.getPath('userData'), 'window-bounds.json');
  }

  /**
   * Generate stable key for window bounds persistence
   * @param config - Window configuration
   * @returns Stable key string (e.g., 'main', 'project-123', 'view-123-terminals')
   */
  private getWindowKey(config: Pick<WindowConfig, 'type' | 'projectId' | 'view'>): string {
    if (config.type === 'main') {
      return 'main';
    }
    if (config.type === 'project' && config.projectId) {
      return `project-${config.projectId}`;
    }
    if (config.type === 'view' && config.projectId && config.view) {
      return `view-${config.projectId}-${config.view}`;
    }
    return 'unknown';
  }

  /**
   * Load persisted window bounds from disk
   * Called during WindowManager construction
   */
  private loadPersistedBounds(): void {
    const boundsPath = this.getBoundsFilePath();
    try {
      if (existsSync(boundsPath)) {
        const data = readFileSync(boundsPath, 'utf-8');
        this.persistedBounds = JSON.parse(data);
      }
    } catch (error: unknown) {
      console.error('[WindowManager] Failed to load persisted bounds:', error);
      this.persistedBounds = {};
    }
  }

  /**
   * Save window bounds to disk (debounced to avoid excessive writes)
   * Collects bounds from all tracked windows and persists to JSON file
   */
  private scheduleSave(): void {
    // Clear existing timer
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }

    // Schedule new save
    this.saveTimer = setTimeout(() => {
      this.saveNow();
      this.saveTimer = null;
    }, SAVE_DEBOUNCE_DELAY);
  }

  /**
   * Immediately save window bounds to disk (no debounce)
   */
  private saveNow(): void {
    const boundsPath = this.getBoundsFilePath();
    const boundsToSave: PersistedBounds = {};

    // Collect current bounds from all windows
    for (const config of this.windows.values()) {
      if (config.bounds) {
        const key = this.getWindowKey(config);
        boundsToSave[key] = config.bounds;
      }
    }

    try {
      writeFileSync(boundsPath, JSON.stringify(boundsToSave, null, 2), 'utf-8');
      this.persistedBounds = boundsToSave;
    } catch (error: unknown) {
      console.error('[WindowManager] Failed to save window bounds:', error);
    }
  }

  /**
   * Register the main window
   * @param window - Main BrowserWindow instance
   */
  registerMainWindow(window: BrowserWindow): void {
    this.mainWindowId = window.id;
    this.windows.set(window.id, {
      windowId: window.id,
      type: 'main',
      bounds: window.getNormalBounds(),
    });

    // Update bounds on move/resize and persist to disk
    window.on('resize', () => {
      const config = this.windows.get(window.id);
      if (config) {
        config.bounds = window.getNormalBounds();
        this.scheduleSave();
      }
    });

    window.on('move', () => {
      const config = this.windows.get(window.id);
      if (config) {
        config.bounds = window.getNormalBounds();
        this.scheduleSave();
      }
    });

    // Track window close to clean up from map
    window.on('closed', () => {
      // Close all child windows first (prevents orphaned pop-outs)
      this.closeChildWindows(window.id);

      // Save final state before cleanup
      this.saveNow();

      // Clean up the main window reference
      this.windows.delete(window.id);
      if (this.mainWindowId === window.id) {
        this.mainWindowId = null;
      }
    });
  }

  /**
   * Create a new window with specified configuration
   * @param config - Window configuration including type, projectId, view
   * @param parentWindow - Optional parent window for child relationship
   * @returns Created BrowserWindow instance
   */
  createWindow(config: Omit<WindowConfig, 'windowId'>, parentWindow?: BrowserWindow): BrowserWindow {
    // Calculate window dimensions (same logic as main window creation)
    let workAreaSize: { width: number; height: number };
    try {
      const display = screen.getPrimaryDisplay();
      if (
        display?.workAreaSize &&
        typeof display.workAreaSize.width === 'number' &&
        typeof display.workAreaSize.height === 'number' &&
        display.workAreaSize.width > 0 &&
        display.workAreaSize.height > 0
      ) {
        workAreaSize = display.workAreaSize;
      } else {
        console.error('[WindowManager] screen.getPrimaryDisplay() returned unexpected structure');
        workAreaSize = { width: DEFAULT_SCREEN_WIDTH, height: DEFAULT_SCREEN_HEIGHT };
      }
    } catch (error: unknown) {
      console.error('[WindowManager] Failed to get primary display:', error);
      workAreaSize = { width: DEFAULT_SCREEN_WIDTH, height: DEFAULT_SCREEN_HEIGHT };
    }

    const availableWidth = workAreaSize.width - WINDOW_SCREEN_MARGIN;
    const availableHeight = workAreaSize.height - WINDOW_SCREEN_MARGIN;

    // Check for persisted bounds first, then use provided bounds, then calculate
    const windowKey = this.getWindowKey(config);
    const persistedBounds = this.persistedBounds[windowKey];
    const boundsToUse = persistedBounds ?? config.bounds;

    // Use saved bounds if available, otherwise calculate
    const width = boundsToUse?.width ?? Math.min(WINDOW_PREFERRED_WIDTH, availableWidth);
    const height = boundsToUse?.height ?? Math.min(WINDOW_PREFERRED_HEIGHT, availableHeight);
    const minWidth = Math.min(WINDOW_MIN_WIDTH, width);
    const minHeight = Math.min(WINDOW_MIN_HEIGHT, height);

    // Create browser window options
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width,
      height,
      minWidth,
      minHeight,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hiddenInset',
      trafficLightPosition: { x: 15, y: 10 },
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true,
      },
    };

    // Set parent if provided
    if (parentWindow) {
      windowOptions.parent = parentWindow;
    }

    // Apply saved position if available
    if (boundsToUse) {
      windowOptions.x = boundsToUse.x;
      windowOptions.y = boundsToUse.y;
    }

    const window = new BrowserWindow(windowOptions);

    // Build URL with query parameters based on window type
    const params = new URLSearchParams();
    params.set('type', config.type);
    if (config.projectId) {
      params.set('projectId', config.projectId);
    }
    if (config.view) {
      params.set('view', config.view);
    }

    // Load the appropriate URL
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      const url = `${process.env['ELECTRON_RENDERER_URL']}?${params.toString()}`;
      window.loadURL(url);
    } else {
      const indexPath = join(__dirname, '../renderer/index.html');
      window.loadFile(indexPath, { query: Object.fromEntries(params) });
    }

    // Show window when ready
    window.once('ready-to-show', () => {
      window.show();
    });

    // Open external links in browser
    window.webContents.setWindowOpenHandler((details) => {
      const { shell } = require('electron');
      shell.openExternal(details.url);
      return { action: 'deny' };
    });

    // Track the window configuration
    const windowConfig: WindowConfig = {
      windowId: window.id,
      type: config.type,
      projectId: config.projectId,
      view: config.view,
      bounds: window.getNormalBounds(),
      parentWindowId: parentWindow?.id,
    };
    this.windows.set(window.id, windowConfig);

    // Update bounds on move/resize and persist to disk
    window.on('resize', () => {
      const config = this.windows.get(window.id);
      if (config) {
        config.bounds = window.getNormalBounds();
        this.scheduleSave();
      }
    });

    window.on('move', () => {
      const config = this.windows.get(window.id);
      if (config) {
        config.bounds = window.getNormalBounds();
        this.scheduleSave();
      }
    });

    // Clean up on close and save final state
    window.on('closed', () => {
      this.windows.delete(window.id);
      this.scheduleSave();
    });

    return window;
  }

  /**
   * Pop out entire project into new window
   * @param projectId - ID of project to pop out
   * @param sourceWindow - Window initiating the pop-out
   * @returns Window ID and success status
   * @throws Error if project already popped out
   */
  async popOutProject(projectId: string, sourceWindow: BrowserWindow): Promise<{ windowId: number }> {
    // Check for duplicate
    const existingWindowId = this.isProjectPoppedOut(projectId);
    if (existingWindowId !== null) {
      // Focus existing window instead of creating duplicate
      this.focusWindow(existingWindowId);
      throw {
        code: 'ALREADY_POPPED_OUT',
        message: `Project ${projectId} is already popped out`,
        existingWindowId,
      };
    }

    // Create new window for project
    const window = this.createWindow(
      {
        type: 'project',
        projectId,
      },
      sourceWindow
    );

    return { windowId: window.id };
  }

  /**
   * Pop out specific view into new window
   * @param projectId - ID of project containing the view
   * @param view - View identifier (e.g., 'terminals', 'github-prs', 'kanban')
   * @param sourceWindow - Window initiating the pop-out
   * @returns Window ID and success status
   * @throws Error if view already popped out
   */
  async popOutView(
    projectId: string,
    view: string,
    sourceWindow: BrowserWindow
  ): Promise<{ windowId: number }> {
    // Check for duplicate
    const existingWindowId = this.isViewPoppedOut(projectId, view);
    if (existingWindowId !== null) {
      // Focus existing window instead of creating duplicate
      this.focusWindow(existingWindowId);
      throw {
        code: 'ALREADY_POPPED_OUT',
        message: `View ${view} for project ${projectId} is already popped out`,
        existingWindowId,
      };
    }

    // Create new window for view
    const window = this.createWindow(
      {
        type: 'view',
        projectId,
        view,
      },
      sourceWindow
    );

    return { windowId: window.id };
  }

  /**
   * Merge pop-out window back to main window
   * @param windowId - ID of window to merge
   */
  async mergeWindow(windowId: number): Promise<void> {
    const window = BrowserWindow.fromId(windowId);
    if (!window) {
      throw new Error(`Window ${windowId} not found`);
    }

    // Simply close the window - renderer will handle UI cleanup
    window.close();
  }

  /**
   * Get configuration for specific window
   * @param windowId - ID of window
   * @returns Window configuration or null if not found
   */
  getWindowConfig(windowId: number): WindowConfig | null {
    return this.windows.get(windowId) ?? null;
  }

  /**
   * Get all current window configurations
   * @returns Array of all window configurations
   */
  getAllWindows(): WindowConfig[] {
    return Array.from(this.windows.values());
  }

  /**
   * Check if project is already popped out
   * @param projectId - Project ID to check
   * @returns Window ID if popped out, null otherwise
   */
  isProjectPoppedOut(projectId: string): number | null {
    for (const [windowId, config] of this.windows.entries()) {
      if (config.type === 'project' && config.projectId === projectId) {
        return windowId;
      }
    }
    return null;
  }

  /**
   * Check if view is already popped out
   * @param projectId - Project ID
   * @param view - View identifier
   * @returns Window ID if popped out, null otherwise
   */
  isViewPoppedOut(projectId: string, view: string): number | null {
    for (const [windowId, config] of this.windows.entries()) {
      if (config.type === 'view' && config.projectId === projectId && config.view === view) {
        return windowId;
      }
    }
    return null;
  }

  /**
   * Focus existing window
   * @param windowId - ID of window to focus
   */
  focusWindow(windowId: number): void {
    const window = BrowserWindow.fromId(windowId);
    if (window) {
      if (window.isMinimized()) {
        window.restore();
      }
      window.focus();
    }
  }

  /**
   * Close all child windows of specified parent
   * @param parentWindowId - Parent window ID
   */
  closeChildWindows(parentWindowId: number): void {
    const childWindows: BrowserWindow[] = [];

    // Find all child windows
    for (const [windowId, config] of this.windows.entries()) {
      if (config.parentWindowId === parentWindowId) {
        const window = BrowserWindow.fromId(windowId);
        if (window) {
          childWindows.push(window);
        }
      }
    }

    // Destroy all child windows (guaranteed close, not cancellable)
    for (const window of childWindows) {
      window.destroy();
    }
  }

  /**
   * Get all child windows of specified parent
   * @param parentWindowId - Parent window ID
   * @returns Array of child window configurations
   */
  getChildWindows(parentWindowId: number): WindowConfig[] {
    const children: WindowConfig[] = [];

    for (const config of this.windows.values()) {
      if (config.parentWindowId === parentWindowId) {
        children.push(config);
      }
    }

    return children;
  }

  /**
   * Get parent window ID for specified window
   * @param windowId - Child window ID
   * @returns Parent window ID or null if no parent
   */
  getParentWindowId(windowId: number): number | null {
    const config = this.windows.get(windowId);
    return config?.parentWindowId ?? null;
  }

  /**
   * Check if window has children
   * @param windowId - Window ID to check
   * @returns True if window has child windows
   */
  hasChildWindows(windowId: number): boolean {
    for (const config of this.windows.values()) {
      if (config.parentWindowId === windowId) {
        return true;
      }
    }
    return false;
  }

  /**
   * Get window hierarchy for a given window
   * @param windowId - Window ID
   * @returns Object containing parent and children configurations
   */
  getWindowHierarchy(windowId: number): {
    window: WindowConfig | null;
    parent: WindowConfig | null;
    children: WindowConfig[];
  } {
    const window = this.windows.get(windowId) ?? null;
    const parentId = this.getParentWindowId(windowId);
    const parent = parentId !== null ? this.windows.get(parentId) ?? null : null;
    const children = this.getChildWindows(windowId);

    return {
      window,
      parent,
      children,
    };
  }

  /**
   * Save window state to persistent storage
   * Public API for external callers to trigger immediate save
   */
  saveWindowState(): void {
    this.saveNow();
  }

  /**
   * Restore windows from saved state
   * Note: Bounds are automatically loaded during WindowManager construction
   * and applied when windows are created. This method allows external callers
   * to trigger a reload of persisted bounds if needed.
   */
  restoreWindowState(): void {
    this.loadPersistedBounds();
  }

  /**
   * Broadcast state change to all windows
   * @param state - Global state change to broadcast
   */
  broadcastStateChange(state: GlobalState): void {
    // Get all windows
    const allWindows = BrowserWindow.getAllWindows();

    // Send to all windows
    for (const window of allWindows) {
      if (!window.isDestroyed()) {
        window.webContents.send(IPC_CHANNELS.WINDOW_SYNC_STATE, state);
      }
    }
  }

  /**
   * Get the main window instance
   * @returns Main window or null if not registered
   */
  getMainWindow(): BrowserWindow | null {
    if (this.mainWindowId === null) {
      return null;
    }
    return BrowserWindow.fromId(this.mainWindowId);
  }
}

/**
 * Get the singleton WindowManager instance
 * Convenience export for use in other modules
 */
export function getWindowManager(): WindowManager {
  return WindowManager.getInstance();
}
