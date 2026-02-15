/**
 * GitHub Analyze & Group Issues IPC handlers
 *
 * Handles the proactive workflow for analyzing issues and grouping them
 * into batches based on similarity and common themes.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { IPC_CHANNELS } from '../../../shared/constants';
import type { AuthFailureInfo } from '../../../shared/types/terminal';
import type { Project } from '../../../shared/types';
import { createContextLogger } from './utils/logger';
import { withProjectOrNull } from './utils/project-middleware';
import { createIPCCommunicators } from './utils/ipc-communicator';
import {
  runPythonSubprocess,
  getPythonPath,
  getRunnerPath,
  validateGitHubModule,
  buildRunnerArgs,
  parseJSONFromOutput,
} from './utils/subprocess-runner';
import { getRunnerEnv } from './utils/runner-env';

// Debug logging
const { debug: debugLog } = createContextLogger('GitHub AnalyzePreview');

/**
 * Create an auth failure callback for subprocess runners.
 */
function createAuthFailureCallback(
  mainWindow: BrowserWindow | null,
  context: string
): ((authFailureInfo: AuthFailureInfo) => void) | undefined {
  if (!mainWindow) return undefined;
  return (authFailureInfo: AuthFailureInfo) => {
    debugLog(`Auth failure detected in ${context}`, authFailureInfo);
    mainWindow.webContents.send(IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
  };
}

/**
 * Preview result for analyze-preview command
 */
export interface AnalyzePreviewResult {
  success: boolean;
  totalIssues: number;
  analyzedIssues: number;
  alreadyBatched: number;
  proposedBatches: Array<{
    primaryIssue: number;
    issues: Array<{
      issueNumber: number;
      title: string;
      labels: string[];
      similarityToPrimary: number;
    }>;
    issueCount: number;
    commonThemes: string[];
    validated: boolean;
    confidence: number;
    reasoning: string;
    theme: string;
  }>;
  singleIssues: Array<{
    issueNumber: number;
    title: string;
    labels: string[];
  }>;
  message: string;
  error?: string;
}

/**
 * Issue batch for grouped fixing
 */
export interface IssueBatch {
  batchId: string;
  repo: string;
  primaryIssue: number;
  issues: Array<{
    issueNumber: number;
    title: string;
    similarityToPrimary: number;
  }>;
  commonThemes: string[];
  status: 'pending' | 'analyzing' | 'creating_spec' | 'building' | 'qa_review' | 'pr_created' | 'completed' | 'failed';
  specId?: string;
  prNumber?: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Convert analyze-preview Python result to camelCase
 */
function convertAnalyzePreviewResult(result: Record<string, unknown>): AnalyzePreviewResult {
  return {
    success: result.success as boolean,
    totalIssues: result.total_issues as number ?? 0,
    analyzedIssues: result.analyzed_issues as number ?? 0,
    alreadyBatched: result.already_batched as number ?? 0,
    proposedBatches: (result.proposed_batches as Array<Record<string, unknown>> ?? []).map((b) => ({
      primaryIssue: b.primary_issue as number,
      issues: (b.issues as Array<Record<string, unknown>>).map((i) => ({
        issueNumber: i.issue_number as number,
        title: i.title as string,
        labels: i.labels as string[] ?? [],
        similarityToPrimary: i.similarity_to_primary as number ?? 0,
      })),
      issueCount: b.issue_count as number ?? 0,
      commonThemes: b.common_themes as string[] ?? [],
      validated: b.validated as boolean ?? false,
      confidence: b.confidence as number ?? 0,
      reasoning: b.reasoning as string ?? '',
      theme: b.theme as string ?? '',
    })),
    singleIssues: (result.single_issues as Array<Record<string, unknown>> ?? []).map((i) => ({
      issueNumber: i.issue_number as number,
      title: i.title as string,
      labels: i.labels as string[] ?? [],
    })),
    message: result.message as string ?? '',
    error: result.error as string,
  };
}

/**
 * Get the GitHub directory for a project
 */
function getGitHubDir(project: Project): string {
  return path.join(project.path, '.auto-claude', 'github');
}

/**
 * Get batches from disk
 */
function getBatches(project: Project): IssueBatch[] {
  const batchesDir = path.join(getGitHubDir(project), 'batches');

  let files: string[];
  try {
    files = fs.readdirSync(batchesDir);
  } catch {
    return [];
  }

  const batches: IssueBatch[] = [];

  for (const file of files) {
    if (file.startsWith('batch_') && file.endsWith('.json')) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(batchesDir, file), 'utf-8'));
        batches.push({
          batchId: data.batch_id,
          repo: data.repo,
          primaryIssue: data.primary_issue,
          issues: data.issues.map((i: Record<string, unknown>) => ({
            issueNumber: i.issue_number,
            title: i.title,
            similarityToPrimary: i.similarity_to_primary,
          })),
          commonThemes: data.common_themes ?? [],
          status: data.status,
          specId: data.spec_id,
          prNumber: data.pr_number,
          error: data.error,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        });
      } catch {
        // Skip invalid files
      }
    }
  }

  return batches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

/**
 * Register analyze-preview related handlers
 */
