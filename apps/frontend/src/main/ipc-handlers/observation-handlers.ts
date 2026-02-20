/**
 * Observation IPC Handlers
 *
 * Handles observation-related IPC operations for the Observer memory system.
 * Reads/writes observation JSON files directly from ~/.auto-claude/observations/{projectHash}/
 */

import { ipcMain, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  IPCResult,
  Observation,
  ObservationStats,
  ObservationCategory,
  ObservationPriority,
} from '../../shared/types';

/**
 * Validate that a projectHash or id is safe (alphanumeric/hyphens/underscores only).
 * Prevents path traversal attacks via ".." or "/" in user-supplied values.
 */
function isValidPathSegment(value: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

/**
 * Get the base observations directory for a project.
 * Validates projectHash to prevent path traversal.
 */
function getObservationsDir(projectHash: string): string {
  if (!isValidPathSegment(projectHash)) {
    throw new Error(`Invalid projectHash: ${projectHash}`);
  }
  const home = app.getPath('home');
  const dir = path.join(home, '.auto-claude', 'observations', projectHash, 'observations');
  // Verify resolved path is still under the expected base
  const base = path.join(home, '.auto-claude', 'observations');
  if (!dir.startsWith(base)) {
    throw new Error('Path traversal detected');
  }
  return dir;
}

/**
 * Read all observation JSON files from the observations directory
 */
async function readAllObservations(projectHash: string): Promise<Observation[]> {
  const dir = getObservationsDir(projectHash);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const files = await fs.promises.readdir(dir);
  const observations: Observation[] = [];

  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = await fs.promises.readFile(path.join(dir, file), 'utf-8');
      observations.push(JSON.parse(content));
    } catch {
      // Skip malformed files
    }
  }

  return observations;
}

/**
 * Register all observation-related IPC handlers
 */
