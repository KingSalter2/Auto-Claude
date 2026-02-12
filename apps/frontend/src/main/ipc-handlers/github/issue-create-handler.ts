/**
 * Issue Create IPC handler (Phase 3)
 *
 * Creates GitHub issues via `gh issue create`.
 * Uses temp file pattern for body content (--body-file).
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { IPC_CHANNELS } from '../../../shared/constants';
import { getAugmentedEnv } from '../../env-utils';
import { createContextLogger } from './utils/logger';
import { withProject } from './utils/project-middleware';
import type { CreateIssueParams, CreateIssueResult } from '../../../shared/types/ai-triage';

const { debug: debugLog } = createContextLogger('Issue Create');

const MAX_TITLE_LENGTH = 256;

/**
 * Write content to a temp file and return the path.
 */
function writeTempFile(prefix: string, content: string): string {
  const tmpPath = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fs.writeFileSync(tmpPath, content, 'utf-8');
  return tmpPath;
}

/**
 * Remove temp file, ignoring errors if already deleted.
 */
function cleanupTempFile(tmpPath: string): void {
  try {
    fs.unlinkSync(tmpPath);
  } catch {
    // Already cleaned up or never created
  }
}

/**
 * Parse issue number from gh CLI output URL.
 * gh issue create outputs: https://github.com/{owner}/{repo}/issues/{number}
 */
function parseIssueUrl(output: string): { number: number; url: string } {
  const url = output.trim();
  const match = url.match(/\/issues\/(\d+)$/);
  if (!match) {
    throw new Error(`Could not parse issue URL from gh output: ${url}`);
  }
  return { number: Number.parseInt(match[1], 10), url };
}

/**
 * Register issue create handler
 */
export function registerIssueCreateHandler(
  _getMainWindow: () => BrowserWindow | null,
): void {
  debugLog('Registering Issue Create handler');

  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ISSUE_CREATE,
    async (_, projectId: string, params: CreateIssueParams): Promise<CreateIssueResult> => {
      debugLog('createIssue handler called', { projectId, title: params.title });

      return withProject(projectId, async (project) => {
        // Validate params
        if (!params.title || params.title.trim().length === 0) {
          throw new Error('Title is required');
        }
        if (params.title.length > MAX_TITLE_LENGTH) {
          throw new Error(`Title too long (max ${MAX_TITLE_LENGTH} characters)`);
        }

        const tmpPath = writeTempFile('gh-create-body', params.body || '');
        try {
          const { execFileSync } = await import('child_process');

          const ghArgs = ['issue', 'create', '--title', params.title, '--body-file', tmpPath];

          if (params.labels && params.labels.length > 0) {
            ghArgs.push('--label', params.labels.join(','));
          }

          if (params.assignees && params.assignees.length > 0) {
            ghArgs.push('--assignee', params.assignees.join(','));
          }

          const output = execFileSync('gh', ghArgs, {
            cwd: project.path,
            env: getAugmentedEnv(),
          });

          const result = parseIssueUrl(output.toString());
          debugLog('Issue created', { number: result.number, url: result.url });
          return result;
        } finally {
          cleanupTempFile(tmpPath);
        }
      });
    },
  );

  debugLog('Issue Create handler registered');
}
