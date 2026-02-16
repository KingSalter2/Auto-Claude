import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle, Circle, CircleDot, Loader2, XCircle, ChevronDown,
  Send, FileText, X, RotateCcw, RefreshCw, EyeOff,
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { cn } from '../../../lib/utils';
import { CollapsibleCard } from '../../github-prs/components/CollapsibleCard';
import type {
  InvestigationState,
  InvestigationProgress,
  InvestigationReport,
  InvestigationLogs,
  InvestigationAgentType,
  InvestigationDismissReason,
} from '@shared/types';

const AGENT_ORDER: InvestigationAgentType[] = [
  'root_cause',
  'impact',
  'fix_advisor',
  'reproducer',
];

const AGENT_I18N_KEYS: Record<InvestigationAgentType, string> = {
  root_cause: 'investigation.statusTree.rootCause',
  impact: 'investigation.statusTree.impact',
  fix_advisor: 'investigation.statusTree.fixAdvisor',
  reproducer: 'investigation.statusTree.reproducer',
};

interface InvestigationNeedsAttentionProps {
  state: InvestigationState;
  progress: InvestigationProgress | null;
  report: InvestigationReport | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  githubCommentId: number | null;
  postedAt: string | null;
  specId: string | null;
  issueNumber: number;
  projectId: string;
  onCancel: () => void;
  onInvestigate: () => void;
  onCreateTask: () => void;
  onPostToGitHub?: () => void;
  isPostingToGitHub?: boolean;
  onDismissIssue?: (reason: InvestigationDismissReason) => void;
  onCloseIssue?: () => void;
  onReopenIssue?: () => void;
  isClosingIssue?: boolean;
  isReopeningIssue?: boolean;
  issueState: 'open' | 'closed';
}

type StepStatus = 'completed' | 'current' | 'pending' | 'failed' | 'actionable';

