import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle, Circle, CircleDot, XCircle, Loader2, X } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import { CollapsibleCard } from '../../github-prs/components/CollapsibleCard';
import { InvestigationPanel } from './InvestigationPanel';
import type {
  InvestigationState,
  InvestigationProgress,
  InvestigationReport,
  InvestigationLogs,
  InvestigationAgentLog,
  InvestigationAgentType,
  SuggestedLabel,
} from '@shared/types';

const AGENT_ORDER: InvestigationAgentType[] = [
  'root_cause',
  'impact',
  'fix_advisor',
  'reproducer',
];

const AGENT_I18N_KEYS: Record<InvestigationAgentType | 'orchestrator', string> = {
  orchestrator: 'investigation.statusTree.orchestrator',
  root_cause: 'investigation.statusTree.rootCause',
  impact: 'investigation.statusTree.impact',
  fix_advisor: 'investigation.statusTree.fixAdvisor',
  reproducer: 'investigation.statusTree.reproducer',
};

interface InvestigationStatusTreeProps {
  state: InvestigationState;
  progress: InvestigationProgress | null;
  report: InvestigationReport | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  githubCommentId: number | null;
  specId: string | null;
  issueNumber: number;
  projectId: string;
  onCancel: () => void;
  onInvestigate: () => void;
  onCreateTask: () => void;
  onPostToGitHub?: () => void;
  onAcceptLabel?: (label: SuggestedLabel) => void;
  onRejectLabel?: (label: SuggestedLabel) => void;
  isPostingToGitHub?: boolean;
  activityLog?: Array<{ event: string; timestamp: string }>;
  onCloseIssue?: () => void;
  isClosingIssue?: boolean;
  showOriginal?: boolean;
  onToggleOriginal?: () => void;
}

function StatusDot({ status }: { status: 'pending' | 'active' | 'completed' | 'failed' }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-success shrink-0" />;
    case 'active':
      return <CircleDot className="h-4 w-4 text-primary shrink-0 animate-pulse" />;
    case 'failed':
      return <XCircle className="h-4 w-4 text-destructive shrink-0" />;
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
  }
}

function AgentLogEntries({
  agent,
  maxVisible = 8,
}: {
  agent: InvestigationAgentLog;
  maxVisible?: number;
}) {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);
  const entriesEndRef = useRef<HTMLDivElement>(null);

  const entries = agent.entries;
  const hasMore = entries.length > maxVisible;
  const visibleEntries = expanded ? entries : entries.slice(-maxVisible);

  // Auto-scroll to latest entry when active
  useEffect(() => {
    if (agent.status === 'active' && entriesEndRef.current) {
      entriesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [entries.length, agent.status]);

  if (entries.length === 0) return null;

  return (
    <div className="ml-6 mt-1 space-y-0.5">
      {hasMore && !expanded && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(true)}
        >
          {t('investigation.statusTree.showMore', { count: entries.length - maxVisible })}
        </button>
      )}
      {visibleEntries.map((entry, i) => (
        <div
          key={`${entry.timestamp}-${i}`}
          className={cn(
            'text-xs font-mono truncate leading-5',
            entry.type === 'error' && 'text-destructive',
            entry.type === 'tool_start' && 'text-muted-foreground',
            entry.type === 'text' && 'text-foreground/80',
            entry.type === 'info' && 'text-muted-foreground',
          )}
        >
          {entry.content}
        </div>
      ))}
      {hasMore && expanded && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(false)}
        >
          {t('investigation.statusTree.showLess')}
        </button>
      )}
      <div ref={entriesEndRef} />
    </div>
  );
}

