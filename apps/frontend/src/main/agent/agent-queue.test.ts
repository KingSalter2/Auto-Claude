/**
 * Tests for AgentQueueManager
 */

import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'events';
import { AgentQueueManager } from './agent-queue';
import { AgentState } from './agent-state';
import { AgentEvents } from './agent-events';
import { AgentProcessManager } from './agent-process';
import { SpawnQueue } from './spawn-queue';

describe('AgentQueueManager', () => {
  it('should initialize SpawnQueue instance', () => {
    // Create minimal dependencies for testing
    const mockState = {} as unknown as AgentState;
    const mockEvents = {} as unknown as AgentEvents;
    const mockProcessManager = {
      ensurePythonEnvReady: async () => ({ ready: true }),
      getAutoBuildSourcePath: () => '/mock/path'
    } as unknown as AgentProcessManager;
    const mockEmitter = new EventEmitter();

    // Instantiate AgentQueueManager
    const manager = new AgentQueueManager(
      mockState,
      mockEvents,
      mockProcessManager,
      mockEmitter
    );

    // Access private property via type assertion
    const spawnQueue = (manager as unknown as { spawnQueue: SpawnQueue }).spawnQueue;

    // Verify spawnQueue is a SpawnQueue instance
    expect(spawnQueue).toBeDefined();
    expect(spawnQueue).toBeInstanceOf(SpawnQueue);
  });

  it('should initialize SpawnQueue with empty queue', () => {
    const mockState = {} as unknown as AgentState;
    const mockEvents = {} as unknown as AgentEvents;
    const mockProcessManager = {
      ensurePythonEnvReady: async () => ({ ready: true }),
      getAutoBuildSourcePath: () => '/mock/path'
    } as unknown as AgentProcessManager;
    const mockEmitter = new EventEmitter();

    const manager = new AgentQueueManager(
      mockState,
      mockEvents,
      mockProcessManager,
      mockEmitter
    );

    const spawnQueue = (manager as unknown as { spawnQueue: SpawnQueue }).spawnQueue;

    // Verify initial queue state
    expect(spawnQueue.length).toBe(0);
    expect(spawnQueue.isProcessing).toBe(false);
  });

  it('should route ideation and roadmap spawns correctly', async () => {
    const mockState = {} as unknown as AgentState;
    const mockEvents = {} as unknown as AgentEvents;
    const mockProcessManager = {
      ensurePythonEnvReady: async () => ({ ready: true }),
      getAutoBuildSourcePath: () => '/mock/path',
      getPythonPath: () => 'python3',
      killProcess: () => false,
      getCombinedEnv: () => ({}),
      state: { addProcess: () => {}, deleteProcess: () => {} }
    } as unknown as AgentProcessManager;

    // Mock state methods
    const mockStateWithMethods = {
      generateSpawnId: () => 1,
      addProcess: () => {},
      wasSpawnKilled: () => false,
      clearKilledSpawn: () => {},
      getProcess: () => null,
      deleteProcess: () => {}
    } as unknown as AgentState;

    const mockEmitter = new EventEmitter();

    const manager = new AgentQueueManager(
      mockStateWithMethods,
      mockEvents,
      mockProcessManager,
      mockEmitter
    );

    const spawnQueue = (manager as unknown as { spawnQueue: SpawnQueue }).spawnQueue;

    // Test that spawn function routes correctly
    let processType: string | undefined;

    // Mock the spawn function to capture the type
    const originalEnqueue = spawnQueue.enqueue.bind(spawnQueue);
    spawnQueue.enqueue = function(request) {
      processType = request.type;
      return Promise.resolve(undefined);
    };

    // Access private methods via type assertion
    const spawnIdeationProcess = (manager as unknown as { spawnIdeationProcess: (id: string, path: string, args: string[]) => Promise<void> }).spawnIdeationProcess;
    const spawnRoadmapProcess = (manager as unknown as { spawnRoadmapProcess: (id: string, path: string, args: string[]) => Promise<void> }).spawnRoadmapProcess;

    // Test ideation spawn
    await spawnIdeationProcess.call(manager, 'project-1', '/path/to/project', ['ideation']);
    expect(processType).toBe('ideation');

    // Test roadmap spawn
    await spawnRoadmapProcess.call(manager, 'project-2', '/path/to/project2', ['roadmap']);
    expect(processType).toBe('roadmap');
  });
});
