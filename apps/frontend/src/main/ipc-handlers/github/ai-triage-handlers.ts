/**
 * AI Triage IPC handlers (Phase 3)
 *
 * Handles:
 * - AI enrichment (single issue analysis via Python runner)
 * - Split suggestion (issue decomposition via Python runner)
 * - Apply triage results (batch label application)
 * - Progressive trust config persistence
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { IPC_CHANNELS, MODEL_ID_MAP, DEFAULT_FEATURE_MODELS, DEFAULT_FEATURE_THINKING } from '../../../shared/constants';
import type { AuthFailureInfo } from '../../../shared/types/terminal';
import { writeJsonWithRetry } from '../../utils/atomic-file';
import { readSettingsFile } from '../../settings-utils';
import { getAugmentedEnv } from '../../env-utils';
import type { AppSettings } from '../../../shared/types';
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
import { MAX_SPLIT_SUB_ISSUES } from '../../../shared/constants/ai-triage';
import { createDefaultProgressiveTrust } from '../../../shared/types/ai-triage';
import { readEnrichmentFile, writeEnrichmentFile, appendTransition } from './enrichment-persistence';
import { createDefaultEnrichment } from '../../../shared/types/enrichment';
import type { TriageCategory } from '../../../shared/types/enrichment';
import type {
  AIEnrichmentResult,
  SplitSuggestion,
  TriageReviewItem,
  EnrichmentProgress,
  SplitProgress,
  ApplyResultsProgress,
  ProgressiveTrustConfig,
} from '../../../shared/types/ai-triage';

const { debug: debugLog } = createContextLogger('AI Triage');

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
 * Get the GitHub directory for a project
 */
function getGitHubDir(projectPath: string): string {
  return path.join(projectPath, '.auto-claude', 'github');
}

// Track active subprocess for cancellation
import type { ChildProcess } from 'child_process';
let activeTriageProcess: ChildProcess | null = null;

/**
 * Register AI triage handlers
 */