export function InvestigationStatusTree({
  state,
  progress,
  report,
  error,
  startedAt,
  completedAt,
  githubCommentId,
  specId,
  issueNumber,
  projectId,
  onCancel,
  onInvestigate,
  onCreateTask,
  onPostToGitHub,
  onAcceptLabel,
  onRejectLabel,
  isPostingToGitHub,
  activityLog,
  onCloseIssue,
  isClosingIssue,
  showOriginal,
  onToggleOriginal,
}: InvestigationStatusTreeProps) {
  const { t } = useTranslation('common');
  const [logs, setLogs] = useState<InvestigationLogs | null>(null);
  const [isOpen, setIsOpen] = useState(true);

  const isInvestigating = state === 'investigating';
  const isComplete =
    state === 'findings_ready' ||
    state === 'resolved' ||
    state === 'task_created' ||
    state === 'building' ||
    state === 'done';
  const isFailed = state === 'failed';

  // Fetch logs function
  const fetchLogs = useCallback(async () => {
    try {
      const result = await window.electronAPI.github.getInvestigationLogs(projectId, issueNumber);
      if (result) {
        setLogs(result);
      }
    } catch {
      // Silently ignore fetch errors
    }
  }, [projectId, issueNumber]);

  // Poll for logs during investigation + listen for push events
  useEffect(() => {
    if (!isInvestigating) return;

    // Initial fetch
    fetchLogs();

    // Poll every 1.5s
    const interval = setInterval(fetchLogs, 1500);

    // Listen for push events for instant refresh
    const cleanup = window.electronAPI.github.onInvestigationLogsUpdated(
      (eventProjectId, data) => {
        if (eventProjectId === projectId && data.issueNumber === issueNumber) {
          fetchLogs();
        }
      },
    );

    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [isInvestigating, projectId, issueNumber, fetchLogs]);

  // Also load logs once on mount for completed investigations
  useEffect(() => {
    if (isComplete || isFailed) {
      fetchLogs();
    }
  }, [isComplete, isFailed, fetchLogs]);

  // Determine agent statuses from progress data or logs
  const getAgentStatus = (
    agentType: InvestigationAgentType,
  ): 'pending' | 'active' | 'completed' | 'failed' => {
    // Use logs if available (more accurate)
    if (logs?.agents[agentType]) {
      return logs.agents[agentType].status;
    }
    // Fall back to progress data
    if (progress?.agentStatuses) {
      const agentProgress = progress.agentStatuses.find((a) => a.agentType === agentType);
      if (agentProgress) {
        return agentProgress.status === 'running' ? 'active' : agentProgress.status;
      }
    }
    // If investigation is complete, all agents are completed
    if (isComplete) return 'completed';
    if (isFailed) return 'failed';
    return 'pending';
  };

  const getStatusLabel = (status: 'pending' | 'active' | 'completed' | 'failed'): string => {
    switch (status) {
      case 'active':
        return t('investigation.statusTree.running');
      case 'completed':
        return t('investigation.statusTree.complete');
      case 'failed':
        return t('investigation.statusTree.agentFailed');
      default:
        return t('investigation.statusTree.pending');
    }
  };

  // Card title and progress badge
  const getCardTitle = (): string => {
    if (isInvestigating) return t('investigation.statusTree.inProgress');
    if (isFailed) return t('investigation.statusTree.failed');
    if (state === 'task_created') return t('investigation.statusTree.taskCreated');
    if (state === 'building') return t('investigation.statusTree.building');
    if (state === 'done') return t('investigation.statusTree.done');
    return t('investigation.statusTree.findingsReady');
  };

  const progressPercent = progress?.progress ?? (isComplete ? 100 : 0);

  const headerAction = isInvestigating ? (
    <Button variant="ghost" size="sm" onClick={onCancel} className="h-7 px-2">
      <X className="h-3.5 w-3.5 mr-1" />
      {t('investigation.button.cancel')}
    </Button>
  ) : isFailed ? (
    <Button variant="ghost" size="sm" onClick={onInvestigate} className="h-7 px-2">
      {t('investigation.statusTree.retry')}
    </Button>
  ) : null;

  const progressBadge = (
    <span
      className={cn(
        'text-xs font-medium px-2 py-0.5 rounded-full',
        isInvestigating && 'bg-primary/10 text-primary',
        isComplete && 'bg-success/10 text-success',
        isFailed && 'bg-destructive/10 text-destructive',
      )}
    >
      {isInvestigating && <Loader2 className="h-3 w-3 inline mr-1 animate-spin" />}
      {isInvestigating
        ? `${progressPercent}%`
        : isFailed
          ? t('investigation.statusTree.agentFailed')
          : t('investigation.statusTree.complete')}
    </span>
  );

  return (
    <CollapsibleCard
      title={getCardTitle()}
      icon={
        isInvestigating ? (
          <CircleDot className="h-4 w-4 text-primary animate-pulse" />
        ) : isComplete ? (
          <CheckCircle className="h-4 w-4 text-success" />
        ) : (
          <XCircle className="h-4 w-4 text-destructive" />
        )
      }
      badge={progressBadge}
      headerAction={headerAction}
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <div className="p-4 space-y-1">
        {/* Started step */}
        <div className="flex items-center gap-3 py-1.5">
          <StatusDot status="completed" />
          <span className="text-sm font-medium flex-1">
            {t('investigation.statusTree.started')}
          </span>
          {startedAt && (
            <span className="text-xs text-muted-foreground">
              {new Date(startedAt).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Agent steps */}
        {AGENT_ORDER.map((agentType) => {
          const status = getAgentStatus(agentType);
          const agentLog = logs?.agents[agentType];

          return (
            <div key={agentType}>
              <div className="flex items-center gap-3 py-1.5">
                <StatusDot status={status} />
                <span
                  className={cn(
                    'text-sm flex-1',
                    status === 'active' && 'font-medium',
                    status === 'pending' && 'text-muted-foreground',
                  )}
                >
                  {t(AGENT_I18N_KEYS[agentType])}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    status === 'active' && 'text-primary',
                    status === 'completed' && 'text-success',
                    status === 'failed' && 'text-destructive',
                    status === 'pending' && 'text-muted-foreground/60',
                  )}
                >
                  {getStatusLabel(status)}
                </span>
              </div>
              {/* Show log entries for active agents, or all agents during investigation */}
              {agentLog &&
                agentLog.entries.length > 0 &&
                (status === 'active' || (isInvestigating && status !== 'pending')) && (
                  <AgentLogEntries agent={agentLog} />
                )}
            </div>
          );
        })}

        {/* Error display */}
        {isFailed && error && (
          <div className="mt-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-sm text-destructive">
              {t('investigation.statusTree.errorOccurred', { message: error })}
            </p>
          </div>
        )}

        {/* Post-completion steps */}
        {isComplete && (
          <>
            {/* Analysis Complete step */}
            <div className="flex items-center gap-3 py-1.5">
              <StatusDot status="completed" />
              <span className="text-sm font-medium flex-1">
                {t('investigation.statusTree.analysisComplete')}
              </span>
              {completedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(completedAt).toLocaleTimeString()}
                </span>
              )}
            </div>

            {/* Post to GitHub step */}
            {onPostToGitHub && (
              <div className="flex items-center gap-3 py-1.5">
                <StatusDot status={githubCommentId ? 'completed' : 'pending'} />
                <span
                  className={cn(
                    'text-sm flex-1',
                    !githubCommentId && 'text-muted-foreground',
                  )}
                >
                  {githubCommentId
                    ? t('investigation.statusTree.postedToGitHub')
                    : t('investigation.statusTree.postToGitHub')}
                </span>
                {!githubCommentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2"
                    onClick={onPostToGitHub}
                    disabled={isPostingToGitHub}
                  >
                    {isPostingToGitHub
                      ? t('investigation.panel.posting')
                      : t('investigation.statusTree.postToGitHub')}
                  </Button>
                )}
              </div>
            )}

            {/* Create Task step */}
            <div className="flex items-center gap-3 py-1.5">
              <StatusDot status={specId ? 'completed' : 'pending'} />
              <span
                className={cn('text-sm flex-1', !specId && 'text-muted-foreground')}
              >
                {specId
                  ? `${t('investigation.statusTree.taskCreated')} (${specId})`
                  : t('investigation.statusTree.createTask')}
              </span>
              {!specId && (
                <Button variant="ghost" size="sm" className="h-7 px-2" onClick={onCreateTask}>
                  {t('investigation.statusTree.createTask')}
                </Button>
              )}
            </div>

            {/* Investigation Results Panel */}
            {report && (
              <div className="mt-4 pt-4 border-t">
                <InvestigationPanel
                  report={report}
                  state={state}
                  showOriginal={showOriginal}
                  onToggleOriginal={onToggleOriginal}
                  onPostToGitHub={onPostToGitHub}
                  onAcceptLabel={onAcceptLabel}
                  onRejectLabel={onRejectLabel}
                  isPostingToGitHub={isPostingToGitHub}
                  githubCommentId={githubCommentId}
                  activityLog={activityLog}
                  onCloseIssue={onCloseIssue}
                  isClosingIssue={isClosingIssue}
                />
              </div>
            )}
          </>
        )}

        {/* Re-investigate action for completed/failed states */}
        {(isComplete || isFailed) && (
          <div className="mt-3 pt-3 border-t flex justify-end">
            <Button variant="outline" size="sm" onClick={onInvestigate} className="h-7">
              {t('investigation.statusTree.rerun')}
            </Button>
          </div>
        )}
      </div>
    </CollapsibleCard>
  );
}
