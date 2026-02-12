/**
 * GitHub Enrichment IPC handlers.
 * CRUD operations for issue enrichment, workflow transitions, bootstrap, reconciliation, and GC.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants';
import { isValidTransition } from '../../../shared/constants/enrichment';
import type { WorkflowState, Resolution, IssueEnrichment } from '../../../shared/types/enrichment';
import type { GitHubIssue } from '../../../shared/types/integrations';
import {
  readEnrichmentFile,
  writeEnrichmentFile,
  appendTransition,
  bootstrapFromGitHub,
  reconcileWithGitHub,
  runGarbageCollection,
} from './enrichment-persistence';
import { withProject } from './utils/project-middleware';
import { createContextLogger } from './utils/logger';

const logger = createContextLogger('GitHub Enrichment');

export function registerEnrichmentHandlers(
  _getMainWindow: () => BrowserWindow | null,
): void {
  // Get all enrichments for a project
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_GET_ALL,
    async (_, projectId: string) => {
      return withProject(projectId, async (project) => {
        const data = await readEnrichmentFile(project.path);
        return data;
      });
    },
  );

  // Get enrichment for a single issue
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_GET,
    async (_, projectId: string, issueNumber: number) => {
      return withProject(projectId, async (project) => {
        const data = await readEnrichmentFile(project.path);
        return data.issues[String(issueNumber)] ?? null;
      });
    },
  );

  // Save enrichment for a single issue
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_SAVE,
    async (_, projectId: string, enrichment: IssueEnrichment) => {
      return withProject(projectId, async (project) => {
        const data = await readEnrichmentFile(project.path);
        data.issues[String(enrichment.issueNumber)] = {
          ...enrichment,
          updatedAt: new Date().toISOString(),
        };
        await writeEnrichmentFile(project.path, data);
        return true;
      });
    },
  );

  // Transition workflow state
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_TRANSITION,
    async (
      _,
      projectId: string,
      issueNumber: number,
      to: WorkflowState,
      resolution?: Resolution,
    ) => {
      return withProject(projectId, async (project) => {
        const data = await readEnrichmentFile(project.path);
        const key = String(issueNumber);
        const enrichment = data.issues[key];

        if (!enrichment) {
          throw new Error(`No enrichment found for issue #${issueNumber}`);
        }

        const from = enrichment.triageState;

        // Validate transition (blocked state unblock handled specially)
        if (from === 'blocked' && enrichment.previousState) {
          // Unblock: return to previousState
          enrichment.triageState = enrichment.previousState;
          enrichment.previousState = undefined;
        } else if (to === 'blocked') {
          // Block: save current state as previousState
          if (!isValidTransition(from, to)) {
            throw new Error(`Invalid transition: ${from} → ${to}`);
          }
          enrichment.previousState = from;
          enrichment.triageState = 'blocked';
        } else {
          if (!isValidTransition(from, to)) {
            throw new Error(`Invalid transition: ${from} → ${to}`);
          }

          // Require resolution when transitioning to done
          if (to === 'done' && !resolution) {
            throw new Error('Resolution is required when transitioning to done');
          }

          enrichment.triageState = to;
          if (to === 'done') {
            enrichment.resolution = resolution;
          } else {
            enrichment.resolution = undefined;
          }
        }

        enrichment.updatedAt = new Date().toISOString();
        data.issues[key] = enrichment;

        await writeEnrichmentFile(project.path, data);

        await appendTransition(project.path, {
          issueNumber,
          from,
          to: enrichment.triageState,
          actor: 'user',
          resolution: enrichment.resolution,
          timestamp: enrichment.updatedAt,
        });

        return enrichment;
      });
    },
  );

  // Bootstrap enrichment from GitHub issues
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_BOOTSTRAP,
    async (_, projectId: string, issues: GitHubIssue[]) => {
      return withProject(projectId, async (project) => {
        logger.debug(`Bootstrapping enrichment for ${issues.length} issues`);
        const data = await bootstrapFromGitHub(project.path, issues);
        return data;
      });
    },
  );

  // Reconcile enrichment with GitHub state
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_RECONCILE,
    async (_, projectId: string, issues: GitHubIssue[]) => {
      return withProject(projectId, async (project) => {
        logger.debug(`Reconciling enrichment for ${issues.length} issues`);
        const data = await reconcileWithGitHub(project.path, issues);
        return data;
      });
    },
  );

  // Garbage collection
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ENRICHMENT_GC,
    async (_, projectId: string, issueNumbers: number[]) => {
      return withProject(projectId, async (project) => {
        const result = await runGarbageCollection(project.path, issueNumbers);
        logger.debug(`GC complete: pruned=${result.pruned}, orphaned=${result.orphaned}`);
        return result;
      });
    },
  );
}
