import { memo } from 'react';
import { User, MessageCircle, Tag, Sparkles } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  GITHUB_ISSUE_STATE_COLORS,
  GITHUB_ISSUE_STATE_LABELS
} from '../../../../shared/constants';
import { WorkflowStateBadge } from './WorkflowStateBadge';
import { CompletenessIndicator } from './CompletenessIndicator';
import type { IssueListItemProps } from '../types';

export const IssueListItem = memo(function IssueListItem({
  issue,
  isSelected,
  onClick,
  onInvestigate,
  triageState,
  completenessScore,
  isSelectable,
  isChecked,
  onToggleSelect,
  compact,
}: IssueListItemProps) {
  return (
    <div
      className={`group p-3 rounded-lg cursor-pointer transition-colors ${
        isSelected
          ? 'bg-accent/50 border border-accent'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {isSelectable && (
          <input
            type="checkbox"
            checked={isChecked ?? false}
            onChange={(e) => {
              e.stopPropagation();
              onToggleSelect?.();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
            aria-label={`Select issue #${issue.number}`}
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge
              variant="outline"
              className={`text-xs ${GITHUB_ISSUE_STATE_COLORS[issue.state]}`}
            >
              {GITHUB_ISSUE_STATE_LABELS[issue.state]}
            </Badge>
            <WorkflowStateBadge state={triageState ?? 'new'} />
            <span className="text-xs text-muted-foreground">#{issue.number}</span>
          </div>
          <h4 className="text-sm font-medium text-foreground truncate">
            {issue.title}
          </h4>
          {!compact && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {issue.author.login}
              </div>
              {issue.commentsCount > 0 && (
                <div className="flex items-center gap-1">
                  <MessageCircle className="h-3 w-3" />
                  {issue.commentsCount}
                </div>
              )}
              {issue.labels.length > 0 && (
                <div className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  {issue.labels.length}
                </div>
              )}
              {completenessScore !== undefined && (
                <CompletenessIndicator score={completenessScore} compact />
              )}
            </div>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          onClick={(e) => {
            e.stopPropagation();
            onInvestigate();
          }}
        >
          <Sparkles className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.issue.id === next.issue.id
    && prev.isSelected === next.isSelected
    && prev.triageState === next.triageState
    && prev.completenessScore === next.completenessScore
    && prev.isChecked === next.isChecked
    && prev.isSelectable === next.isSelectable
    && prev.compact === next.compact;
});
