/**
 * Integration tests for window management IPC handlers
 * Tests IPC communication between renderer and main process for multi-window operations
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import type { WindowConfig, GlobalState } from '../../../shared/types/window';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';

// Import the handlers to test
import { registerWindowHandlers, broadcastStateChange } from '../window-handlers';

// Mock WindowManager
const mockWindowManager = {
  popOutProject: vi.fn(),
  popOutView: vi.fn(),
  mergeWindow: vi.fn(),
  getAllWindows: vi.fn(),
  getWindowConfig: vi.fn(),
  focusWindow: vi.fn(),
  broadcastStateChange: vi.fn(),
};

vi.mock('../../window-manager', () => ({
  WindowManager: {
    getInstance: () => mockWindowManager,
  },
}));

// Helper to create a mock WebContents event
function createMockEvent(windowId?: number) {
  const mockWindow = new BrowserWindow();
  if (windowId !== undefined) {
    mockWindow.id = windowId;
  }

  return {
    sender: mockWindow.webContents,
  };
}

describe('Window IPC Handlers', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Reset BrowserWindow static state
    (BrowserWindow as any).nextId = 1;
    (BrowserWindow as any).instances = [];

    // Reset static method mocks
    vi.mocked(BrowserWindow.fromWebContents).mockImplementation((webContents: unknown) => {
      const instances = (BrowserWindow as any).instances || [];
      return instances.find((w: BrowserWindow) => w.webContents === webContents) || null;
    });

    vi.mocked(BrowserWindow.fromId).mockImplementation((id: number) => {
      const instances = (BrowserWindow as any).instances || [];
      return instances.find((w: BrowserWindow) => w.id === id) || null;
    });

    vi.mocked(BrowserWindow.getAllWindows).mockImplementation(() => {
      const instances = (BrowserWindow as any).instances || [];
      return instances.filter((w: BrowserWindow) => !w.isDestroyed());
    });

    // Register handlers before each test
    registerWindowHandlers();
  });

  afterEach(() => {
    // Clean up handlers after each test
    const handlers = (ipcMain as any).handlers;
    handlers.clear();
  });

  describe('window:pop-out-project', () => {
    it('should successfully pop out a project', async () => {
      const projectId = 'project-123';
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.popOutProject.mockResolvedValue({ windowId });

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        projectId
      );

      expect(result).toEqual({
        success: true,
        windowId,
      });
      expect(mockWindowManager.popOutProject).toHaveBeenCalledWith(
        projectId,
        expect.any(BrowserWindow)
      );
    });

    it('should handle ALREADY_POPPED_OUT error by returning existing window ID', async () => {
      const projectId = 'project-123';
      const existingWindowId = 3;
      const mockEvent = createMockEvent(1);

      const error = {
        code: 'ALREADY_POPPED_OUT',
        message: 'Project already popped out',
        existingWindowId,
      };
      mockWindowManager.popOutProject.mockRejectedValue(error);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        projectId
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'ALREADY_POPPED_OUT',
          message: 'Project already popped out',
          existingWindowId,
        },
      });
    });

    it('should handle generic errors', async () => {
      const projectId = 'project-123';
      const mockEvent = createMockEvent(1);

      mockWindowManager.popOutProject.mockRejectedValue(new Error('Window creation failed'));

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        projectId
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'WINDOW_CREATION_FAILED',
          message: 'Window creation failed',
        },
      });
    });

    it('should handle missing source window', async () => {
      const projectId = 'project-123';
      const mockEvent = { sender: null };

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        projectId
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'WINDOW_CREATION_FAILED',
          message: 'Source window not found',
        },
      });
    });
  });

  describe('window:pop-out-view', () => {
    it('should successfully pop out a view', async () => {
      const projectId = 'project-123';
      const view = 'terminals';
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.popOutView.mockResolvedValue({ windowId });

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_VIEW,
        mockEvent,
        projectId,
        view
      );

      expect(result).toEqual({
        success: true,
        windowId,
      });
      expect(mockWindowManager.popOutView).toHaveBeenCalledWith(
        projectId,
        view,
        expect.any(BrowserWindow)
      );
    });

    it('should handle ALREADY_POPPED_OUT error by returning existing window ID', async () => {
      const projectId = 'project-123';
      const view = 'terminals';
      const existingWindowId = 3;
      const mockEvent = createMockEvent(1);

      const error = {
        code: 'ALREADY_POPPED_OUT',
        message: 'View already popped out',
        existingWindowId,
      };
      mockWindowManager.popOutView.mockRejectedValue(error);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_VIEW,
        mockEvent,
        projectId,
        view
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'ALREADY_POPPED_OUT',
          message: 'View already popped out',
          existingWindowId,
        },
      });
    });

    it('should handle generic errors', async () => {
      const projectId = 'project-123';
      const view = 'terminals';
      const mockEvent = createMockEvent(1);

      mockWindowManager.popOutView.mockRejectedValue(new Error('Failed to create view window'));

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_VIEW,
        mockEvent,
        projectId,
        view
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'WINDOW_CREATION_FAILED',
          message: 'Failed to create view window',
        },
      });
    });
  });

  describe('window:merge-window', () => {
    it('should successfully merge a window', async () => {
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.mergeWindow.mockResolvedValue(undefined);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_MERGE_WINDOW,
        mockEvent,
        windowId
      );

      expect(result).toEqual({ success: true });
      expect(mockWindowManager.mergeWindow).toHaveBeenCalledWith(windowId);
    });

    it('should handle merge errors', async () => {
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.mergeWindow.mockRejectedValue(new Error('Window not found'));

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_MERGE_WINDOW,
        mockEvent,
        windowId
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'MERGE_FAILED',
          message: 'Window not found',
        },
      });
    });
  });

  describe('window:get-windows', () => {
    it('should return list of all windows', async () => {
      const mockEvent = createMockEvent(1);
      const mockWindows: WindowConfig[] = [
        {
          windowId: 1,
          type: 'main',
          bounds: { x: 0, y: 0, width: 1400, height: 900 },
        },
        {
          windowId: 2,
          type: 'project',
          projectId: 'project-123',
          bounds: { x: 100, y: 100, width: 1200, height: 800 },
          parentWindowId: 1,
        },
      ];

      mockWindowManager.getAllWindows.mockReturnValue(mockWindows);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_GET_WINDOWS,
        mockEvent
      );

      expect(result).toEqual({
        success: true,
        windows: mockWindows,
      });
    });

    it('should handle errors when getting windows', async () => {
      const mockEvent = createMockEvent(1);

      mockWindowManager.getAllWindows.mockImplementation(() => {
        throw new Error('Failed to get windows');
      });

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_GET_WINDOWS,
        mockEvent
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'GET_WINDOWS_FAILED',
          message: 'Failed to get windows',
        },
      });
    });
  });

  describe('window:get-config', () => {
    it('should return current window configuration', async () => {
      const mockEvent = createMockEvent(1);
      const mockConfig: WindowConfig = {
        windowId: 1,
        type: 'main',
        bounds: { x: 0, y: 0, width: 1400, height: 900 },
      };

      mockWindowManager.getWindowConfig.mockReturnValue(mockConfig);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_GET_CONFIG,
        mockEvent
      );

      expect(result).toEqual({
        success: true,
        config: mockConfig,
      });
      expect(mockWindowManager.getWindowConfig).toHaveBeenCalledWith(1);
    });

    it('should handle missing window configuration', async () => {
      const mockEvent = createMockEvent(1);

      mockWindowManager.getWindowConfig.mockReturnValue(null);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_GET_CONFIG,
        mockEvent
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'GET_CONFIG_FAILED',
          message: 'Window configuration not found',
        },
      });
    });

    it('should handle missing source window', async () => {
      const mockEvent = { sender: null };

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_GET_CONFIG,
        mockEvent
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'GET_CONFIG_FAILED',
          message: 'Source window not found',
        },
      });
    });
  });

  describe('window:focus-window', () => {
    it('should successfully focus a window', async () => {
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.focusWindow.mockReturnValue(undefined);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_FOCUS_WINDOW,
        mockEvent,
        windowId
      );

      expect(result).toEqual({ success: true });
      expect(mockWindowManager.focusWindow).toHaveBeenCalledWith(windowId);
    });

    it('should handle focus errors', async () => {
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.focusWindow.mockImplementation(() => {
        throw new Error('Window not found');
      });

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_FOCUS_WINDOW,
        mockEvent,
        windowId
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'FOCUS_FAILED',
          message: 'Window not found',
        },
      });
    });
  });

  describe('broadcastWindowConfigChange', () => {
    it('should broadcast window config changes to all windows', async () => {
      const mockWindows: WindowConfig[] = [
        { windowId: 1, type: 'main' },
        { windowId: 2, type: 'project', projectId: 'project-123' },
      ];

      mockWindowManager.getAllWindows.mockReturnValue(mockWindows);

      // Create mock browser windows
      const window1 = new BrowserWindow();
      const window2 = new BrowserWindow();

      // Override getAllWindows to return our specific windows
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([window1, window2]);

      // Trigger a pop-out which should broadcast config changes
      const mockEvent = createMockEvent();
      mockWindowManager.popOutProject.mockResolvedValue({ windowId: 2 });

      await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        'project-123'
      );

      // Verify broadcast was sent to all windows
      expect(window1.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.WINDOW_CONFIG_CHANGED,
        mockWindows
      );
      expect(window2.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.WINDOW_CONFIG_CHANGED,
        mockWindows
      );
    });

    it('should not send to destroyed windows', async () => {
      const mockWindows: WindowConfig[] = [
        { windowId: 1, type: 'main' },
      ];

      mockWindowManager.getAllWindows.mockReturnValue(mockWindows);

      // Create a destroyed window
      const destroyedWindow = new BrowserWindow();
      vi.mocked(destroyedWindow.isDestroyed).mockReturnValue(true);

      const activeWindow = new BrowserWindow();
      vi.mocked(activeWindow.isDestroyed).mockReturnValue(false);

      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([destroyedWindow, activeWindow]);

      // Trigger merge which should broadcast config changes
      const mockEvent = createMockEvent();
      mockWindowManager.mergeWindow.mockResolvedValue(undefined);

      await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_MERGE_WINDOW,
        mockEvent,
        2
      );

      // Verify broadcast was NOT sent to destroyed window
      expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();

      // Verify broadcast WAS sent to active window
      expect(activeWindow.webContents.send).toHaveBeenCalledWith(
        IPC_CHANNELS.WINDOW_CONFIG_CHANGED,
        mockWindows
      );
    });
  });

  describe('broadcastStateChange', () => {
    it('should broadcast global state changes to all windows', () => {
      const globalState: GlobalState = {
        type: 'auth',
        data: { userId: '123', token: 'abc' },
      };

      broadcastStateChange(globalState);

      expect(mockWindowManager.broadcastStateChange).toHaveBeenCalledWith(globalState);
    });

    it('should handle settings state changes', () => {
      const globalState: GlobalState = {
        type: 'settings',
        data: { theme: 'dark', language: 'en' },
      };

      broadcastStateChange(globalState);

      expect(mockWindowManager.broadcastStateChange).toHaveBeenCalledWith(globalState);
    });

    it('should handle projects state changes', () => {
      const globalState: GlobalState = {
        type: 'projects',
        data: [{ id: 'project-1', name: 'Test Project' }],
      };

      broadcastStateChange(globalState);

      expect(mockWindowManager.broadcastStateChange).toHaveBeenCalledWith(globalState);
    });
  });

  describe('error handling edge cases', () => {
    it('should handle ALREADY_POPPED_OUT error without existingWindowId', async () => {
      const projectId = 'project-123';
      const mockEvent = createMockEvent(1);

      const error = {
        code: 'ALREADY_POPPED_OUT',
        message: 'Project already popped out',
        // No existingWindowId
      };
      mockWindowManager.popOutProject.mockRejectedValue(error);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        projectId
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('ALREADY_POPPED_OUT');
      expect(result.error.existingWindowId).toBeUndefined();
    });

    it('should handle non-Error objects thrown', async () => {
      const projectId = 'project-123';
      const mockEvent = createMockEvent(1);

      mockWindowManager.popOutProject.mockRejectedValue('string error');

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_POP_OUT_PROJECT,
        mockEvent,
        projectId
      );

      expect(result).toEqual({
        success: false,
        error: {
          code: 'WINDOW_CREATION_FAILED',
          message: 'Failed to create window',
        },
      });
    });

    it('should handle null errors', async () => {
      const windowId = 2;
      const mockEvent = createMockEvent(1);

      mockWindowManager.mergeWindow.mockRejectedValue(null);

      const result = await (ipcMain as any).invokeHandler(
        IPC_CHANNELS.WINDOW_MERGE_WINDOW,
        mockEvent,
        windowId
      );

      expect(result.success).toBe(false);
      expect(result.error.code).toBe('MERGE_FAILED');
    });
  });
});
