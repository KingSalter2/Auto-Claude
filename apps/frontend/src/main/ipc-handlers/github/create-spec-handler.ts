/**
 * Issue-to-Spec creation handler with enrichment data integration.
 * Creates a spec from a GitHub issue, using enrichment data when available
 * to produce a richer task description.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import type { IssueEnrichment } from '../../../shared/types/enrichment';
import type { MutationResult } from '../../../shared/types/mutations';
import { isValidTransition } from '../../../shared/constants/enrichment';
import {
  readEnrichmentFile,
  writeEnrichmentFile,
  withEnrichmentFileLock,
  appendTransition,
} from './enrichment-persistence';
import { createSpecForIssue, buildInvestigationTask, buildIssueContext } from './spec-utils';
import { getGitHubConfig, githubFetch } from './utils';
import { withProject } from './utils/project-middleware';
import { createContextLogger } from './utils/logger';

const logger = createContextLogger('GitHub Create Spec');

/**
 * Check if enrichment has any meaningful content.
 */
export function hasEnrichmentContent(enrichment: IssueEnrichment): boolean {
  const e = enrichment.enrichment;
  return !!(
    e.problem ||
    e.goal ||
    (e.scopeIn && e.scopeIn.length > 0) ||
    (e.scopeOut && e.scopeOut.length > 0) ||
    (e.acceptanceCriteria && e.acceptanceCriteria.length > 0) ||
    e.technicalContext ||
    (e.risksEdgeCases && e.risksEdgeCases.length > 0)
  );
}

/**
 * Build an enriched task description from issue data + enrichment.
 */
export function buildEnrichedTaskDescription(
  issue: { number: number; title: string; body?: string; html_url: string },
  enrichment: IssueEnrichment,
): string {
  const sections: string[] = [];

  sections.push(`# GitHub Issue #${issue.number}: ${issue.title}`);
  sections.push('');

  if (issue.body) {
    sections.push('## Original Description');
    sections.push(issue.body);
    sections.push('');
  }

  const e = enrichment.enrichment;

  if (e.problem) {
    sections.push('## Problem Statement');
    sections.push(e.problem);
    sections.push('');
  }

  if (e.goal) {
    sections.push('## Goal');
    sections.push(e.goal);
    sections.push('');
  }

  if (e.scopeIn && e.scopeIn.length > 0) {
    sections.push('## In Scope');
    for (const item of e.scopeIn) {
      sections.push(`- ${item}`);
    }
    sections.push('');
  }

  if (e.scopeOut && e.scopeOut.length > 0) {
    sections.push('## Out of Scope');
    for (const item of e.scopeOut) {
      sections.push(`- ${item}`);
    }
    sections.push('');
  }

  if (e.acceptanceCriteria && e.acceptanceCriteria.length > 0) {
    sections.push('## Acceptance Criteria');
    for (const item of e.acceptanceCriteria) {
      sections.push(`- ${item}`);
    }
    sections.push('');
  }

  if (e.technicalContext) {
    sections.push('## Technical Context');
    sections.push(e.technicalContext);
    sections.push('');
  }

  if (e.risksEdgeCases && e.risksEdgeCases.length > 0) {
    sections.push('## Risks & Edge Cases');
    for (const item of e.risksEdgeCases) {
      sections.push(`- ${item}`);
    }
    sections.push('');
  }

  if (enrichment.triageResult) {
    sections.push(`## Triage Analysis`);
    sections.push(`**Category:** ${enrichment.triageResult.category}`);
    sections.push(`**Confidence:** ${Math.round(enrichment.triageResult.confidence * 100)}%`);
    if (enrichment.triageResult.suggestedBreakdown.length > 0) {
      sections.push('**Suggested Breakdown:**');
      for (const item of enrichment.triageResult.suggestedBreakdown) {
        sections.push(`- ${item}`);
      }
    }
    sections.push('');
  }

  sections.push(`**URL:** ${issue.html_url}`);

  return sections.join('\n');
}

/**
 * Auto-transition enrichment to in_progress when spec is created.
 */
async function transitionToInProgress(
  projectPath: string,
  issueNumber: number,
): Promise<void> {
  try {
    await withEnrichmentFileLock(projectPath, async () => {
      const data = await readEnrichmentFile(projectPath);
      const key = String(issueNumber);
      const enrichment = data.issues[key];

      if (!enrichment) return;

      const from = enrichment.triageState;
      if (from === 'in_progress') return; // Already there
      if (!isValidTransition(from, 'in_progress')) return;

      enrichment.triageState = 'in_progress';
      enrichment.updatedAt = new Date().toISOString();
      data.issues[key] = enrichment;

      await writeEnrichmentFile(projectPath, data);
      await appendTransition(projectPath, {
        issueNumber,
        from,
        to: 'in_progress',
        actor: 'user',
        timestamp: enrichment.updatedAt,
      });
    });
  } catch (error) {
    logger.debug(`Failed to transition enrichment to in_progress for #${issueNumber}`, error);
  }
}

export function registerCreateSpecHandler(
  _getMainWindow: () => BrowserWindow | null,
): void {
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_ISSUE_CREATE_SPEC,
    async (_, projectId: string, issueNumber: number): Promise<MutationResult & { specNumber?: string }> => {
      return withProject(projectId, async (project) => {
        try {
          // 1. Check for active agent links
          const enrichmentData = await readEnrichmentFile(project.path);
          const enrichment = enrichmentData.issues[String(issueNumber)];

          if (enrichment?.agentLinks?.some((l) => l.status === 'active')) {
            return {
              success: false,
              issueNumber,
              error: 'An agent is already working on this issue',
            };
          }

          // 2. Fetch issue from GitHub
          const config = getGitHubConfig(project);
          if (!config) {
            return { success: false, issueNumber, error: 'No GitHub configuration found' };
          }

          const issue = (await githubFetch(
            config.token,
            `/repos/${config.repo}/issues/${issueNumber}`,
          )) as {
            number: number;
            title: string;
            body?: string;
            labels: Array<{ name: string }>;
            html_url: string;
          };

          // 3. Build task description (enriched or basic)
          let taskDescription: string;

          if (enrichment && hasEnrichmentContent(enrichment)) {
            taskDescription = buildEnrichedTaskDescription(issue, enrichment);
          } else {
            // Fetch comments for basic description
            const comments = (await githubFetch(
              config.token,
              `/repos/${config.repo}/issues/${issueNumber}/comments`,
            )) as Array<{ body: string; user: { login: string } }>;

            const context = buildIssueContext(
              issue.number,
              issue.title,
              issue.body,
              issue.labels.map((l) => l.name),
              issue.html_url,
              comments,
            );

            taskDescription = buildInvestigationTask(issue.number, issue.title, context);
          }

          // 4. Create spec
          const specResult = await createSpecForIssue(
            project,
            issue.number,
            issue.title,
            taskDescription,
            issue.html_url,
            issue.labels.map((l) => l.name),
            project.settings?.mainBranch,
          );

          // 5. Auto-transition to in_progress
          if (enrichment) {
            await transitionToInProgress(project.path, issueNumber);
          }

          return {
            success: true,
            issueNumber,
            specNumber: specResult.specId,
          };
        } catch (error) {
          return {
            success: false,
            issueNumber,
            error: error instanceof Error ? error.message : 'Failed to create spec',
          };
        }
      });
    },
  );
}