export function registerAnalyzePreviewHandlers(
  getMainWindow: () => BrowserWindow | null
): void {
  debugLog('Registering AnalyzePreview handlers');

  // Analyze issues and preview proposed batches (proactive workflow)
  ipcMain.on(
    IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW,
    async (_, projectId: string, issueNumbers?: number[], maxIssues?: number) => {
      debugLog('analyzePreview handler called', { projectId, issueNumbers, maxIssues });
      const mainWindow = getMainWindow();
      if (!mainWindow) {
        debugLog('No main window available');
        return;
      }

      try {
        await withProjectOrNull(projectId, async (project) => {
          interface AnalyzePreviewProgress {
            phase: 'analyzing';
            progress: number;
            message: string;
          }

          const { sendProgress, sendComplete } = createIPCCommunicators<
            AnalyzePreviewProgress,
            AnalyzePreviewResult
          >(
            mainWindow,
            {
              progress: IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW_PROGRESS,
              error: IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW_ERROR,
              complete: IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW_COMPLETE,
            },
            projectId
          );

          debugLog('Starting analyze-preview');
          sendProgress({ phase: 'analyzing', progress: 10, message: 'Fetching issues for analysis...' });

          const validation = await validateGitHubModule(project);
          if (!validation.valid) {
            throw new Error(validation.error);
          }

          const backendPath = validation.backendPath!;
          const additionalArgs = ['--json'];
          if (maxIssues) {
            additionalArgs.push('--max-issues', maxIssues.toString());
          }
          if (issueNumbers && issueNumbers.length > 0) {
            additionalArgs.push(...issueNumbers.map(n => n.toString()));
          }

          const args = buildRunnerArgs(getRunnerPath(backendPath), project.path, 'analyze-preview', additionalArgs);
          const subprocessEnv = await getRunnerEnv();
          debugLog('Spawning analyze-preview process', { args });

          const { promise } = runPythonSubprocess<AnalyzePreviewResult>({
            pythonPath: getPythonPath(backendPath),
            args,
            cwd: backendPath,
            env: subprocessEnv,
            onProgress: (percent, message) => {
              sendProgress({ phase: 'analyzing', progress: percent, message });
            },
            onStdout: (line) => debugLog('STDOUT:', line),
            onStderr: (line) => debugLog('STDERR:', line),
            onAuthFailure: createAuthFailureCallback(mainWindow, 'analyze preview'),
            onComplete: (stdout) => {
              const rawResult = parseJSONFromOutput<Record<string, unknown>>(stdout);
              const convertedResult = convertAnalyzePreviewResult(rawResult);
              debugLog('Analyze preview completed', { batchCount: convertedResult.proposedBatches.length });
              return convertedResult;
            },
          });

          const result = await promise;

          if (!result.success) {
            throw new Error(result.error ?? 'Failed to analyze issues');
          }

          sendComplete(result.data!);
        });
      } catch (error) {
        debugLog('Analyze preview failed', { error: error instanceof Error ? error.message : error });
        const { sendError } = createIPCCommunicators<{ phase: 'analyzing'; progress: number; message: string }, AnalyzePreviewResult>(
          mainWindow,
          {
            progress: IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW_PROGRESS,
            error: IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW_ERROR,
            complete: IPC_CHANNELS.GITHUB_AUTOFIX_ANALYZE_PREVIEW_COMPLETE,
          },
          projectId
        );

        let userMessage = 'Failed to analyze issues';
        if (error instanceof Error) {
          if (error.message.includes('JSON')) {
            userMessage = 'Analysis completed, but there was an error processing the results. Please try again.';
          } else if (error.message.includes('No JSON found')) {
            userMessage = 'No analysis results returned. Please check your GitHub connection and try again.';
          } else {
            userMessage = error.message;
          }
        }

        sendError(userMessage);
      }
    }
  );

  // Approve and execute selected batches
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_AUTOFIX_APPROVE_BATCHES,
    async (_, projectId: string, approvedBatches: Array<Record<string, unknown>>): Promise<{ success: boolean; batches?: IssueBatch[]; error?: string }> => {
      debugLog('approveBatches handler called', { projectId, batchCount: approvedBatches.length });
      const result = await withProjectOrNull(projectId, async (project) => {
        try {
          const tempFile = path.join(getGitHubDir(project), 'temp_approved_batches.json');

          const pythonBatches = approvedBatches.map(b => ({
            primary_issue: b.primaryIssue,
            issues: (b.issues as Array<Record<string, unknown>>).map((i: Record<string, unknown>) => ({
              issue_number: i.issueNumber,
              title: i.title,
              labels: i.labels ?? [],
              similarity_to_primary: i.similarityToPrimary ?? 1.0,
            })),
            common_themes: b.commonThemes ?? [],
            validated: b.validated ?? true,
            confidence: b.confidence ?? 1.0,
            reasoning: b.reasoning ?? 'User approved',
            theme: b.theme ?? '',
          }));

          fs.writeFileSync(tempFile, JSON.stringify(pythonBatches, null, 2), 'utf-8');

          const validation = await validateGitHubModule(project);
          if (!validation.valid) {
            throw new Error(validation.error);
          }

          const backendPath = validation.backendPath!;
          const { execFileSync } = await import('child_process');
          execFileSync(
            getPythonPath(backendPath),
            [getRunnerPath(backendPath), '--project', project.path, 'approve-batches', tempFile],
            { cwd: backendPath, encoding: 'utf-8' }
          );

          fs.unlinkSync(tempFile);

          const batches = getBatches(project);
          debugLog('Batches approved and created', { count: batches.length });

          return { success: true, batches };
        } catch (error) {
          debugLog('Approve batches failed', { error: error instanceof Error ? error.message : error });
          return { success: false, error: error instanceof Error ? error.message : 'Failed to approve batches' };
        }
      });
      return result ?? { success: false, error: 'Project not found' };
    }
  );

  debugLog('AnalyzePreview handlers registered');
}
