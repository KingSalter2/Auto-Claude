/**
 * GitHub issue investigation IPC handlers
 *
 * Handles the full investigation lifecycle:
 * - Start investigation (spawn Python orchestrator subprocess)
 * - Cancel investigation (kill running subprocess)
 * - Queue management for parallel investigation limits
 * - Create task from investigation report
 * - Dismiss issue
 * - Post investigation results to GitHub
 * - Get/save investigation settings
 *
 * Also retains the legacy GITHUB_INVESTIGATE_ISSUE handler for backwards
 * compatibility with the old one-shot investigation flow.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import type { ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS, MODEL_ID_MAP, DEFAULT_FEATURE_MODELS, DEFAULT_FEATURE_THINKING } from '../../../shared/constants';
import type {
  GitHubInvestigationResult,
  GitHubInvestigationStatus,
  InvestigationProgress,
  InvestigationResult,
  InvestigationSettings,
  InvestigationDismissReason,
} from '../../../shared/types';
import type { AuthFailureInfo } from '../../../shared/types/terminal';
import type { AppSettings } from '../../../shared/types';
import { projectStore } from '../../project-store';
import { writeJsonWithRetry } from '../../utils/atomic-file';
import { readSettingsFile } from '../../settings-utils';
import { AgentManager } from '../../agent';
import { getGitHubConfig, githubFetch } from './utils';
import type { GitHubAPIComment } from './types';
import { createSpecForIssue, buildIssueContext, buildInvestigationTask } from './spec-utils';
import { createContextLogger } from './utils/logger';
import { withProjectOrNull } from './utils/project-middleware';
import { createIPCCommunicators } from './utils/ipc-communicator';
import { getRunnerEnv } from './utils/runner-env';
import {
  runPythonSubprocess,
  getPythonPath,
  getRunnerPath,
  validateGitHubModule,
  buildRunnerArgs,
  parseJSONFromOutput,
} from './utils/subprocess-runner';
import { killProcessGracefully } from '../../platform';

const { debug: debugLog } = createContextLogger('Investigation');

// Track active investigation subprocesses, keyed by `${projectId}:${issueNumber}`
const activeInvestigations = new Map<string, ChildProcess>();

// ============================================
// Investigation Queue
// ============================================

interface QueuedInvestigation {
  projectId: string;
  issueNumber: number;
  queuedAt: string;
}

/** FIFO queue for investigations waiting to start */
const investigationQueue: QueuedInvestigation[] = [];

/**
 * Get the max parallel investigations setting for a project.
 * Reads from the project's GitHub config on disk (same source as the settings handler).
 */
function getMaxParallel(projectId: string): number {
  const DEFAULT_MAX = 3;
  try {
    const project = projectStore.getProject(projectId);
    if (!project) return DEFAULT_MAX;
    const configPath = path.join(project.path, '.auto-claude', 'github', 'config.json');
    const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const settings = data.investigation_settings as InvestigationSettings | undefined;
    return settings?.maxParallelInvestigations ?? DEFAULT_MAX;
  } catch {
    return DEFAULT_MAX;
  }
}

/**
 * Remove an investigation from the queue (e.g. on cancel).
 * Returns true if the item was found and removed.
 */
function removeFromQueue(projectId: string, issueNumber: number): boolean {
  const index = investigationQueue.findIndex(
    (q) => q.projectId === projectId && q.issueNumber === issueNumber,
  );
  if (index !== -1) {
    investigationQueue.splice(index, 1);
    return true;
  }
  return false;
}

/**
 * Get GitHub Issues model and thinking settings from app settings
 */
