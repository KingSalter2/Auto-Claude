import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { InvestigationState } from '@shared/types';

interface InvestigationProgressBarProps {
  /** Derived investigation state for this issue */
  state: InvestigationState;
  /** Progress percentage (0-100) during investigation */
  progress?: number;
  /** Linked task ID (shown as badge after task creation) */
  linkedTaskId?: string;
  /** Handler to navigate to the linked task */
  onViewTask?: (taskId: string) => void;
}

/**
 * Mini progress bar for issue list items.
 * Shows 0-100% during investigation, checkmark + task link after completion.
 */
export const InvestigationProgressBar = memo(function InvestigationProgressBar({
  state,
  progress,
  linkedTaskId,
  onViewTask,
}: InvestigationProgressBarProps) {
  const { t } = useTranslation('common');

  // Nothing to show for new issues
  if (state === 'new') return null;

  // Active investigation — show progress bar
  if (state === 'investigating') {
    const pct = progress ?? 0;
    return (
      <div className="flex items-center gap-2 mt-1.5">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-[10px] text-muted-foreground tabular-nums">{pct}%</span>
      </div>
    );
  }

  // Failed — red indicator
  if (state === 'failed') {
    return (
      <div className="flex items-center gap-1 mt-1.5">
        <div className="h-1.5 w-1.5 rounded-full bg-red-500" />
        <span className="text-[10px] text-red-500">{t('investigation.progress.failed', 'Failed')}</span>
      </div>
    );
  }

  // Completed states — checkmark + optional task link
  return (
    <div className="flex items-center gap-1.5 mt-1.5">
      <CheckCircle2 className="h-3 w-3 text-green-500" />
      {linkedTaskId && onViewTask && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onViewTask(linkedTaskId);
          }}
          className="flex items-center gap-0.5 text-[10px] text-primary hover:underline"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          {t('common:task', 'Task')}
        </button>
      )}
    </div>
  );
});
