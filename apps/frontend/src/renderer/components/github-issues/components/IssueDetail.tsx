import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink, User, Clock, MessageCircle, Sparkles, CheckCircle2, Eye, X, RotateCcw } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { ScrollArea } from '../../ui/scroll-area';
import {
  GITHUB_ISSUE_STATE_COLORS,
  GITHUB_ISSUE_STATE_LABELS,
  GITHUB_COMPLEXITY_COLORS
} from '../../../../shared/constants';
import { formatDate } from '../utils';
import { AutoFixButton } from './AutoFixButton';
import { EnrichmentPanel } from './EnrichmentPanel';
import { DependencyList } from './DependencyList';
import { CommentForm } from './CommentForm';
import { InlineEditor } from './InlineEditor';
import { LabelManager } from './LabelManager';
import { AssigneeManager } from './AssigneeManager';
import { CreateSpecButton } from './CreateSpecButton';
import type { IssueDetailProps } from '../types';

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
}: IssueDetailProps) {
  const { t } = useTranslation('common');
  const [isClosing, setIsClosing] = useState(false);
  const [isReopening, setIsReopening] = useState(false);

  // Determine which task ID to use - either already linked or just created
  const taskId = linkedTaskId || (investigationResult?.success ? investigationResult.taskId : undefined);
  const hasLinkedTask = !!taskId;

  const handleViewTask = () => {
    if (taskId && onViewTask) {
      onViewTask(taskId);
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
              {issue.commentsCount} comments
            </div>
          )}
        </div>

        {/* Labels */}
        {onAddLabels && onRemoveLabels && repoLabels ? (
          <LabelManager
            currentLabels={issue.labels.map(l => l.name)}
            repoLabels={repoLabels}
            onAddLabel={(label) => onAddLabels([label])}
            onRemoveLabel={(label) => onRemoveLabels([label])}
          />
        ) : issue.labels.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {issue.labels.map((label) => (
              <Badge
                key={label.id}
                variant="outline"
                style={{
                  backgroundColor: `#${label.color}20`,
                  borderColor: `#${label.color}50`,
                  color: `#${label.color}`
                }}
              >
                {label.name}
              </Badge>
            ))}
          </div>
        ) : null}

        {/* Actions */}
        <div className="flex items-center gap-2">
          {hasLinkedTask ? (
            <Button onClick={handleViewTask} className="flex-1" variant="secondary">
              <Eye className="h-4 w-4 mr-2" />
              View Task
            </Button>
          ) : (
            <>
              <Button onClick={onInvestigate} className="flex-1">
                <Sparkles className="h-4 w-4 mr-2" />
                Create Task
              </Button>
              {projectId && autoFixConfig?.enabled && (
                <AutoFixButton
                  issue={issue}
                  projectId={projectId}
                  config={autoFixConfig}
                  queueItem={autoFixQueueItem ?? null}
                />
              )}
            </>
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

        {/* Create Spec */}
        {onCreateSpec && (
          <CreateSpecButton
            issueNumber={issue.number}
            issueClosed={issue.state === 'closed'}
            hasActiveAgent={!!enrichment?.agentLinks?.some(l => l.status === 'active')}
            hasEnrichment={!!enrichment?.enrichment}
            onCreateSpec={onCreateSpec}
          />
        )}

        {/* Task Linked Info */}
        {hasLinkedTask && (
          <Card className="bg-success/5 border-success/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2 text-success">
                <CheckCircle2 className="h-4 w-4" />
                Task Linked
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              {investigationResult?.success ? (
                <>
                  <p className="text-foreground">{investigationResult.analysis.summary}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={GITHUB_COMPLEXITY_COLORS[investigationResult.analysis.estimatedComplexity]}>
                      {investigationResult.analysis.estimatedComplexity}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Task ID: {taskId}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Task ID: {taskId}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Body */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Description</CardTitle>
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
                No description provided.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Enrichment Panel */}
        {enrichment !== undefined && onTransition && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Enrichment</CardTitle>
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
              <CardTitle className="text-sm">Assignees</CardTitle>
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
              <CardTitle className="text-sm">Assignees</CardTitle>
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
              <CardTitle className="text-sm">Milestone</CardTitle>
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