export function registerObservationHandlers(): void {
  // List observations for a project, optionally filtered by spec
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_LIST,
    async (_event, projectHash: string, specId?: string): Promise<IPCResult<Observation[]>> => {
      try {
        let observations = await readAllObservations(projectHash);

        if (specId) {
          observations = observations.filter((obs) => obs.spec_id === specId);
        }

        // Sort by timestamp descending (newest first)
        observations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        return { success: true, data: observations };
      } catch (error) {
        return { success: false, error: `Failed to list observations: ${error}` };
      }
    }
  );

  // Search observations by query with optional filters
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_SEARCH,
    async (
      _event,
      projectHash: string,
      query: string,
      category?: ObservationCategory,
      scope?: string
    ): Promise<IPCResult<Observation[]>> => {
      try {
        let observations = await readAllObservations(projectHash);
        const lowerQuery = query.toLowerCase();

        // Filter by text query
        observations = observations.filter(
          (obs) =>
            obs.content.toLowerCase().includes(lowerQuery) ||
            (obs.context && obs.context.toLowerCase().includes(lowerQuery)) ||
            (obs.source && obs.source.toLowerCase().includes(lowerQuery))
        );

        // Filter by category
        if (category) {
          observations = observations.filter((obs) => obs.category === category);
        }

        // Filter by scope (spec_id)
        if (scope) {
          observations = observations.filter((obs) => obs.spec_id === scope);
        }

        // Sort by timestamp descending
        observations.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

        return { success: true, data: observations };
      } catch (error) {
        return { success: false, error: `Failed to search observations: ${error}` };
      }
    }
  );

  // Get a single observation by ID
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_GET,
    async (_event, projectHash: string, id: string): Promise<IPCResult<Observation>> => {
      try {
        if (!isValidPathSegment(id)) {
          return { success: false, error: `Invalid observation id: ${id}` };
        }
        const filePath = path.join(getObservationsDir(projectHash), `${id}.json`);
        if (!fs.existsSync(filePath)) {
          return { success: false, error: `Observation not found: ${id}` };
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        return { success: true, data: JSON.parse(content) };
      } catch (error) {
        return { success: false, error: `Failed to get observation: ${error}` };
      }
    }
  );

  // Pin or unpin an observation
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_PIN,
    async (_event, projectHash: string, id: string, pinned: boolean): Promise<IPCResult<void>> => {
      try {
        if (!isValidPathSegment(id)) {
          return { success: false, error: `Invalid observation id: ${id}` };
        }
        const filePath = path.join(getObservationsDir(projectHash), `${id}.json`);
        if (!fs.existsSync(filePath)) {
          return { success: false, error: `Observation not found: ${id}` };
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        const observation = JSON.parse(content);
        observation.pin = pinned;
        await fs.promises.writeFile(filePath, JSON.stringify(observation, null, 2), 'utf-8');

        return { success: true };
      } catch (error) {
        return { success: false, error: `Failed to pin observation: ${error}` };
      }
    }
  );

  // Edit an observation's fields
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_EDIT,
    async (
      _event,
      projectHash: string,
      id: string,
      fields: Partial<Observation>
    ): Promise<IPCResult<void>> => {
      try {
        if (!isValidPathSegment(id)) {
          return { success: false, error: `Invalid observation id: ${id}` };
        }
        const filePath = path.join(getObservationsDir(projectHash), `${id}.json`);
        if (!fs.existsSync(filePath)) {
          return { success: false, error: `Observation not found: ${id}` };
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        const observation = JSON.parse(content);
        // Merge fields but preserve id
        const updated = { ...observation, ...fields, id: observation.id };
        await fs.promises.writeFile(filePath, JSON.stringify(updated, null, 2), 'utf-8');

        return { success: true };
      } catch (error) {
        return { success: false, error: `Failed to edit observation: ${error}` };
      }
    }
  );

  // Delete an observation
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_DELETE,
    async (_event, projectHash: string, id: string): Promise<IPCResult<void>> => {
      try {
        if (!isValidPathSegment(id)) {
          return { success: false, error: `Invalid observation id: ${id}` };
        }
        const filePath = path.join(getObservationsDir(projectHash), `${id}.json`);
        if (!fs.existsSync(filePath)) {
          return { success: false, error: `Observation not found: ${id}` };
        }

        await fs.promises.unlink(filePath);
        return { success: true };
      } catch (error) {
        return { success: false, error: `Failed to delete observation: ${error}` };
      }
    }
  );

  // Promote an observation to a task/issue
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_PROMOTE,
    async (_event, projectHash: string, id: string): Promise<IPCResult<void>> => {
      try {
        if (!isValidPathSegment(id)) {
          return { success: false, error: `Invalid observation id: ${id}` };
        }
        const filePath = path.join(getObservationsDir(projectHash), `${id}.json`);
        if (!fs.existsSync(filePath)) {
          return { success: false, error: `Observation not found: ${id}` };
        }

        const content = await fs.promises.readFile(filePath, 'utf-8');
        const observation = JSON.parse(content);
        observation.status = 'merged';
        await fs.promises.writeFile(filePath, JSON.stringify(observation, null, 2), 'utf-8');

        return { success: true };
      } catch (error) {
        return { success: false, error: `Failed to promote observation: ${error}` };
      }
    }
  );

  // Get observation statistics for a project
  ipcMain.handle(
    IPC_CHANNELS.OBSERVATION_GET_STATS,
    async (_event, projectHash: string): Promise<IPCResult<ObservationStats>> => {
      try {
        const observations = await readAllObservations(projectHash);

        const byCategory = {} as Record<ObservationCategory, number>;
        const byPriority = {} as Record<ObservationPriority, number>;
        let activeCount = 0;
        let archivedCount = 0;

        for (const obs of observations) {
          byCategory[obs.category] = (byCategory[obs.category] || 0) + 1;
          byPriority[obs.priority] = (byPriority[obs.priority] || 0) + 1;
          if (obs.status === 'active') activeCount++;
          if (obs.status === 'archived') archivedCount++;
        }

        return {
          success: true,
          data: {
            total: observations.length,
            by_category: byCategory,
            by_priority: byPriority,
            active_count: activeCount,
            archived_count: archivedCount,
          },
        };
      } catch (error) {
        return { success: false, error: `Failed to get observation stats: ${error}` };
      }
    }
  );
}
