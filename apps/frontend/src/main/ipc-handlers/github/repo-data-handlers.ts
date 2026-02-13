/**
 * Repository data IPC handlers.
 * Fetch labels and collaborators for use in mutation UI components.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { execFileSync } from 'child_process';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import { withProject } from './utils/project-middleware';
import { getAugmentedEnv } from '../../env-utils';
import { createContextLogger } from './utils/logger';

const logger = createContextLogger('GitHub Repo Data');

interface RepoDataResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

interface LabelInfo {
  name: string;
  color: string;
  description: string;
}

export function registerRepoDataHandlers(
  _getMainWindow: () => BrowserWindow | null,
): void {
  // ---- Get Repository Labels ----
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_REPO_GET_LABELS,
    async (_, projectId: string): Promise<RepoDataResult<LabelInfo[]>> => {
      return withProject(projectId, async (project) => {
        try {
          const output = execFileSync(
            'gh',
            ['label', 'list', '--json', 'name,color,description', '--limit', '100'],
            {
              cwd: project.path,
              env: getAugmentedEnv(),
            },
          );

          const labels: LabelInfo[] = JSON.parse(output.toString());
          return { success: true, data: labels };
        } catch (error) {
          logger.debug('Failed to fetch labels', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch labels',
          };
        }
      });
    },
  );

  // ---- Get Repository Collaborators ----
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_REPO_GET_COLLABORATORS,
    async (_, projectId: string): Promise<RepoDataResult<string[]>> => {
      return withProject(projectId, async (project) => {
        try {
          const output = execFileSync(
            'gh',
            ['api', 'repos/{owner}/{repo}/collaborators', '--jq', '.[].login'],
            {
              cwd: project.path,
              env: getAugmentedEnv(),
            },
          );

          const logins = output
            .toString()
            .trim()
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter((line) => line.length > 0);

          return { success: true, data: logins };
        } catch (error) {
          logger.debug('Failed to fetch collaborators', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch collaborators',
          };
        }
      });
    },
  );
}
