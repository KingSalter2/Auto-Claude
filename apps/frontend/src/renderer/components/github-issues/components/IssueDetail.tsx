import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, User, Clock, MessageCircle, CheckCircle2, Eye, X, RotateCcw, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { ScrollArea } from '../../ui/scroll-area';
import {
  GITHUB_ISSUE_STATE_COLORS,
  GITHUB_ISSUE_STATE_LABELS,
} from '@shared/constants';
import { formatDate } from '../utils';
import { AutoFixButton } from './AutoFixButton';
import { EnrichmentPanel } from './EnrichmentPanel';
import { DependencyList } from './DependencyList';
import { CommentForm } from './CommentForm';
import { InlineEditor } from './InlineEditor';
import { LabelManager } from './LabelManager';
import { AssigneeManager } from './AssigneeManager';
import { InvestigateButton } from './InvestigateButton';
import { InvestigationPanel } from './InvestigationPanel';
import type { IssueDetailProps } from '../types';
import type { InvestigationDismissReason } from '@shared/types';

export function IssueDetail({
  issue,
  onInvestigate,
  investigationResult,
  linkedTaskId,
  onViewTask,
  projectId,
  autoFixConfig,
  autoFixQueueItem,
  enrichment,
  onTransition,
  onAITriage,
  onImproveIssue,
  onSplitIssue,
  isAIBusy,
  onEditTitle,
  onEditBody,
  onAddLabels,
  onRemoveLabels,
  repoLabels,
  onAddAssignees,
  onRemoveAssignees,
  collaborators,
  onCreateSpec,
  onClose,
  onReopen,
  onComment,
  dependencies,
  isDepsLoading,
  depsError,
  onNavigateDependency,
  onPostEnrichmentComment,
  onDismissEnrichmentComment,
  hasExistingAIComment,
  // Investigation system (F5)
  investigationState,
  investigationReport,
  investigationProgress,
  isInvestigating,
  investigationError,
  onCancelInvestigation,
  onCreateTask,
  onDismissIssue,
  onPostToGitHub,
  onAcceptLabel,
  onRejectLabel,
  isPostingToGitHub,
  investigationActivityLog,
}: IssueDetailProps) {
  const { t } = useTranslation('common');
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [showDismissMenu, setShowDismissMenu] = useState(false);

  // Use new investigation state if available, fall back to old
  const derivedState = investigationState ?? 'new';
  const hasLinkedTask = !!linkedTaskId;

  const handleViewTask = () => {
    if (linkedTaskId && onViewTask) {
      onViewTask(linkedTaskId);
    }
  };

  const handleClose = async () => {
    if (!onClose) return;
    setIsClosing(true);
    try {
      await onClose();
    } finally {
      setIsClosing(false);
    }
  };

  const handleReopen = async () => {
    if (!onReopen) return;
    setIsReopening(true);
    try {
      await onReopen();
    } finally {
      setIsReopening(false);
    }
  };

  const handleDismiss = (reason: InvestigationDismissReason) => {
    onDismissIssue?.(reason);
    setShowDismissMenu(false);
  };

  // Show investigation panel when report is available
  const showInvestigationResults = investigationReport && (
    derivedState === 'findings_ready'
    || derivedState === 'resolved'
    || derivedState === 'task_created'
    || derivedState === 'building'
    || derivedState === 'done'
  );

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`${GITHUB_ISSUE_STATE_COLORS[issue.state]}`}
              >
                {GITHUB_ISSUE_STATE_LABELS[issue.state]}
              </Badge>
              <span className="text-sm text-muted-foreground">#{issue.number}</span>
            </div>
            <Button variant="ghost" size="icon" asChild aria-label={t('accessibility.openOnGitHubAriaLabel')}>
              <a href={issue.htmlUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          </div>
          {onEditTitle ? (
            <h2 className="text-lg font-semibold text-foreground">
              <InlineEditor
                value={issue.title}
                onSave={onEditTitle}
                ariaLabel={t('mutations.editTitle')}
                required
              />
            </h2>
          ) : (
            <h2 className="text-lg font-semibold text-foreground">
              {issue.title}
            </h2>
          )}
        </div>

        {/* Warning banner for closed issues with active/pending investigation */}
        {issue.state === 'closed' && (derivedState === 'investigating' || derivedState === 'new' || derivedState === 'findings_ready') && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              {t('investigation.panel.closedIssueWarning', 'This issue is closed. Investigation results may not be actionable.')}
            </p>
          </div>
        )}

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {issue.author.login}
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            {formatDate(issue.createdAt)}
          </div>
          {issue.commentsCount > 0 && (
            <div className="flex items-center gap-1">
              <MessageCircle className="h-4 w-4" />
              {t('phase5.commentCount', { count: issue.commentsCount })}
            </div>
          )}
        </div>

        {/* Labels */}
        {onAddLabels && onRemoveLabels && repoLabels ? (
          <LabelManager
            currentLabels={issue.labels.map(l => l.name)}
            repoLabels={[...repoLabels, ...issue.labels.filter(il => !repoLabels.some(rl => rl.name === il.name))]}
            onAddLabel={(label) => onAddLabels([label])}
            onRemoveLabel={(label) => onRemoveLabels([label])}
          />
        ) : issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => {
              const color = `#${label.color}`;
              return (
                <Badge
                  key={label.id}
                  variant="outline"
                  style={{ backgroundColor: `${color}20`, borderColor: `${color}40`, color }}
                >
                  {label.name}
                </Badge>
              );
            })}
          </div>
        ) : null}

        {/* Investigation Actions */}
        <div className="flex items-center gap-2">
          {hasLinkedTask ? (
            <Button onClick={handleViewTask} className="flex-1" variant="secondary">
              <Eye className="h-4 w-4 mr-2" />
              {t('phase5.viewTask')}
            </Button>
          ) : (
            <InvestigateButton
              state={derivedState}
              progress={investigationProgress}
              hasError={!!investigationError}
              onInvestigate={onInvestigate}
              onCancel={onCancelInvestigation ?? (() => {})}
              onViewResults={() => {/* scroll to results handled inline */}}
              onCreateTask={onCreateTask ?? (() => {})}
              disabled={isInvestigating && !onCancelInvestigation}
            />
          )}
          {projectId && autoFixConfig?.enabled && !hasLinkedTask && (
            <AutoFixButton
              issue={issue}
              projectId={projectId}
              config={autoFixConfig}
              queueItem={autoFixQueueItem ?? null}
            />
          )}
          {/* Dismiss button */}
          {onDismissIssue && derivedState !== 'done' && (
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDismissMenu(!showDismissMenu)}
              >
                <XCircle className="h-4 w-4 mr-1" />
                {t('investigation.button.dismiss', 'Dismiss')}
              </Button>
              {showDismissMenu && (
                <div className="absolute right-0 top-full mt-1 z-10 bg-popover border rounded-md shadow-md py-1 min-w-[160px]">
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                    onClick={() => handleDismiss('wont_fix')}
                  >
                    {t('investigation.dismiss.wontFix', "Won't Fix")}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                    onClick={() => handleDismiss('duplicate')}
                  >
                    {t('investigation.dismiss.duplicate', 'Duplicate')}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                    onClick={() => handleDismiss('cannot_reproduce')}
                  >
                    {t('investigation.dismiss.cannotReproduce', 'Cannot Reproduce')}
                  </button>
                  <button
                    type="button"
                    className="w-full px-3 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                    onClick={() => handleDismiss('out_of_scope')}
                  >
                    {t('investigation.dismiss.outOfScope', 'Out of Scope')}
                  </button>
                </div>
              )}
            </div>
          )}
          {issue.state === 'open' && onClose && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClose}
              disabled={isClosing}
            >
              <X className="h-4 w-4 mr-1" />
              {t('phase5.closeIssue')}
            </Button>
          )}
          {issue.state === 'closed' && onReopen && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleReopen}
              disabled={isReopening}
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              {t('phase5.reopenIssue')}
            </Button>
          )}
        </div>

        {/* Investigation Error */}
        {investigationError && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="pt-4">
              <p className="text-sm text-destructive">{investigationError}</p>
            </CardContent>
          </Card>
        )}

        {/* Investigation Results Panel */}
        {showInvestigationResults && investigationReport && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {t('investigation.panel.title', 'Investigation Results')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <InvestigationPanel
                report={investigationReport}
                state={derivedState}
                showOriginal={showOriginal}
                onToggleOriginal={() => setShowOriginal(!showOriginal)}
                onPostToGitHub={onPostToGitHub}
                onAcceptLabel={onAcceptLabel}
                onRejectLabel={onRejectLabel}
                isPostingToGitHub={isPostingToGitHub}
                activityLog={investigationActivityLog}
                onCloseIssue={issue.state === 'open' && onClose ? handleClose : undefined}
                isClosingIssue={isClosing}
              />
            </CardContent>
          </Card>
        )}

        {/* Task Linked Info */}
        {hasLinkedTask && (
          <Card className="bg-success/5 border-success/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                {t('phase5.taskLinked')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {t('phase5.taskId')} {linkedTaskId}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Body / Description */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{t('phase5.description')}</CardTitle>
          </CardHeader>
          <CardContent>
            {onEditBody ? (
              <InlineEditor
                value={issue.body ?? ''}
                onSave={onEditBody}
                ariaLabel={t('mutations.editBody')}
                multiline
              />
            ) : issue.body ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body}</ReactMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {t('phase5.noDescription')}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Legacy Enrichment Panel (backwards compat until F9) */}
        {enrichment !== undefined && onTransition && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('enrichment.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <EnrichmentPanel
                enrichment={enrichment ?? null}
                currentState={enrichment?.triageState ?? 'new'}
                previousState={enrichment?.previousState}
                isAgentLocked={enrichment?.agentLinks?.some(l => l.status === 'active')}
                onTransition={onTransition}
                completenessScore={enrichment?.completenessScore ?? 0}
                onAITriage={isAIBusy ? undefined : onAITriage}
                onImproveIssue={isAIBusy ? undefined : onImproveIssue}
                onSplitIssue={isAIBusy ? undefined : onSplitIssue}
                onPostComment={onPostEnrichmentComment}
                onDismissComment={onDismissEnrichmentComment}
                hasExistingAIComment={hasExistingAIComment}
              />
            </CardContent>
          </Card>
        )}

        {/* Dependencies */}
        {dependencies && (
          <Card>
            <CardContent className="pt-4">
              <DependencyList
                dependencies={dependencies}
                isLoading={isDepsLoading ?? false}
                error={depsError ?? null}
                onNavigate={onNavigateDependency}
              />
            </CardContent>
          </Card>
        )}

        {/* Assignees */}
        {onAddAssignees && onRemoveAssignees && collaborators ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('assignees.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <AssigneeManager
                currentAssignees={issue.assignees}
                collaborators={collaborators}
                onAddAssignee={(login) => onAddAssignees([login])}
                onRemoveAssignee={(login) => onRemoveAssignees([login])}
              />
            </CardContent>
          </Card>
        ) : issue.assignees.length > 0 ? (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('assignees.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {issue.assignees.map((assignee) => (
                  <Badge key={assignee.login} variant="outline">
                    <User className="h-3 w-3 mr-1" />
                    {assignee.login}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Milestone */}
        {issue.milestone && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('phase5.milestone')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{issue.milestone.title}</Badge>
            </CardContent>
          </Card>
        )}

        {/* Comment Form */}
        {onComment && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{t('phase5.addComment')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CommentForm onSubmit={onComment} />
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}
