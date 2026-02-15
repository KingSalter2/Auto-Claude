/**
 * Integration Stress Test for Sequential Agent Spawning
 *
 * Verifies that SpawnQueue prevents ~/.claude.json file corruption under concurrent load.
 * Tests rapid spawning of multiple agents and verifies sequential execution.
 *
 * Key scenarios:
 * - Stress test: 10 agents spawned rapidly
 * - Sequential verification: agents don't overlap
 * - Queue state consistency during high load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpawnQueue, type SpawnFunction } from './spawn-queue';
import type { ChildProcess } from 'child_process';
import type { Readable, Writable } from 'stream';

describe('Sequential Agent Spawning - Integration Stress Test', () => {
  let queue: SpawnQueue;
  let mockSpawnFn: SpawnFunction;
  let concurrentProcesses: Map<string, { start: number; end: number }>;

  /**
   * Create a mock child process that exits after a delay
   * Tracks start/end times for overlap detection
   */
  const createMockProcess = (
    id: string,
    exitDelay: number = 10
  ): ChildProcess => {
    const startTime = Date.now();

    const process = {
      on: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          setTimeout(() => {
            const endTime = Date.now();
            concurrentProcesses.set(id, { start: startTime, end: endTime });
            callback(0);
          }, exitDelay);
        }
        return process;
      }),
      once: vi.fn((event: string, callback: (...args: unknown[]) => void) => {
        if (event === 'exit') {
          setTimeout(() => {
            const endTime = Date.now();
            concurrentProcesses.set(id, { start: startTime, end: endTime });
            callback(0);
          }, exitDelay);
        }
        return process;
      }),
      kill: vi.fn(),
      pid: Math.floor(Math.random() * 100000),
      exitCode: null,
      signalCode: null,
      stdin: null,
      stdout: null,
      stderr: null,
      stdio: [null, null, null] as [
        Writable | null,
        Readable | null,
        Readable | null
      ],
      connected: false
    } as unknown as ChildProcess;

    return process;
  };

  /**
   * Helper to create a spawn request
   */
  const createRequest = (
    id: string,
    exitDelay: number = 10
  ) => ({
    id,
    type: 'test',
    onSpawn: vi.fn(async () => {}),
    onError: vi.fn(),
    projectId: `project-${id}`,
    projectPath: `/test/path/${id}`,
    args: ['--test', id],
    env: { TEST_ID: id },
    cwd: '/test/cwd'
  });

  beforeEach(() => {
    concurrentProcesses = new Map();

    // Mock spawn function that creates processes with different exit delays
    mockSpawnFn = vi.fn(async (id: string) => {
      // Vary exit delay slightly to simulate real-world conditions
      const delay = 10 + Math.random() * 20;
      return createMockProcess(id, delay);
    }) as SpawnFunction;

    queue = new SpawnQueue(mockSpawnFn);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Stress Test - Rapid Concurrent Spawns', () => {
    it('should handle 10 rapid spawn requests without corruption', async () => {
      const numAgents = 10;
      const executionOrder: string[] = [];

      // Enqueue 10 agents rapidly
      for (let i = 0; i < numAgents; i++) {
        const id = `agent-${i}`;
        const request = createRequest(id);
        request.onSpawn = vi.fn(async () => {
          executionOrder.push(id);
        });
        queue.enqueue(request);
      }

      // Wait for all to complete
      await queue.drain();

      // Verify all agents executed
      expect(executionOrder).toHaveLength(numAgents);

      // Verify FIFO order
      for (let i = 0; i < numAgents; i++) {
        expect(executionOrder[i]).toBe(`agent-${i}`);
      }

      // Verify all spawn functions were called
      expect(mockSpawnFn).toHaveBeenCalledTimes(numAgents);
    });

    it('should maintain queue integrity under high load', async () => {
      const numAgents = 10;
      let maxLengthDuringProcessing = 0;

      // Create a request that tracks queue length during processing
      const createTrackingRequest = (id: string) => {
        const request = createRequest(id);
        const originalOnSpawn = request.onSpawn;

        request.onSpawn = vi.fn(async () => {
          // Track max queue length during processing
          if (queue.length > maxLengthDuringProcessing) {
            maxLengthDuringProcessing = queue.length;
          }
          await originalOnSpawn();
        });

        return request;
      };

      // Enqueue all agents rapidly
      for (let i = 0; i < numAgents; i++) {
        queue.enqueue(createTrackingRequest(`agent-${i}`));
      }

      await queue.drain();

      // Verify queue eventually emptied
      expect(queue.length).toBe(0);
      expect(queue.isProcessing).toBe(false);

      // Verify queue held pending items during processing
      expect(maxLengthDuringProcessing).toBeGreaterThan(0);
    });
  });

  describe('Sequential Verification - No Overlap', () => {
    it('should ensure agents execute sequentially without overlap', async () => {
      const numAgents = 5;

      // Enqueue agents with varying delays
      for (let i = 0; i < numAgents; i++) {
        queue.enqueue(createRequest(`agent-${i}`, 20));
      }

      await queue.drain();

      // Verify we tracked all agents
      expect(concurrentProcesses.size).toBe(numAgents);

      // Check for overlaps: each agent should finish before the next starts
      const sortedEntries = Array.from(concurrentProcesses.entries()).sort(
        (a, b) => a[1].start - b[1].start
      );

      for (let i = 0; i < sortedEntries.length - 1; i++) {
        const [currentId, currentTimes] = sortedEntries[i];
        const [nextId, nextTimes] = sortedEntries[i + 1];

        // Next agent should start after current agent finishes
        expect(nextTimes.start).toBeGreaterThanOrEqual(currentTimes.end);

        // Log for debugging
        const currentDuration = currentTimes.end - currentTimes.start;
        const gap = nextTimes.start - currentTimes.end;
        console.log(
          `${currentId}: ${currentDuration}ms, gap to ${nextId}: ${gap}ms`
        );
      }
    });

    it('should track start and end times accurately', async () => {
      const testId = 'test-agent';
      let spawnedTime: number | null = null;

      // Create a request that tracks timing
      const request = createRequest(testId, 30);

      // Override mockSpawnFn to track timing more accurately
      mockSpawnFn = vi.fn(async () => {
        const startTime = Date.now();
        const process = createMockProcess(testId, 30);

        // Track when the process is spawned
        request.onSpawn = vi.fn(async () => {
          spawnedTime = startTime;
        });

        return process;
      }) as SpawnFunction;

      queue = new SpawnQueue(mockSpawnFn);
      queue.enqueue(request);

      await queue.drain();

      // Verify spawn time was captured
      expect(spawnedTime).not.toBeNull();

      // Verify the process completed
      const times = concurrentProcesses.get(testId);
      expect(times).toBeDefined();

      // Exit should be after spawn
      expect(times!.end).toBeGreaterThanOrEqual(spawnedTime!);

      console.log(
        `Agent ${testId}: spawned at ${spawnedTime}, exited at ${times!.end}`
      );
    });
  });

  describe('Error Recovery Under Load', () => {
    it('should continue processing after failures', async () => {
      const successCount: string[] = [];
      const failureCount: string[] = [];

      const createFailableRequest = (id: string, shouldFail: boolean) => {
        const request = createRequest(id);
        request.onSpawn = vi.fn(async () => {
          if (shouldFail) {
            throw new Error(`Simulated failure for ${id}`);
          }
          successCount.push(id);
        });
        request.onError = vi.fn((error: Error) => {
          failureCount.push(id);
          expect(error.message).toContain('Simulated failure');
        });
        return request;
      };

      // Enqueue mix of successful and failing requests
      queue.enqueue(createFailableRequest('agent-1', false));
      queue.enqueue(createFailableRequest('agent-2', true));
      queue.enqueue(createFailableRequest('agent-3', false));
      queue.enqueue(createFailableRequest('agent-4', true));
      queue.enqueue(createFailableRequest('agent-5', false));

      await queue.drain();

      // Verify all were processed
      expect(successCount).toHaveLength(3);
      expect(failureCount).toHaveLength(2);

      // Verify processing continued despite failures
      expect(successCount).toEqual(['agent-1', 'agent-3', 'agent-5']);
      expect(failureCount).toEqual(['agent-2', 'agent-4']);
    });

    it('should handle all failures gracefully', async () => {
      const numAgents = 5;
      const errors: string[] = [];

      const createFailingRequest = (id: string) => {
        const request = createRequest(id);
        request.onSpawn = vi.fn(async () => {
          throw new Error(`Failure ${id}`);
        });
        request.onError = vi.fn((error: Error) => {
          errors.push(id);
        });
        return request;
      };

      // All requests fail
      for (let i = 0; i < numAgents; i++) {
        queue.enqueue(createFailingRequest(`agent-${i}`));
      }

      await queue.drain();

      // Verify all errors were handled
      expect(errors).toHaveLength(numAgents);

      // Queue should still be empty and not processing
      expect(queue.length).toBe(0);
      expect(queue.isProcessing).toBe(false);
    });
  });

  describe('Real-World Scenario Simulation', () => {
    it('should simulate user rapidly triggering multiple ideations', async () => {
      const userTriggeredIdeations: string[] = [];

      // Simulate user clicking "Generate Ideation" 5 times rapidly
      const triggerIdeation = async (index: number) => {
        const projectId = `project-${index}`;
        userTriggeredIdeations.push(projectId);

        queue.enqueue({
          id: `ideation-${index}`,
          type: 'ideation',
          projectId,
          projectPath: `/projects/${projectId}`,
          args: ['--ideation', '--types', 'improvements,performance'],
          env: { PROJECT_ID: projectId },
          cwd: '/auto-claude',
          onSpawn: vi.fn(async () => {
            console.log(`[Simulation] Ideation spawned for ${projectId}`);
          }),
          onError: vi.fn((error: Error) => {
            console.error(`[Simulation] Ideation failed for ${projectId}:`, error.message);
          })
        });
      };

      // User rapidly triggers 5 ideations (within 100ms)
      const startTime = Date.now();
      await Promise.all(
        Array.from({ length: 5 }, (_, i) => triggerIdeation(i))
      );
      const triggerTime = Date.now() - startTime;

      console.log(`[Simulation] User triggered 5 ideations in ${triggerTime}ms`);

      // Wait for all to complete
      await queue.drain();

      // Verify all were processed
      expect(mockSpawnFn).toHaveBeenCalledTimes(5);

      // Verify sequential execution
      const sortedEntries = Array.from(concurrentProcesses.entries()).sort(
        (a, b) => a[1].start - b[1].start
      );

      for (let i = 0; i < sortedEntries.length - 1; i++) {
        const currentEnd = sortedEntries[i][1].end;
        const nextStart = sortedEntries[i + 1][1].start;
        expect(nextStart).toBeGreaterThanOrEqual(currentEnd);
      }

      console.log('[Simulation] All ideations completed sequentially without overlap');
    });
  });

  describe('Performance Characteristics', () => {
    it('should measure throughput under load', async () => {
      const numAgents = 10;
      const startTime = Date.now();

      for (let i = 0; i < numAgents; i++) {
        queue.enqueue(createRequest(`agent-${i}`, 5));
      }

      await queue.drain();
      const totalTime = Date.now() - startTime;

      // With 10 agents each taking ~5ms + overhead, sequential execution
      // should take roughly 50-100ms (much slower than parallel, but safe)
      expect(totalTime).toBeGreaterThan(40); // At least 40ms for sequential
      expect(totalTime).toBeLessThan(500); // But should complete in reasonable time

      const throughput = numAgents / (totalTime / 1000); // agents per second
      console.log(`[Performance] Processed ${numAgents} agents in ${totalTime}ms`);
      console.log(`[Performance] Throughput: ${throughput.toFixed(2)} agents/second`);

      // Verify all completed
      expect(mockSpawnFn).toHaveBeenCalledTimes(numAgents);
    });
  });
});
