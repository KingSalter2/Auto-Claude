import { memo } from 'react';
import { User, MessageCircle, Sparkles } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  GITHUB_ISSUE_STATE_COLORS,
  GITHUB_ISSUE_STATE_LABELS
} from '@shared/constants';
import { InvestigationProgressBar } from './InvestigationProgressBar';
import { useTranslation } from 'react-i18next';
import type { IssueListItemProps } from '../types';

export const IssueListItem = memo(function IssueListItem({
  issue,
  isSelected,
  onClick,
  onInvestigate,
  isSelectable,
  isChecked,
  onToggleSelect,
  compact,
  investigationState,
  investigationProgress,
  linkedTaskId,
  onViewTask,
  isStale,
}: IssueListItemProps) {
  const { t } = useTranslation('common');

  return (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={`group p-3 rounded-lg cursor-pointer transition-colors ${
        isStale ? 'opacity-60 ' : ''
      }${
        isSelected
          ? 'bg-accent/50 border border-accent'
          : 'hover:bg-muted/50 border border-transparent'
      }`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
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
            aria-label={t('phase5.selectIssue', { number: issue.number })}
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
            <span className="text-xs text-muted-foreground">#{issue.number}</span>
            {isStale && (
              <Badge variant="outline" className="text-[10px] px-1 py-0 text-muted-foreground border-muted-foreground/40">
                {t('investigation.states.stale', 'Stale')}
              </Badge>
            )}
          </div>
          <h4 className="text-sm font-medium text-foreground truncate">
            {issue.title}
          </h4>
          {!compact && (
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground overflow-hidden">
              <div className="flex items-center gap-1 shrink-0">
                <User className="h-3 w-3" />
                <span className="truncate max-w-[80px]">{issue.author.login}</span>
              </div>
              {issue.commentsCount > 0 && (
                <div className="flex items-center gap-1 shrink-0">
                  <MessageCircle className="h-3 w-3" />
                  {issue.commentsCount}
                </div>
              )}
              {issue.labels.length > 0 && (
                <div className="flex items-center gap-1 overflow-hidden">
                  {issue.labels.slice(0, 3).map((label) => {
                    const bg = `#${label.color}`;
                    const r = Number.parseInt(label.color.substring(0, 2), 16);
                    const g = Number.parseInt(label.color.substring(2, 4), 16);
                    const b = Number.parseInt(label.color.substring(4, 6), 16);
                    const textColor = (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.5 ? '#24292f' : '#ffffff';
                    return (
                      <span
                        key={label.id}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium leading-none"
                        style={{ backgroundColor: bg, color: textColor }}
                      >
                        {label.name}
                      </span>
                    );
                  })}
                  {issue.labels.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{issue.labels.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Investigation progress bar */}
          {investigationState && (
            <InvestigationProgressBar
              state={investigationState}
              progress={investigationProgress}
              linkedTaskId={linkedTaskId}
              onViewTask={onViewTask}
            />
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
    && prev.investigationState === next.investigationState
    && prev.investigationProgress === next.investigationProgress
    && prev.linkedTaskId === next.linkedTaskId
    && prev.isChecked === next.isChecked
    && prev.isSelectable === next.isSelectable
    && prev.compact === next.compact
    && prev.isStale === next.isStale;
});