function getGitHubIssuesSettings(): { model: string; thinkingLevel: string } {
  const rawSettings = readSettingsFile() as Partial<AppSettings> | undefined;
  const featureModels = rawSettings?.featureModels ?? DEFAULT_FEATURE_MODELS;
  const featureThinking = rawSettings?.featureThinking ?? DEFAULT_FEATURE_THINKING;
  const modelShort = featureModels.githubIssues ?? DEFAULT_FEATURE_MODELS.githubIssues;
  const thinkingLevel = featureThinking.githubIssues ?? DEFAULT_FEATURE_THINKING.githubIssues;
  const model = MODEL_ID_MAP[modelShort] ?? MODEL_ID_MAP['opus'];
  return { model, thinkingLevel };
}

/**
 * Get the GitHub config directory for a project
 */
function getGitHubDir(projectPath: string): string {
  return path.join(projectPath, '.auto-claude', 'github');
}

/**
 * Default investigation settings
 */
function createDefaultSettings(): InvestigationSettings {
  return {
    autoCreateTasks: false,
    autoStartTasks: false,
    pipelineMode: 'full',
    autoPostToGitHub: false,
    autoCloseIssues: false,
    maxParallelInvestigations: 3,
    labelIncludeFilter: [],
    labelExcludeFilter: [],
  };
}

// ============================================
// Legacy handler (old one-shot investigation)
// ============================================

/**
 * Send investigation progress update to renderer (legacy)
 */
function sendLegacyProgress(
  mainWindow: BrowserWindow,
  projectId: string,
  status: GitHubInvestigationStatus
): void {
  mainWindow.webContents.send(
    IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
    projectId,
    status
  );
}

/**
 * Send investigation error to renderer (legacy)
 */
function sendLegacyError(
  mainWindow: BrowserWindow,
  projectId: string,
  error: string
): void {
  mainWindow.webContents.send(
    IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
    projectId,
    error
  );
}

/**
 * Send investigation completion to renderer (legacy)
 */
function sendLegacyComplete(
  mainWindow: BrowserWindow,
  projectId: string,
  result: GitHubInvestigationResult
): void {
  mainWindow.webContents.send(
    IPC_CHANNELS.GITHUB_INVESTIGATION_COMPLETE,
    projectId,
    result
  );
}

/**
 * Legacy: Investigate a GitHub issue and create a task (old one-shot flow)
 */
function registerLegacyInvestigateIssue(
  _agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.on(
    IPC_CHANNELS.GITHUB_INVESTIGATE_ISSUE,
    async (_, projectId: string, issueNumber: number, selectedCommentIds?: number[]) => {
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const project = projectStore.getProject(projectId);
      if (!project) {
        sendLegacyError(mainWindow, projectId, 'Project not found');
        return;
      }

      const config = getGitHubConfig(project);
      if (!config) {
        sendLegacyError(mainWindow, projectId, 'No GitHub token or repository configured');
        return;
      }

      try {
        sendLegacyProgress(mainWindow, projectId, {
          phase: 'fetching',
          issueNumber,
          progress: 10,
          message: 'Fetching issue details...'
        });

        const issue = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues/${issueNumber}`
        ) as {
          number: number;
          title: string;
          body?: string;
          labels: Array<{ name: string }>;
          html_url: string;
        };

        const allComments = await githubFetch(
          config.token,
          `/repos/${config.repo}/issues/${issueNumber}/comments`
        ) as GitHubAPIComment[];

        const comments = Array.isArray(selectedCommentIds)
          ? allComments.filter(c => selectedCommentIds.includes(c.id))
          : allComments;

        const labels = issue.labels.map(l => l.name);
        const issueContext = buildIssueContext(
          issue.number,
          issue.title,
          issue.body,
          labels,
          issue.html_url,
          comments
        );

        sendLegacyProgress(mainWindow, projectId, {
          phase: 'analyzing',
          issueNumber,
          progress: 30,
          message: 'AI is analyzing the issue...'
        });

        const taskDescription = buildInvestigationTask(
          issue.number,
          issue.title,
          issueContext
        );

        const specData = await createSpecForIssue(
          project,
          issue.number,
          issue.title,
          taskDescription,
          issue.html_url,
          labels,
          project.settings?.mainBranch
        );

        sendLegacyProgress(mainWindow, projectId, {
          phase: 'creating_task',
          issueNumber,
          progress: 70,
          message: 'Creating task from investigation...'
        });

        const investigationResult: GitHubInvestigationResult = {
          success: true,
          issueNumber,
          analysis: {
            summary: `Investigation of issue #${issueNumber}: ${issue.title}`,
            proposedSolution: 'Task has been created for AI agent to implement the solution.',
            affectedFiles: [],
            estimatedComplexity: 'standard',
            acceptanceCriteria: [
              `Issue #${issueNumber} requirements are met`,
              'All existing tests pass',
              'New functionality is tested'
            ]
          },
          taskId: specData.specId
        };

        sendLegacyProgress(mainWindow, projectId, {
          phase: 'complete',
          issueNumber,
          progress: 100,
          message: 'Investigation complete!'
        });

        sendLegacyComplete(mainWindow, projectId, investigationResult);

      } catch (error) {
        sendLegacyError(
          mainWindow,
          projectId,
          error instanceof Error ? error.message : 'Failed to investigate issue'
        );
      }
    }
  );
}