export function registerAITriageHandlers(
  getMainWindow: () => BrowserWindow | null,
): void {
  debugLog('Registering AI Triage handlers');

  // Cancel active triage subprocess
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_TRIAGE_CANCEL,
    async () => {
      if (activeTriageProcess && !activeTriageProcess.killed) {
        activeTriageProcess.kill('SIGTERM');
        activeTriageProcess = null;
        return { cancelled: true };
      }
      return { cancelled: false };
    },
  );

  // ============================================
  // Run AI enrichment for a single issue
  // ============================================
  ipcMain.on(
    IPC_CHANNELS.GITHUB_TRIAGE_ENRICH,
    async (_, projectId: string, issueNumber: number) => {
      debugLog('runEnrichment handler called', { projectId, issueNumber });
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const { sendProgress, sendError, sendComplete } = createIPCCommunicators<EnrichmentProgress, AIEnrichmentResult>(
        mainWindow,
        {
          progress: IPC_CHANNELS.GITHUB_TRIAGE_ENRICH_PROGRESS,
          error: IPC_CHANNELS.GITHUB_TRIAGE_ENRICH_ERROR,
          complete: IPC_CHANNELS.GITHUB_TRIAGE_ENRICH_COMPLETE,
        },
        projectId,
      );

      // Validate issue number
      if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
        sendError('Invalid issue number');
        return;
      }

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
            'enrich',
            [String(issueNumber)],
            { model, thinkingLevel },
          );

          sendProgress({ phase: 'analyzing', progress: 10, message: 'Analyzing issue...' });

          const subprocessEnv = await getRunnerEnv();
          const { process: childProcess, promise } = runPythonSubprocess<AIEnrichmentResult>({
            pythonPath: getPythonPath(backendPath),
            args,
            cwd: backendPath,
            env: subprocessEnv,
            onProgress: (percent, message) => {
              sendProgress({ phase: 'generating', progress: percent, message });
            },
            onComplete: (stdout) => parseJSONFromOutput<AIEnrichmentResult>(stdout),
            onStdout: (line) => debugLog('STDOUT:', line),
            onStderr: (line) => debugLog('STDERR:', line),
            onAuthFailure: (authFailureInfo: AuthFailureInfo) => {
              mainWindow.webContents.send(IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
            },
          });
          activeTriageProcess = childProcess;

          const result = await promise;
          activeTriageProcess = null;

          if (!result.success) {
            sendError(result.error ?? 'Enrichment failed');
            return;
          }

          const enrichmentResult = result.data as AIEnrichmentResult;
          sendComplete(enrichmentResult);

          // Persist enrichment data to local file
          try {
            const enrichmentFile = await readEnrichmentFile(project.path);
            const key = String(issueNumber);
            const existing = enrichmentFile.issues[key] ?? createDefaultEnrichment(issueNumber);
            enrichmentFile.issues[key] = {
              ...existing,
              enrichment: {
                problem: enrichmentResult.problem,
                goal: enrichmentResult.goal,
                scopeIn: enrichmentResult.scopeIn,
                scopeOut: enrichmentResult.scopeOut,
                acceptanceCriteria: enrichmentResult.acceptanceCriteria,
                technicalContext: enrichmentResult.technicalContext,
                risksEdgeCases: enrichmentResult.risksEdgeCases,
              },
              completenessScore: enrichmentResult.confidence,
              updatedAt: new Date().toISOString(),
            };
            await writeEnrichmentFile(project.path, enrichmentFile);
          } catch (persistErr) {
            debugLog('Failed to persist enrichment result', {
              issueNumber,
              error: persistErr instanceof Error ? persistErr.message : persistErr,
            });
          }
        });
      } catch (error) {
        sendError(error instanceof Error ? error.message : 'Failed to run enrichment');
      }
    },
  );

  // ============================================
  // Run AI split suggestion
  // ============================================
  ipcMain.on(
    IPC_CHANNELS.GITHUB_TRIAGE_SPLIT,
    async (_, projectId: string, issueNumber: number) => {
      debugLog('runSplitSuggestion handler called', { projectId, issueNumber });
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const { sendProgress, sendError, sendComplete } = createIPCCommunicators<SplitProgress, SplitSuggestion>(
        mainWindow,
        {
          progress: IPC_CHANNELS.GITHUB_TRIAGE_SPLIT_PROGRESS,
          error: IPC_CHANNELS.GITHUB_TRIAGE_SPLIT_ERROR,
          complete: IPC_CHANNELS.GITHUB_TRIAGE_SPLIT_COMPLETE,
        },
        projectId,
      );

      if (!Number.isInteger(issueNumber) || issueNumber <= 0) {
        sendError('Invalid issue number');
        return;
      }

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
            'split',
            [String(issueNumber)],
            { model, thinkingLevel },
          );

          sendProgress({ phase: 'analyzing', progress: 10, message: 'Analyzing issue for splitting...' });

          const subprocessEnv = await getRunnerEnv();
          const { process: splitProcess, promise } = runPythonSubprocess<SplitSuggestion>({
            pythonPath: getPythonPath(backendPath),
            args,
            cwd: backendPath,
            env: subprocessEnv,
            onProgress: (percent, message) => {
              sendProgress({ phase: 'suggesting', progress: percent, message });
            },
            onComplete: (stdout) => parseJSONFromOutput<SplitSuggestion>(stdout),
            onStdout: (line) => debugLog('STDOUT:', line),
            onStderr: (line) => debugLog('STDERR:', line),
            onAuthFailure: (authFailureInfo: AuthFailureInfo) => {
              mainWindow.webContents.send(IPC_CHANNELS.CLAUDE_AUTH_FAILURE, authFailureInfo);
            },
          });
          activeTriageProcess = splitProcess;

          const result = await promise;
          activeTriageProcess = null;

          if (!result.success) {
            sendError(result.error ?? 'Split analysis failed');
            return;
          }

          const suggestion = result.data as SplitSuggestion;

          // Cap sub-issues at MAX_SPLIT_SUB_ISSUES
          if (suggestion.subIssues.length > MAX_SPLIT_SUB_ISSUES) {
            suggestion.subIssues = suggestion.subIssues.slice(0, MAX_SPLIT_SUB_ISSUES);
          }

          sendComplete(suggestion);
        });
      } catch (error) {
        sendError(error instanceof Error ? error.message : 'Failed to analyze split');
      }
    },
  );

  // ============================================
  // Apply batch triage results
  // ============================================
  ipcMain.on(
    IPC_CHANNELS.GITHUB_TRIAGE_APPLY_RESULTS,
    async (_, projectId: string, reviewItems: TriageReviewItem[]) => {
      debugLog('applyTriageResults handler called', { projectId, count: reviewItems.length });
      const mainWindow = getMainWindow();
      if (!mainWindow) return;

      const { sendProgress, sendError, sendComplete } = createIPCCommunicators<
        ApplyResultsProgress,
        { succeeded: number; failed: number; skipped: number }
      >(
        mainWindow,
        {
          progress: IPC_CHANNELS.GITHUB_TRIAGE_APPLY_RESULTS_PROGRESS,
          error: IPC_CHANNELS.GITHUB_TRIAGE_APPLY_RESULTS_ERROR,
          complete: IPC_CHANNELS.GITHUB_TRIAGE_APPLY_RESULTS_COMPLETE,
        },
        projectId,
      );

      try {
        await withProjectOrNull(projectId, async (project) => {
          let succeeded = 0;
          let failed = 0;
          let skipped = 0;
          const acceptedItems = reviewItems.filter(item => item.status === 'accepted' || item.status === 'auto-applied');

          skipped = reviewItems.length - acceptedItems.length;

          for (let i = 0; i < acceptedItems.length; i++) {
            const item = acceptedItems[i];
            sendProgress({
              totalItems: acceptedItems.length,
              processedItems: i,
              currentIssueNumber: item.issueNumber,
            });

            try {
              const { execFileSync } = await import('child_process');

              // Apply labels to add
              if (item.result.labelsToAdd.length > 0) {
                const safeLabels = item.result.labelsToAdd.filter(
                  (label: string) => /^[\w\s\-.:]+$/.test(label),
                );
                if (safeLabels.length > 0) {
                  execFileSync('gh', [
                    'issue', 'edit', String(item.issueNumber),
                    '--add-label', safeLabels.join(','),
                  ], {
                    cwd: project.path,
                    env: getAugmentedEnv(),
                  });
                }
              }

              // Remove labels
              if (item.result.labelsToRemove.length > 0) {
                const safeLabels = item.result.labelsToRemove.filter(
                  (label: string) => /^[\w\s\-.:]+$/.test(label),
                );
                if (safeLabels.length > 0) {
                  execFileSync('gh', [
                    'issue', 'edit', String(item.issueNumber),
                    '--remove-label', safeLabels.join(','),
                  ], {
                    cwd: project.path,
                    env: getAugmentedEnv(),
                  });
                }
              }

              succeeded++;

              // Persist triage result to enrichment file
              try {
                const enrichmentFile = await readEnrichmentFile(project.path);
                const key = String(item.issueNumber);
                const existing = enrichmentFile.issues[key] ?? createDefaultEnrichment(item.issueNumber);
                enrichmentFile.issues[key] = {
                  ...existing,
                  triageResult: {
                    category: item.result.category as TriageCategory,
                    confidence: item.result.confidence,
                    labelsToAdd: item.result.labelsToAdd,
                    labelsToRemove: item.result.labelsToRemove,
                    isDuplicate: item.result.isDuplicate,
                    duplicateOf: item.result.duplicateOf,
                    isSpam: item.result.isSpam,
                    suggestedBreakdown: item.result.suggestedBreakdown,
                    comment: item.result.comment,
                    triagedAt: item.result.triagedAt,
                  },
                  updatedAt: new Date().toISOString(),
                };
                await writeEnrichmentFile(project.path, enrichmentFile);

                // Append audit trail transition
                await appendTransition(project.path, {
                  issueNumber: item.issueNumber,
                  from: existing.triageState,
                  to: 'triage',
                  actor: 'ai-triage',
                  reason: `AI triage applied: ${item.result.category} (confidence: ${item.result.confidence})`,
                  timestamp: new Date().toISOString(),
                });
              } catch (persistErr) {
                debugLog('Failed to persist triage result', {
                  issueNumber: item.issueNumber,
                  error: persistErr instanceof Error ? persistErr.message : persistErr,
                });
              }
            } catch (error) {
              debugLog('Failed to apply results to issue', {
                issueNumber: item.issueNumber,
                error: error instanceof Error ? error.message : error,
              });
              failed++;
            }
          }

          sendComplete({ succeeded, failed, skipped });
        });
      } catch (error) {
        debugLog('applyTriageResults failed', { error: error instanceof Error ? error.message : error });
        sendError(error instanceof Error ? error.message : 'Failed to apply triage results');
      }
    },
  );

  // ============================================
  // Save progressive trust config
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_TRIAGE_SAVE_TRUST,
    async (_, projectId: string, config: ProgressiveTrustConfig): Promise<boolean> => {
      debugLog('saveProgressiveTrust handler called', { projectId });
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

        const updatedConfig = {
          ...existingConfig,
          progressive_trust: config,
        };

        await writeJsonWithRetry(configPath, updatedConfig, { indent: 2 });
        return true;
      });
      return result ?? false;
    },
  );

  // ============================================
  // Get progressive trust config
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_TRIAGE_GET_TRUST,
    async (_, projectId: string): Promise<ProgressiveTrustConfig> => {
      debugLog('getProgressiveTrust handler called', { projectId });
      const result = await withProjectOrNull(projectId, async (project) => {
        const configPath = path.join(getGitHubDir(project.path), 'config.json');

        try {
          const data = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          if (data.progressive_trust) {
            return data.progressive_trust as ProgressiveTrustConfig;
          }
        } catch {
          // Return default
        }

        return createDefaultProgressiveTrust();
      });
      return result ?? createDefaultProgressiveTrust();
    },
  );

  // ============================================
  // Save pending review queue
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_TRIAGE_SAVE_PENDING_REVIEW,
    async (_, projectId: string, items: TriageReviewItem[]): Promise<boolean> => {
      debugLog('savePendingReview handler called', { projectId, count: items.length });
      const result = await withProjectOrNull(projectId, async (project) => {
        const reviewPath = path.join(getGitHubDir(project.path), 'pending-review.json');

        if (items.length === 0) {
          // Remove file when queue is empty
          try {
            fs.unlinkSync(reviewPath);
          } catch {
            // File may not exist
          }
          return true;
        }

        fs.mkdirSync(getGitHubDir(project.path), { recursive: true });
        await writeJsonWithRetry(reviewPath, { items, savedAt: new Date().toISOString() }, { indent: 2 });
        return true;
      });
      return result ?? false;
    },
  );

  // ============================================
  // Load pending review queue
  // ============================================
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_TRIAGE_LOAD_PENDING_REVIEW,
    async (_, projectId: string): Promise<TriageReviewItem[]> => {
      debugLog('loadPendingReview handler called', { projectId });
      const result = await withProjectOrNull(projectId, async (project) => {
        const reviewPath = path.join(getGitHubDir(project.path), 'pending-review.json');

        try {
          const data = JSON.parse(fs.readFileSync(reviewPath, 'utf-8'));
          if (Array.isArray(data.items)) {
            return data.items as TriageReviewItem[];
          }
        } catch {
          // File doesn't exist or is corrupted
        }

        return [];
      });
      return result ?? [];
    },
  );

  debugLog('AI Triage handlers registered');
}
