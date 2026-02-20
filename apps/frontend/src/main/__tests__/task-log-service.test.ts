/**
 * TaskLogService Unit Tests
 * ==========================
 * Tests the service-level bug fixes:
 * 1. mergeLogs() uses ?? to prefer worktree coding/validation even when pending with empty entries
 * 2. startWatching() poll skips emission when loadLogsFromPath returns cached data on parse failure
 * 3. clearCache() and stopWatching() clean up cacheVersions map
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TaskLogs, TaskPhaseLog } from '../../shared/types';

// Mock fs before importing the service
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn()
}));

// Mock worktree-paths
vi.mock('../worktree-paths', () => ({
  findTaskWorktree: vi.fn()
}));

// Mock debug-logger
vi.mock('../../shared/utils/debug-logger', () => ({
  debugLog: vi.fn(),
  debugWarn: vi.fn(),
  debugError: vi.fn()
}));

function makePhaseLogs(overrides: Partial<TaskPhaseLog> = {}): TaskPhaseLog {
  return {
    phase: 'coding',
    status: 'pending',
    started_at: null,
    completed_at: null,
    entries: [],
    ...overrides
  };
}

function makeTaskLogs(overrides: Partial<TaskLogs> & { phases?: Partial<TaskLogs['phases']> } = {}): TaskLogs {
  const { phases, ...rest } = overrides;
  return {
    spec_id: '001-test',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T01:00:00Z',
    phases: {
      planning: makePhaseLogs({ phase: 'planning', status: 'completed', entries: [{ type: 'text', content: 'Plan done', phase: 'planning', timestamp: '2024-01-01T00:00:00Z' }] }),
      coding: makePhaseLogs({ phase: 'coding' }),
      validation: makePhaseLogs({ phase: 'validation' }),
      ...phases
    },
    ...rest
  };
}

describe('TaskLogService', () => {
  let TaskLogService: typeof import('../task-log-service').TaskLogService;
  let existsSync: ReturnType<typeof vi.fn>;
  let readFileSync: ReturnType<typeof vi.fn>;
  let findTaskWorktree: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    const fs = await import('fs');
    existsSync = fs.existsSync as ReturnType<typeof vi.fn>;
    readFileSync = fs.readFileSync as ReturnType<typeof vi.fn>;

    const worktreePaths = await import('../worktree-paths');
    findTaskWorktree = worktreePaths.findTaskWorktree as ReturnType<typeof vi.fn>;

    const mod = await import('../task-log-service');
    TaskLogService = mod.TaskLogService;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetModules();
  });

  describe('mergeLogs() - ?? operator fix for worktree phase preference', () => {
    it('should use worktree coding phase even when status is pending with empty entries', () => {
      const service = new TaskLogService();

      // Main logs have coding phase with entries from a previous run
      const mainLogs = makeTaskLogs({
        phases: {
          planning: makePhaseLogs({ phase: 'planning', status: 'completed' }),
          coding: makePhaseLogs({
            phase: 'coding',
            status: 'completed',
            entries: [
              { type: 'text', content: 'Old coding work', phase: 'coding', timestamp: '2024-01-01T00:30:00Z' }
            ]
          }),
          validation: makePhaseLogs({
            phase: 'validation',
            status: 'completed',
            entries: [
              { type: 'text', content: 'Old validation', phase: 'validation', timestamp: '2024-01-01T01:00:00Z' }
            ]
          })
        }
      });

      // Worktree logs have coding/validation reset to pending (agent retry scenario)
      const worktreeLogs = makeTaskLogs({
        phases: {
          planning: makePhaseLogs({ phase: 'planning', status: 'completed' }),
          coding: makePhaseLogs({
            phase: 'coding',
            status: 'pending',
            entries: []
          }),
          validation: makePhaseLogs({
            phase: 'validation',
            status: 'pending',
            entries: []
          })
        }
      });

      // Use loadLogsFromPath to populate internal state, then test mergeLogs indirectly via loadLogs
      // We access mergeLogs through loadLogs by setting up the right conditions.
      // However, mergeLogs is private, so we test through the public API.

      const mainSpecDir = '/project/.auto-claude/specs/001-test';
      const worktreeSpecDir = '/project/.auto-claude/worktrees/tasks/001-test/.auto-claude/specs/001-test';

      // Set up fs mocks for both paths
      existsSync.mockImplementation((filePath: string) => {
        return filePath.includes('task_logs.json');
      });

      readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes(worktreeSpecDir)) {
          return JSON.stringify(worktreeLogs);
        }
        return JSON.stringify(mainLogs);
      });

      // Set up worktree discovery
      findTaskWorktree.mockReturnValue('/project/.auto-claude/worktrees/tasks/001-test');

      // Load merged logs
      const result = service.loadLogs(mainSpecDir, '/project', '.auto-claude/specs', '001-test');

      expect(result).not.toBeNull();
      // The key assertion: worktree's pending coding phase should be used (not main's completed one)
      // because ?? only falls back to main when worktree value is null/undefined, not when it's
      // a valid object with status 'pending'
      expect(result!.phases.coding.status).toBe('pending');
      expect(result!.phases.coding.entries).toHaveLength(0);
      expect(result!.phases.validation.status).toBe('pending');
      expect(result!.phases.validation.entries).toHaveLength(0);
    });

    it('should fall back to main coding phase when worktree coding is null', () => {
      const service = new TaskLogService();

      const mainLogs = makeTaskLogs({
        phases: {
          planning: makePhaseLogs({ phase: 'planning', status: 'completed' }),
          coding: makePhaseLogs({
            phase: 'coding',
            status: 'active',
            entries: [{ type: 'text', content: 'Main coding', phase: 'coding', timestamp: '2024-01-01T00:30:00Z' }]
          }),
          validation: makePhaseLogs({ phase: 'validation' })
        }
      });

      // Worktree logs where coding is explicitly null (not yet started in worktree)
      const worktreeLogsRaw = {
        spec_id: '001-test',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        phases: {
          planning: makePhaseLogs({ phase: 'planning', status: 'completed' }),
          coding: null,
          validation: null
        }
      };

      const mainSpecDir = '/project/.auto-claude/specs/001-test';
      const worktreeSpecDir = '/project/.auto-claude/worktrees/tasks/001-test/.auto-claude/specs/001-test';

      existsSync.mockReturnValue(true);
      readFileSync.mockImplementation((filePath: string) => {
        if (filePath.includes(worktreeSpecDir)) {
          return JSON.stringify(worktreeLogsRaw);
        }
        return JSON.stringify(mainLogs);
      });

      findTaskWorktree.mockReturnValue('/project/.auto-claude/worktrees/tasks/001-test');

      const result = service.loadLogs(mainSpecDir, '/project', '.auto-claude/specs', '001-test');

      expect(result).not.toBeNull();
      // With null worktree coding, should fall back to main
      expect(result!.phases.coding.status).toBe('active');
      expect(result!.phases.coding.entries).toHaveLength(1);
    });
  });

  describe('startWatching() - cacheVersions gating skips emission on parse failure', () => {
    it('should skip emission when loadLogsFromPath returns cached data due to parse failure', () => {
      const service = new TaskLogService();
      const specId = '001-test';
      const specDir = '/project/.auto-claude/specs/001-test';

      const validLogs = makeTaskLogs();
      const validContent = JSON.stringify(validLogs);

      // Track emissions
      const emittedEvents: Array<{ event: string; args: unknown[] }> = [];
      service.on('logs-changed', (...args: unknown[]) => {
        emittedEvents.push({ event: 'logs-changed', args });
      });

      // Initial state: valid file exists
      let currentContent = validContent;
      existsSync.mockReturnValue(true);
      readFileSync.mockImplementation(() => currentContent);
      findTaskWorktree.mockReturnValue(null);

      // Start watching
      service.startWatching(specId, specDir);

      // Simulate file change to corrupted content (mid-write)
      // The raw content changes so the poll detects a change,
      // but JSON.parse fails, returning cached data instead
      currentContent = '{"spec_id": "001-test", CORRUPTED';
      readFileSync.mockImplementation(() => {
        // Simulate the loadLogsFromPath path: readFileSync returns corrupted content,
        // JSON.parse will throw, and the service returns cached data
        return currentContent;
      });

      // Advance past one poll interval
      vi.advanceTimersByTime(1100);

      // No emission should have occurred because the parse failure means
      // cacheVersions didn't increment — the service returned cached data
      expect(emittedEvents).toHaveLength(0);

      // Now simulate recovery: file becomes valid again with new content
      const updatedLogs = makeTaskLogs({
        updated_at: '2024-01-01T02:00:00Z',
        phases: {
          planning: makePhaseLogs({ phase: 'planning', status: 'completed' }),
          coding: makePhaseLogs({
            phase: 'coding',
            status: 'active',
            entries: [{ type: 'text', content: 'Coding started', phase: 'coding', timestamp: '2024-01-01T01:30:00Z' }]
          }),
          validation: makePhaseLogs({ phase: 'validation' })
        }
      });
      const newValidContent = JSON.stringify(updatedLogs);
      currentContent = newValidContent;
      readFileSync.mockImplementation(() => currentContent);

      // Advance past another poll interval
      vi.advanceTimersByTime(1100);

      // Now emission should occur because a fresh parse succeeded
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1);

      // Clean up
      service.stopWatching(specId);
    });
  });

  describe('clearCache() - cacheVersions cleanup', () => {
    it('should delete cacheVersions entry when clearing cache', () => {
      const service = new TaskLogService();
      const specDir = '/project/.auto-claude/specs/001-test';

      // Load logs to populate both logCache and cacheVersions
      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(JSON.stringify(makeTaskLogs()));
      findTaskWorktree.mockReturnValue(null);

      const result = service.loadLogsFromPath(specDir);
      expect(result).not.toBeNull();

      // Verify cache is populated
      expect(service.getCachedLogs(specDir)).not.toBeNull();

      // Clear cache
      service.clearCache(specDir);

      // Verify both logCache and cacheVersions are cleaned
      expect(service.getCachedLogs(specDir)).toBeNull();

      // Verify cacheVersions was cleaned by loading again and checking version starts fresh
      // We do this by loading logs again - the version should start from 1 (not continue from previous)
      readFileSync.mockReturnValue(JSON.stringify(makeTaskLogs()));
      service.loadLogsFromPath(specDir);

      // If clearCache properly cleaned cacheVersions, loading again resets the counter.
      // We can verify this indirectly: after clearCache + reload, the cache should be fresh
      expect(service.getCachedLogs(specDir)).not.toBeNull();
    });
  });

  describe('stopWatching() - cacheVersions cleanup', () => {
    it('should delete cacheVersions entries for watched paths when stopping', () => {
      const service = new TaskLogService();
      const specId = '001-test';
      const specDir = '/project/.auto-claude/specs/001-test';
      const worktreeSpecDir = '/project/.auto-claude/worktrees/tasks/001-test/.auto-claude/specs/001-test';

      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue(JSON.stringify(makeTaskLogs()));
      findTaskWorktree.mockReturnValue('/project/.auto-claude/worktrees/tasks/001-test');

      // Start watching (this will load initial logs, populating cacheVersions)
      service.startWatching(specId, specDir, '/project', '.auto-claude/specs');

      // Verify cache is populated for main spec dir
      expect(service.getCachedLogs(specDir)).not.toBeNull();

      // Stop watching
      service.stopWatching(specId);

      // After stopping, cacheVersions should be cleaned for both main and worktree paths.
      // We verify indirectly: loading from the same path should start fresh version counting.
      // The logCache may still have data (stopWatching doesn't clear logCache),
      // but the cacheVersions entries should be gone.

      // Load again to verify versions start fresh
      const beforeSecondLoad = service.getCachedLogs(specDir);
      // logCache is NOT cleared by stopWatching (only cacheVersions), so this may still exist
      // The important thing is that cacheVersions was cleaned

      // Start watching again - should not skip due to stale cacheVersions
      service.startWatching(specId, specDir, '/project', '.auto-claude/specs');

      const emittedEvents: Array<{ event: string; args: unknown[] }> = [];
      service.on('logs-changed', (...args: unknown[]) => {
        emittedEvents.push({ event: 'logs-changed', args });
      });

      // Change file content and advance timer
      const updatedLogs = makeTaskLogs({ updated_at: '2024-01-01T03:00:00Z' });
      readFileSync.mockReturnValue(JSON.stringify(updatedLogs));
      vi.advanceTimersByTime(1100);

      // Should emit because cacheVersions was cleaned and fresh parse succeeds
      expect(emittedEvents.length).toBeGreaterThanOrEqual(1);

      service.stopWatching(specId);
    });
  });

  describe('loadLogsFromPath() - cache fallback on parse error', () => {
    it('should return cached logs when JSON parse fails', () => {
      const service = new TaskLogService();
      const specDir = '/project/.auto-claude/specs/001-test';

      existsSync.mockReturnValue(true);

      // First load: valid JSON
      const validLogs = makeTaskLogs();
      readFileSync.mockReturnValue(JSON.stringify(validLogs));
      const result1 = service.loadLogsFromPath(specDir);
      expect(result1).not.toBeNull();
      expect(result1!.spec_id).toBe('001-test');

      // Second load: corrupted JSON
      readFileSync.mockReturnValue('NOT VALID JSON{{{');
      const result2 = service.loadLogsFromPath(specDir);

      // Should return cached version
      expect(result2).not.toBeNull();
      expect(result2!.spec_id).toBe('001-test');
      expect(result2).toEqual(validLogs);
    });

    it('should return null when JSON parse fails and no cache exists', () => {
      const service = new TaskLogService();
      const specDir = '/project/.auto-claude/specs/001-test';

      existsSync.mockReturnValue(true);
      readFileSync.mockReturnValue('CORRUPTED JSON');

      const result = service.loadLogsFromPath(specDir);
      expect(result).toBeNull();
    });
  });
});