// ============================================
// New investigation system handlers
// ============================================

/**
 * Run a single investigation subprocess for a given project/issue.
 * This is extracted from the start handler so it can be called both
 * directly (when under the parallel limit) and from processQueue().
 *
 * After completion (success, error, or exception), it calls processQueue()
 * to start the next queued investigation.
 */
async function runInvestigation(
  projectId: string,
  issueNumber: number,
  getMainWindow: () => BrowserWindow | null,
): Promise<void> {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  const { sendProgress, sendError, sendComplete } = createIPCCommunicators<
    InvestigationProgress,
    InvestigationResult
  >(
    mainWindow,
    {
      progress: IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
      error: IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
      complete: IPC_CHANNELS.GITHUB_INVESTIGATION_COMPLETE,
    },
    projectId,
  );

  const processKey = `${projectId}:${issueNumber}`;

  try {
    await withProjectOrNull(projectId, async (project) => {
      const validation = await validateGitHubModule(project);
      if (!validation.valid) {
        sendError(validation.error ?? 'GitHub module not available');
        return;
      }

      const backendPath = validation.backendPath ?? '';
      const { model, thinkingLevel } = getGitHubIssuesSettings();

      const args = buildRunnerArgs(
        getRunnerPath(backendPath),
        project.path,
        'investigate',
        [String(issueNumber)],
        { model, thinkingLevel },
      );

      const startedAt = new Date().toISOString();

      sendProgress({
        issueNumber,
        phase: 'starting',
        progress: 5,
        message: 'Starting investigation...',
        agentStatuses: [
          { agentType: 'root_cause', status: 'pending', progress: 0 },
          { agentType: 'impact', status: 'pending', progress: 0 },
          { agentType: 'fix_advisor', status: 'pending', progress: 0 },
          { agentType: 'reproducer', status: 'pending', progress: 0 },
        ],
        startedAt,
      });

      const subprocessEnv = await getRunnerEnv();
      const { process: childProcess, promise } = runPythonSubprocess<InvestigationResult>({
        pythonPath: getPythonPath(backendPath),
        args,
        cwd: backendPath,
        env: subprocessEnv,
        onProgress: (percent, message, data) => {
          // Parse agent status updates from progress data if available
          const progressUpdate: InvestigationProgress = {
            issueNumber,
            phase: percent < 90 ? 'investigating' : 'finalizing',
            progress: percent,
            message,
            agentStatuses: (data as InvestigationProgress | undefined)?.agentStatuses ?? [],
            startedAt,
          };
          sendProgress(progressUpdate);
        },
        onComplete: (stdout) => parseJSONFromOutput<InvestigationResult>(stdout),
        onStdout: (line) => debugLog('STDOUT:', line),
        onStderr: (line) => debugLog('STDERR:', line),
        onAuthFailure: (authFailureInfo: AuthFailureInfo) => {
          const win = getMainWindow();
          if (win) {
            win.webContents.send(IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
          }
        },
      });

      activeInvestigations.set(processKey, childProcess);

      let result;
      try {
        result = await promise;
      } finally {
        activeInvestigations.delete(processKey);
      }

      if (!result.success) {
        sendError(result.error ?? 'Investigation failed');
        return;
      }

      const investigationResult = result.data as InvestigationResult;
      sendComplete(investigationResult);
    });
  } catch (error) {
    sendError(error instanceof Error ? error.message : 'Failed to start investigation');
  } finally {
    // Always try to start the next queued investigation after this one finishes
    processQueue(getMainWindow);
  }
}

/**
 * Send a "queued" progress update to the renderer for a queued investigation,
 * including the 1-based queue position.
 */
function sendQueuedProgress(
  mainWindow: BrowserWindow,
  projectId: string,
  issueNumber: number,
  position: number,
): void {
  const { sendProgress } = createIPCCommunicators<InvestigationProgress, InvestigationResult>(
    mainWindow,
    {
      progress: IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
      error: IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
      complete: IPC_CHANNELS.GITHUB_INVESTIGATION_COMPLETE,
    },
    projectId,
  );

  sendProgress({
    issueNumber,
    phase: 'queued',
    progress: 0,
    message: `Queued (position ${position})`,
    agentStatuses: [],
    startedAt: new Date().toISOString(),
  });
}

/**
 * Update queue position progress for all currently queued investigations.
 */
function broadcastQueuePositions(getMainWindow: () => BrowserWindow | null): void {
  const mainWindow = getMainWindow();
  if (!mainWindow) return;

  for (let i = 0; i < investigationQueue.length; i++) {
    const queued = investigationQueue[i];
    sendQueuedProgress(mainWindow, queued.projectId, queued.issueNumber, i + 1);
  }
}

/**
 * Process the investigation queue: start as many queued investigations as
 * allowed by the maxParallelInvestigations limit.
 */
function processQueue(getMainWindow: () => BrowserWindow | null): void {
  if (investigationQueue.length === 0) return;

  // Process items from the front of the queue (FIFO).
  while (investigationQueue.length > 0) {
    const next = investigationQueue[0];
    const maxParallel = getMaxParallel(next.projectId);

    if (activeInvestigations.size >= maxParallel) {
      debugLog('Queue: at parallel limit, waiting', {
        active: activeInvestigations.size,
        maxParallel,
        queued: investigationQueue.length,
      });
      break;
    }

    // Dequeue and start
    investigationQueue.shift();
    debugLog('Queue: starting queued investigation', {
      projectId: next.projectId,
      issueNumber: next.issueNumber,
      remainingInQueue: investigationQueue.length,
    });

    // Fire-and-forget: runInvestigation will call processQueue again when it finishes
    runInvestigation(next.projectId, next.issueNumber, getMainWindow);

    // Update queue positions for remaining items
    broadcastQueuePositions(getMainWindow);
  }
}

/**
 * Register all investigation-related handlers
 */
export function registerInvestigationHandlers(
  agentManager: AgentManager,
  getMainWindow: () => BrowserWindow | null
): void {
  debugLog('Registering Investigation handlers');

  // Keep legacy handler for backwards compatibility
  registerLegacyInvestigateIssue(agentManager, getMainWindow);

  // ============================================
  // 1. Start investigation (with queue management)
  // ============================================
  ipcMain.on(
    IPC_CHANNELS.GITHUB_INVESTIGATION_START,
    async (_, projectId: string, issueNumber: number) => {
      debugLog('startInvestigation handler called', { projectId, issueNumber });
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
        const { sendError } = createIPCCommunicators<InvestigationProgress, InvestigationResult>(
          mainWindow,
          {
            progress: IPC_CHANNELS.GITHUB_INVESTIGATION_PROGRESS,
            error: IPC_CHANNELS.GITHUB_INVESTIGATION_ERROR,
            complete: IPC_CHANNELS.GITHUB_INVESTIGATION_COMPLETE,
          },
          projectId,
        );
        sendError('Invalid issue number');
        return;
      }

      const processKey = `${projectId}:${issueNumber}`;

      // Cancel any existing investigation for this issue
      const existingProcess = activeInvestigations.get(processKey);
      if (existingProcess && !existingProcess.killed) {
        killProcessGracefully(existingProcess);
        activeInvestigations.delete(processKey);
      }

      // Also remove from queue if already queued (re-start scenario)
      removeFromQueue(projectId, issueNumber);

      // Check whether we are at the parallel limit
      const maxParallel = getMaxParallel(projectId);
      if (activeInvestigations.size >= maxParallel) {
        // Enqueue and send "queued" progress
        investigationQueue.push({
          projectId,
          issueNumber,
          queuedAt: new Date().toISOString(),
        });

        const position = investigationQueue.length;
        debugLog('Investigation queued', {
          projectId,
          issueNumber,
          position,
          active: activeInvestigations.size,
          maxParallel,
        });

        sendQueuedProgress(mainWindow, projectId, issueNumber, position);
        return;
      }

      // Under the limit — start immediately
      runInvestigation(projectId, issueNumber, getMainWindow);
    },
  );

  // ============================================
  // 2. Cancel investigation (also removes from queue)
  // ============================================
  ipcMain.on(
    IPC_CHANNELS.GITHUB_INVESTIGATION_CANCEL,
    (_, projectId: string, issueNumber: number) => {
      debugLog('cancelInvestigation handler called', { projectId, issueNumber });

      // First, try to remove from the queue (not yet started)
      const wasQueued = removeFromQueue(projectId, issueNumber);
      if (wasQueued) {
        debugLog('Investigation removed from queue', { projectId, issueNumber });
        // Update queue positions for remaining items
        broadcastQueuePositions(getMainWindow);
        return;
      }

      // Otherwise, kill the running subprocess
      const processKey = `${projectId}:${issueNumber}`;
      const proc = activeInvestigations.get(processKey);

      if (proc && !proc.killed) {
        killProcessGracefully(proc);
        debugLog('Investigation process killed', { processKey });
      }

      activeInvestigations.delete(processKey);
    },
  );

  // ============================================
  // 3. Create task from investigation
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_INVESTIGATION_CREATE_TASK,
    async (_, projectId: string, issueNumber: number) => {
      debugLog('createTaskFromInvestigation handler called', { projectId, issueNumber });

      try {
        const result = await withProjectOrNull(projectId, async (project) => {
          // Read investigation report from persistence
          const reportPath = path.join(
            getGitHubDir(project.path),
            'investigations',
            `${issueNumber}`,
            'report.json',
          );

          if (!fs.existsSync(reportPath)) {
            return { success: false, error: 'Investigation report not found. Run investigation first.' };
          }

          const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));

          // Build task description from investigation report
          const summary = reportData.summary || `Investigation of issue #${issueNumber}`;
          const fixAdvice = reportData.fixAdvice;
          const taskDescription = [
            `# GitHub Issue #${issueNumber}`,
            '',
            `## Summary`,
            summary,
            '',
            fixAdvice?.suggestedApproaches?.length
              ? [
                  '## Suggested Approach',
                  fixAdvice.suggestedApproaches[fixAdvice.recommendedApproach || 0]?.description || '',
                  '',
                  '### Files to Modify',
                  ...(fixAdvice.suggestedApproaches[fixAdvice.recommendedApproach || 0]?.filesToModify?.map(
                    (f: string) => `- ${f}`,
                  ) || []),
                ].join('\n')
              : '',
          ].join('\n');

          const config = getGitHubConfig(project);
          const githubUrl = config
            ? `https://github.com/${config.repo}/issues/${issueNumber}`
            : '';

          const labels = reportData.suggestedLabels
            ?.filter((l: { accepted?: boolean }) => l.accepted !== false)
            .map((l: { name: string }) => l.name) ?? [];

          const specData = await createSpecForIssue(
            project,
            issueNumber,
            summary,
            taskDescription,
            githubUrl,
            labels,
            project.settings?.mainBranch,
          );

          return { success: true, data: { specId: specData.specId } };
        });

        return result ?? { success: false, error: 'Project not found' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to create task',
        };
      }
    },
  );

  // ============================================
  // 4. Dismiss issue
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_INVESTIGATION_DISMISS,
    async (_, projectId: string, issueNumber: number, reason: InvestigationDismissReason) => {
      debugLog('dismissIssue handler called', { projectId, issueNumber, reason });

      try {
        const result = await withProjectOrNull(projectId, async (project) => {
          const githubDir = getGitHubDir(project.path);
          const dismissDir = path.join(githubDir, 'investigations', 'dismissed');
          fs.mkdirSync(dismissDir, { recursive: true });

          const dismissPath = path.join(dismissDir, `${issueNumber}.json`);
          await writeJsonWithRetry(dismissPath, {
            issueNumber,
            reason,
            dismissedAt: new Date().toISOString(),
          }, { indent: 2 });

          return { success: true };
        });

        return result ?? { success: false, error: 'Project not found' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to dismiss issue',
        };
      }
    },
  );

  // ============================================
  // 5. Post investigation results to GitHub
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_INVESTIGATION_POST_GITHUB,
    async (_, projectId: string, issueNumber: number) => {
      debugLog('postInvestigationToGitHub handler called', { projectId, issueNumber });

      try {
        const result = await withProjectOrNull(projectId, async (project) => {
          const validation = await validateGitHubModule(project);
          if (!validation.valid) {
            return { success: false, error: validation.error ?? 'GitHub module not available' };
          }

          const backendPath = validation.backendPath ?? '';
          const { model, thinkingLevel } = getGitHubIssuesSettings();

          const args = buildRunnerArgs(
            getRunnerPath(backendPath),
            project.path,
            'post-investigation',
            [String(issueNumber)],
            { model, thinkingLevel },
          );

          const subprocessEnv = await getRunnerEnv();
          const { promise } = runPythonSubprocess<{ commentId: number }>({
            pythonPath: getPythonPath(backendPath),
            args,
            cwd: backendPath,
            env: subprocessEnv,
            onComplete: (stdout) => parseJSONFromOutput<{ commentId: number }>(stdout),
            onStdout: (line) => debugLog('STDOUT:', line),
            onStderr: (line) => debugLog('STDERR:', line),
          });

          const subResult = await promise;

          if (!subResult.success) {
            return { success: false, error: subResult.error ?? 'Failed to post to GitHub' };
          }

          const postResult = subResult.data as { commentId: number };
          return { success: true, data: { commentId: postResult.commentId } };
        });

        return result ?? { success: false, error: 'Project not found' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to post to GitHub',
        };
      }
    },
  );

  // ============================================
  // 6. Get investigation settings
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_INVESTIGATION_GET_SETTINGS,
    async (_, projectId: string) => {
      debugLog('getInvestigationSettings handler called', { projectId });

      try {
        const result = await withProjectOrNull(projectId, async (project) => {
          const configPath = path.join(getGitHubDir(project.path), 'config.json');

          try {
            const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
            if (data.investigation_settings) {
              return {
                success: true,
                data: data.investigation_settings as InvestigationSettings,
              };
            }
          } catch {
            // File doesn't exist or is corrupted, return defaults
          }

          return { success: true, data: createDefaultSettings() };
        });

        return result ?? { success: true, data: createDefaultSettings() };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get settings',
        };
      }
    },
  );

  // ============================================
  // 7. Save investigation settings
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_INVESTIGATION_SAVE_SETTINGS,
    async (_, projectId: string, settings: Partial<InvestigationSettings>) => {
      debugLog('saveInvestigationSettings handler called', { projectId });

      try {
        const result = await withProjectOrNull(projectId, async (project) => {
          const githubDir = getGitHubDir(project.path);
          fs.mkdirSync(githubDir, { recursive: true });

          const configPath = path.join(githubDir, 'config.json');
          let existingConfig: Record<string, unknown> = {};

          try {
            existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          } catch {
            // Use empty config if file doesn't exist
          }

          // Merge with existing settings (partial update)
          const existingSettings = (existingConfig.investigation_settings as InvestigationSettings) ?? createDefaultSettings();
          const updatedConfig = {
            ...existingConfig,
            investigation_settings: {
              ...existingSettings,
              ...settings,
            },
          };

          await writeJsonWithRetry(configPath, updatedConfig, { indent: 2 });
          return { success: true };
        });

        return result ?? { success: false, error: 'Project not found' };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to save settings',
        };
      }
    },
  );

  // ============================================
  // 8. Load persisted investigations from disk
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_INVESTIGATION_LOAD_PERSISTED,
    async (_, projectId: string) => {
      debugLog('loadPersistedInvestigations handler called', { projectId });

      try {
        const result = await withProjectOrNull(projectId, async (project) => {
          const issuesDir = path.join(project.path, '.auto-claude', 'issues');

          if (!fs.existsSync(issuesDir)) {
            return { success: true, data: [] };
          }

          const entries = fs.readdirSync(issuesDir, { withFileTypes: true });
          const persisted: Array<{
            issueNumber: number;
            status: string;
            report?: unknown;
            completedAt?: string;
            specId?: string;
            githubCommentId?: number;
            wasInterrupted?: boolean;
          }> = [];

          for (const entry of entries) {
            if (!entry.isDirectory()) continue;

            const issueNumber = parseInt(entry.name, 10);
            if (isNaN(issueNumber)) continue;

            const issueDir = path.join(issuesDir, entry.name);
            const stateFile = path.join(issueDir, 'investigation_state.json');

            if (!fs.existsSync(stateFile)) continue;

            try {
              const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
              const status = stateData.status;

              // If the investigation was in-progress when the app shut down, mark it as failed
              if (status === 'investigating') {
                const item: (typeof persisted)[number] = {
                  issueNumber,
                  status: 'failed',
                  completedAt: stateData.completed_at ?? undefined,
                  specId: stateData.spec_id ?? stateData.linked_spec_id ?? undefined,
                  githubCommentId: stateData.github_comment_id ?? undefined,
                  wasInterrupted: true,
                };

                // Try to load partial report if one exists
                const reportFile = path.join(issueDir, 'investigation_report.json');
                if (fs.existsSync(reportFile)) {
                  try {
                    item.report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
                  } catch {
                    // Ignore corrupt report files
                  }
                }

                persisted.push(item);
                continue;
              }

              // Skip cancelled investigations
              if (status === 'cancelled') continue;

              // For completed states, load the report
              const reportFile = path.join(issueDir, 'investigation_report.json');
              let report: unknown | undefined;

              if (fs.existsSync(reportFile)) {
                try {
                  report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));
                } catch {
                  // Ignore corrupt report files
                }
              }

              persisted.push({
                issueNumber,
                status,
                report,
                completedAt: stateData.completed_at ?? undefined,
                specId: stateData.spec_id ?? stateData.linked_spec_id ?? undefined,
                githubCommentId: stateData.github_comment_id ?? undefined,
                wasInterrupted: false,
              });
            } catch {
              // Skip issues with corrupt state files
              debugLog('Skipping corrupt investigation state', { issueNumber });
            }
          }

          return { success: true, data: persisted };
        });

        return result ?? { success: true, data: [] };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to load persisted investigations',
        };
      }
    },
  );

  debugLog('Investigation handlers registered');
}
