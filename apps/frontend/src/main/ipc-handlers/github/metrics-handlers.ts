/**
 * Metrics IPC handlers for Phase 4.
 * Computes triage metrics from enrichment and transition data.
 */

import { ipcMain } from 'electron';
import type { BrowserWindow } from 'electron';
import { withProject } from './utils/project-middleware';
import { readEnrichmentFile, readTransitionsFile } from './enrichment-persistence';
import { createContextLogger } from './utils/logger';
import { IPC_CHANNELS } from '../../../shared/constants/ipc';
import type { WorkflowState } from '../../../shared/types/enrichment';
import type { TriageMetrics, MetricsTimeWindow } from '../../../shared/types/metrics';
import { getCompletenessCategory } from '../../../shared/types/metrics';

const logger = createContextLogger('Metrics');

const ALL_STATES: WorkflowState[] = ['new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked'];

function getTimeWindowMs(window: MetricsTimeWindow): number {
  switch (window) {
    case '7d': return 7 * 86_400_000;
    case '30d': return 30 * 86_400_000;
    case 'all': return Number.POSITIVE_INFINITY;
  }
}

export function registerMetricsHandlers(
  _getMainWindow: () => BrowserWindow | null,
): void {
  // Compute full metrics
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_METRICS_COMPUTE,
    async (_, projectId: string, timeWindow: MetricsTimeWindow) => {
      return withProject(projectId, async (project) => {
        const enrichmentData = await readEnrichmentFile(project.path);
        const transitionsData = await readTransitionsFile(project.path);

        const now = Date.now();
        const windowMs = getTimeWindowMs(timeWindow);
        const cutoff = windowMs === Number.POSITIVE_INFINITY ? 0 : now - windowMs;

        // Filter transitions by time window
        const filteredTransitions = transitionsData.transitions.filter(
          (t) => new Date(t.timestamp).getTime() >= cutoff,
        );

        // State counts
        const stateCounts = {} as Record<WorkflowState, number>;
        for (const state of ALL_STATES) stateCounts[state] = 0;
        for (const enrichment of Object.values(enrichmentData.issues)) {
          const state = enrichment.triageState as WorkflowState;
          if (stateCounts[state] !== undefined) {
            stateCounts[state]++;
          }
        }

        // Average time in state (from consecutive transitions)
        const timeInState: Record<string, number[]> = {};
        for (const state of ALL_STATES) timeInState[state] = [];

        // Group transitions by issue
        const byIssue = new Map<number, Array<{ from: string; to: string; timestamp: string }>>();
        for (const t of filteredTransitions) {
          if (!byIssue.has(t.issueNumber)) byIssue.set(t.issueNumber, []);
          byIssue.get(t.issueNumber)?.push(t);
        }

        for (const transitions of byIssue.values()) {
          transitions.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
          for (let i = 0; i < transitions.length - 1; i++) {
            const from = transitions[i].to; // State entered
            const duration = new Date(transitions[i + 1].timestamp).getTime() - new Date(transitions[i].timestamp).getTime();
            if (duration > 0 && timeInState[from]) {
              timeInState[from].push(duration);
            }
          }
        }

        const avgTimeInState = {} as Record<WorkflowState, number>;
        for (const state of ALL_STATES) {
          const durations = timeInState[state];
          avgTimeInState[state] = durations.length > 0
            ? durations.reduce((sum, d) => sum + d, 0) / durations.length
            : 0;
        }

        // Weekly throughput
        const weekMap = new Map<string, number>();
        for (const t of filteredTransitions) {
          const date = new Date(t.timestamp);
          const weekStart = new Date(date);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const weekKey = weekStart.toISOString().slice(0, 10);
          weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
        }
        const weeklyThroughput = Array.from(weekMap.entries())
          .map(([week, count]) => ({ week, count }))
          .sort((a, b) => a.week.localeCompare(b.week));

        // Completeness distribution
        const completenessDistribution = { low: 0, medium: 0, high: 0, excellent: 0 };
        for (const enrichment of Object.values(enrichmentData.issues)) {
          const score = (enrichment as { completenessScore?: number }).completenessScore ?? 0;
          completenessDistribution[getCompletenessCategory(score)]++;
        }

        // Backlog age (avg time issues in 'new' state)
        const newIssueCount = stateCounts.new;
        let avgBacklogAge = 0;
        if (newIssueCount > 0 && filteredTransitions.length > 0) {
          // Estimate: use earliest transition as project start, compute time since
          const earliest = Math.min(...filteredTransitions.map((t) => new Date(t.timestamp).getTime()));
          avgBacklogAge = now - earliest;
        }

        const metrics: TriageMetrics = {
          stateCounts,
          avgTimeInState,
          weeklyThroughput,
          completenessDistribution,
          avgBacklogAge,
          totalTransitions: filteredTransitions.length,
          computedAt: new Date().toISOString(),
        };

        logger.debug('Computed metrics', { totalTransitions: metrics.totalTransitions, timeWindow });
        return metrics;
      });
    },
  );

  // Quick state count query
  ipcMain.handle(
    IPC_CHANNELS.GITHUB_METRICS_STATE_COUNTS,
    async (_, projectId: string) => {
      return withProject(projectId, async (project) => {
        const data = await readEnrichmentFile(project.path);
        const counts = {} as Record<WorkflowState, number>;
        for (const state of ALL_STATES) counts[state] = 0;
        for (const enrichment of Object.values(data.issues)) {
          const state = enrichment.triageState as WorkflowState;
          if (counts[state] !== undefined) counts[state]++;
        }
        return counts;
      });
    },
  );
}