export function InvestigationNeedsAttention({
  state, progress, report, error, startedAt, completedAt,
  githubCommentId, postedAt, specId, issueNumber, projectId,
  onCancel, onInvestigate, onCreateTask, onPostToGitHub, isPostingToGitHub,
  onDismissIssue, onCloseIssue, onReopenIssue, isClosingIssue, isReopeningIssue, issueState,
}: InvestigationNeedsAttentionProps) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(true);
  const [logs, setLogs] = useState<InvestigationLogs | null>(null);

  const isInvestigating = state === 'investigating' || state === 'queued';
  const isComplete = ['findings_ready', 'resolved', 'task_created', 'building', 'done'].includes(state);
  const isFailed = state === 'failed' || state === 'interrupted';

  const formatDuration = (startedAt?: string, completedAt?: string): string | null => {
    if (!startedAt || !completedAt) return null;
    const seconds = Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000);
    if (seconds < 60) return t('investigation.duration.seconds', '{{count}}s', { count: seconds });
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return t('investigation.duration.minutesSeconds', '{{min}}m {{sec}}s', { min: minutes, sec: remainingSeconds });
  };

  // Fetch logs to get per-agent status
  const fetchLogs = useCallback(async () => {
    try {
      const result = await window.electronAPI.github.getInvestigationLogs(projectId, issueNumber);
      if (result) setLogs(result);
    } catch {
      // Silently ignore
    }
  }, [projectId, issueNumber]);

  useEffect(() => {
    if (!isInvestigating) {
      if (isComplete || isFailed) fetchLogs();
      return;
    }
    fetchLogs();
    const interval = setInterval(fetchLogs, 1500);
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
  }, [isInvestigating, isComplete, isFailed, projectId, issueNumber, fetchLogs]);

  // Tick every second to update elapsed times for active agents
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    if (!isInvestigating) return;
    const hasActiveAgent = AGENT_ORDER.some(a => logs?.agents[a]?.status === 'active');
    if (!hasActiveAgent) return;
    const interval = setInterval(() => forceUpdate(n => n + 1), 1000);
    return () => clearInterval(interval);
  }, [isInvestigating, logs]);

  // Derive agent status from logs (primary) or progress (fallback)
  const getAgentStatus = (agentType: InvestigationAgentType): StepStatus => {
    if (logs?.agents[agentType]) {
      const s = logs.agents[agentType].status;
      if (s === 'active') return 'current';
      if (s === 'completed') return 'completed';
      if (s === 'failed') return 'failed';
      return 'pending';
    }
    if (progress?.agentStatuses) {
      const agentProgress = progress.agentStatuses.find((a) => a.agentType === agentType);
      if (agentProgress) {
        if (agentProgress.status === 'running') return 'current';
        if (agentProgress.status === 'completed') return 'completed';
        if (agentProgress.status === 'failed') return 'failed';
        return 'pending';
      }
    }
    if (isComplete) return 'completed';
    if (isFailed) return 'failed';
    return 'pending';
  };

  // Build timeline steps
  const steps: { id: string; label: string; status: StepStatus; date?: string | null }[] = [];

  // Step 1: Investigation Started
  steps.push({
    id: 'started',
    label: t('investigation.timeline.started', 'Investigation Started'),
    status: startedAt ? 'completed' : 'pending',
    date: startedAt,
  });

  // Steps 2-5: Individual agents
  if (isInvestigating || isComplete || isFailed) {
    for (const agentType of AGENT_ORDER) {
      const agentLog = logs?.agents[agentType];
      const agentStatus = getAgentStatus(agentType);
      let suffix = '';
      if (agentStatus === 'completed') {
        const duration = agentLog ? formatDuration(agentLog.startedAt, agentLog.completedAt) : null;
        if (duration) suffix = ` — ${duration}`;
      } else if (agentStatus === 'current' && agentLog?.startedAt) {
        const elapsed = Math.round((Date.now() - new Date(agentLog.startedAt).getTime()) / 1000);
        if (elapsed < 60) {
          suffix = ` — ${elapsed}s`;
        } else {
          const min = Math.floor(elapsed / 60);
          const sec = elapsed % 60;
          suffix = ` — ${min}m ${sec}s`;
        }
      }
      steps.push({
        id: agentType,
        label: t(AGENT_I18N_KEYS[agentType]) + suffix,
        status: agentStatus,
        date: agentLog?.startedAt,
      });
    }
  }

  // Step 6: Analysis Complete
  if (isComplete && report) {
    const findingCount = [
      report.rootCause?.findings?.length ?? 0,
      report.impact?.findings?.length ?? 0,
      report.fixAdvice?.findings?.length ?? 0,
      report.reproduction?.findings?.length ?? 0,
    ].reduce((a, b) => a + b, 0);
    steps.push({
      id: 'analysis',
      label: t('investigation.timeline.analysisComplete', 'Analysis Complete') +
        ` — ${t('investigation.timeline.findingCount', '{{count}} findings', { count: findingCount })}`,
      status: 'completed',
      date: completedAt,
    });
  }

  // Step 7: Post to GitHub
  if (isComplete && report) {
    steps.push({
      id: 'post',
      label: githubCommentId
        ? t('investigation.timeline.posted', 'Posted to GitHub')
        : t('investigation.timeline.pendingPost', 'Post to GitHub'),
      status: githubCommentId ? 'completed' : 'actionable',
      date: postedAt ?? undefined,
    });
  }

  // Step 8: Create Task
  if (isComplete && report && !specId) {
    steps.push({
      id: 'task',
      label: t('investigation.timeline.pendingTask', 'Create Task'),
      status: 'actionable',
    });
  } else if (specId) {
    steps.push({
      id: 'task',
      label: t('investigation.timeline.taskCreated', 'Task Created'),
      status: 'completed',
    });
  }

  // Status dot color (mirrors ReviewStatusTree pattern)
  const getStatusDotColor = (): string => {
    if (isInvestigating) return 'bg-blue-500 animate-pulse';
    if (isFailed) return 'bg-destructive';
    if (isComplete && !githubCommentId) return 'bg-warning';
    if (isComplete) return 'bg-success';
    return 'bg-muted-foreground';
  };

  // Card title
  const title = isInvestigating
    ? t('investigation.needsAttention.investigating', 'AI Investigation in Progress')
    : isFailed
      ? t('investigation.needsAttention.failed', 'Investigation Failed')
      : isComplete && !githubCommentId
        ? t('investigation.needsAttention.title', 'Needs Attention')
        : t('investigation.needsAttention.complete', 'Investigation Complete');

  const progressPercent = progress?.progress ?? (isComplete ? 100 : 0);

  // Build progress message showing what agents are running
  const getProgressMessage = (): string => {
    if (progress?.message) return progress.message;
    const runningAgents = AGENT_ORDER.filter(a => getAgentStatus(a) === 'current');
    if (runningAgents.length > 0) {
      const names = runningAgents.map(a => t(AGENT_I18N_KEYS[a]));
      return t('investigation.progress.agentsRunning', 'Running: {{agents}}', { agents: names.join(', ') });
    }
    if (state === 'queued') return t('investigation.queue.waiting', 'Waiting in queue...');
    if (isInvestigating) return t('investigation.progress.starting', 'Starting investigation...');
    return '';
  };

  return (
    <CollapsibleCard
      title={title}
      icon={<div className={cn('h-2.5 w-2.5 shrink-0 rounded-full', getStatusDotColor())} />}
      defaultOpen
      open={isOpen}
      onOpenChange={setIsOpen}
      headerAction={isInvestigating ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => { e.stopPropagation(); onCancel(); }}
          className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          {t('investigation.button.cancel', 'Cancel')}
        </Button>
      ) : undefined}
    >
      <div className="p-4 pt-0">
        {/* Vertical timeline — same pattern as ReviewStatusTree */}
        <div className="relative pl-2 ml-2 border-l border-border/50 space-y-4 pt-4">
          {steps.map((step) => (
            <div key={step.id} className="relative flex items-start gap-3 pl-4">
              {/* Node dot on the timeline line */}
              <div className={cn(
                'absolute -left-[13px] top-1 bg-background rounded-full p-0.5 border',
                step.status === 'completed' && 'border-success text-success',
                step.status === 'current' && 'border-primary text-primary animate-pulse',
                step.status === 'failed' && 'border-destructive text-destructive',
                step.status === 'actionable' && 'border-warning text-warning',
                step.status === 'pending' && 'border-muted-foreground text-muted-foreground',
              )}>
                {step.status === 'completed' ? <CheckCircle className="h-3 w-3" /> :
                  step.status === 'current' ? <CircleDot className="h-3 w-3" /> :
                  step.status === 'failed' ? <XCircle className="h-3 w-3" /> :
                  step.status === 'actionable' ? <CircleDot className="h-3 w-3" /> :
                  <Circle className="h-3 w-3" />}
              </div>

              <div className="flex-1 min-w-0">
                <span className={cn(
                  'text-sm font-medium block truncate',
                  step.status === 'completed' && 'text-foreground',
                  step.status === 'current' && 'text-primary',
                  step.status === 'failed' && 'text-destructive',
                  step.status === 'actionable' && 'text-warning',
                  step.status === 'pending' && 'text-muted-foreground',
                )}>
                  {step.label}
                </span>
                {step.date && (
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(step.date).toLocaleString()}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar — shown during investigation (mirrors PRDetail pattern) */}
        {isInvestigating && (
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium truncate">{getProgressMessage()}</span>
              <span className="text-muted-foreground shrink-0 ml-2">{progressPercent}%</span>
            </div>
            <Progress value={progressPercent} className="h-2" animated />
          </div>
        )}

        {/* Error display */}
        {isFailed && error && (
          <div className="mt-4 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <p className="text-sm text-destructive">
              {t('investigation.statusTree.errorOccurred', { message: error })}
            </p>
          </div>
        )}
      </div>

      {/* Action buttons — always visible */}
      <div className="flex flex-wrap gap-2 mx-4 mb-4 pt-3 border-t border-border/50">
        {/* Dismiss */}
        {onDismissIssue && state !== 'done' && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <EyeOff className="h-3.5 w-3.5 mr-1.5" />
                {t('investigation.button.dismiss', 'Dismiss')}
                <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => onDismissIssue('wont_fix')}>
                {t('investigation.dismiss.wontFix', "Won't Fix")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDismissIssue('duplicate')}>
                {t('investigation.dismiss.duplicate', 'Duplicate')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDismissIssue('cannot_reproduce')}>
                {t('investigation.dismiss.cannotReproduce', 'Cannot Reproduce')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDismissIssue('out_of_scope')}>
                {t('investigation.dismiss.outOfScope', 'Out of Scope')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Close / Reopen issue */}
        {issueState === 'open' && onCloseIssue && (
          <Button variant="outline" size="sm" onClick={onCloseIssue} disabled={isClosingIssue}
            className="border-purple-500/40 text-purple-500 hover:bg-purple-500/10"
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            {t('phase5.closeIssue')}
          </Button>
        )}
        {issueState === 'closed' && onReopenIssue && (
          <Button variant="outline" size="sm" onClick={onReopenIssue} disabled={isReopeningIssue}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            {t('phase5.reopenIssue')}
          </Button>
        )}

        {/* Post findings — yellow when pending, green when done */}
        {isComplete && report && onPostToGitHub && (
          githubCommentId ? (
            <Button size="sm" variant="outline" disabled
              className="border-success/40 text-success hover:bg-success/10"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              {t('investigation.timeline.posted', 'Posted to GitHub')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onPostToGitHub} disabled={isPostingToGitHub}
              className="border-warning/40 text-warning hover:bg-warning/10"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {t('investigation.actions.postToGitHub', 'Post Findings')}
            </Button>
          )
        )}
        {/* Create task — yellow when pending, green when done */}
        {isComplete && report && (
          specId ? (
            <Button size="sm" variant="outline" disabled
              className="border-success/40 text-success hover:bg-success/10"
            >
              <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
              {t('investigation.timeline.taskCreated', 'Task Created')}
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={onCreateTask}
              className="border-warning/40 text-warning hover:bg-warning/10"
            >
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              {t('investigation.actions.createTask', 'Create Task')}
            </Button>
          )
        )}
        {/* Re-investigate — orange */}
        {(isComplete || isFailed) && (
          <Button size="sm" variant="outline" onClick={onInvestigate}
            className="border-orange-500/40 text-orange-500 hover:bg-orange-500/10"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            {t('investigation.actions.retry', 'Re-investigate')}
          </Button>
        )}
      </div>
    </CollapsibleCard>
  );
}
