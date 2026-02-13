/**
 * Dependency IPC handlers for Phase 4.
 * Fetches issue dependency data via GitHub GraphQL API (read-only).
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { execFileSync } from 'child_process';
import { withProject } from './utils/project-middleware';
import { getAugmentedEnv } from '../../env-utils';
import { createContextLogger } from './utils/logger';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import type { IssueDependency, IssueDependencies } from '../../../shared/types/dependencies';

const logger = createContextLogger('Dependencies');

const DEPS_QUERY = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issue(number: $number) {
      trackedIssues(first: 20) {
        nodes {
          number
          title
          state
          repository { nameWithOwner }
        }
      }
      trackedInIssues(first: 20) {
        nodes {
          number
          title
          state
          repository { nameWithOwner }
        }
      }
    }
  }
}`;

interface GraphQLIssueNode {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  repository?: { nameWithOwner: string };
}

function mapNode(node: GraphQLIssueNode, ownerRepo: string): IssueDependency {
  const dep: IssueDependency = {
    issueNumber: node.number,
    title: node.title,
    state: node.state === 'OPEN' ? 'open' : 'closed',
  };
  if (node.repository && node.repository.nameWithOwner !== ownerRepo) {
    dep.repo = node.repository.nameWithOwner;
  }
  return dep;
}

export function registerDependencyHandlers(
  _getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_DEPS_FETCH,
    async (_, projectId: string, issueNumber: number) => {
      if (!issueNumber || issueNumber < 1) {
        return { error: 'Invalid issue number', tracks: [], trackedBy: [] };
      }

      return withProject(projectId, async (project) => {
        const env = getAugmentedEnv();

        try {
          // Get owner/repo from gh CLI
          const repoJson = execFileSync('gh', [
            'repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner',
          ], { env, cwd: project.path, encoding: 'utf-8' }).trim();

          const [owner, repo] = repoJson.split('/');

          const result = execFileSync('gh', [
            'api', 'graphql',
            '-f', `query=${DEPS_QUERY}`,
            '-f', `owner=${owner}`,
            '-f', `repo=${repo}`,
            '-F', `number=${issueNumber}`,
          ], { env, cwd: project.path, encoding: 'utf-8' });

          const parsed = JSON.parse(result) as {
            data: {
              repository: {
                issue: {
                  trackedIssues: { nodes: GraphQLIssueNode[] };
                  trackedInIssues: { nodes: GraphQLIssueNode[] };
                };
              };
            };
          };

          const issue = parsed.data.repository.issue;
          const ownerRepo = `${owner}/${repo}`;

          const deps: IssueDependencies = {
            tracks: issue.trackedIssues.nodes.map((n) => mapNode(n, ownerRepo)),
            trackedBy: issue.trackedInIssues.nodes.map((n) => mapNode(n, ownerRepo)),
          };

          logger.debug('Fetched dependencies', { issueNumber, tracks: deps.tracks.length, trackedBy: deps.trackedBy.length });
          return deps;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';

          // Detect GraphQL field unavailability
          if (message.includes('does not exist') || message.includes('not found')) {
            return { error: message, unavailable: true, tracks: [], trackedBy: [] };
          }

          return { error: message, tracks: [], trackedBy: [] };
        }
      });
    },
  );
}
