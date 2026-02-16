import { memo } from 'react';
import { Search, Loader2, CheckCircle2, PlusCircle, XCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../ui/button';
import { useTranslation } from 'react-i18next';
import type { InvestigationState } from '@shared/types';

interface InvestigateButtonProps {
  /** Derived investigation state for this issue */
  state: InvestigationState;
  /** Progress percentage (0-100) during investigation */
  progress?: number;
  /** Whether there was a failure (shows retry) */
  hasError?: boolean;
  onInvestigate: () => void;
  onCancel: () => void;
  onViewResults: () => void;
  onCreateTask: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * State machine button for AI issue investigation.
 *
 * States:
 *   [AI Investigate] (blue) -> [Investigating... ] (animated) -> [View Results] (green) -> [Create Task] (purple)
 *
 * Cancel button appears alongside during investigation.
 */
export const InvestigateButton = memo(function InvestigateButton({
  state,
  progress,
  hasError,
  onInvestigate,
  onCancel,
  onViewResults,
  onCreateTask,
  disabled,
  className,
}: InvestigateButtonProps) {
  const { t } = useTranslation('common');

  // Failed state — show retry
  if (state === 'failed' || hasError) {
    return (
      <Button
        variant="destructive"
        size="sm"
        onClick={onInvestigate}
        disabled={disabled}
        className={className}
      >
        <XCircle className="h-4 w-4 mr-1.5" />
        {t('investigation.button.retry', 'Retry Investigation')}
      </Button>
    );
  }

  // Investigating — animated + cancel
  if (state === 'investigating') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled
          className={className}
        >
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          {t('investigation.button.investigating', 'Investigating...')}
          {progress != null && progress > 0 && (
            <span className="ml-1 text-xs opacity-70">{progress}%</span>
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t('investigation.button.cancel', 'Cancel')}
        </Button>
      </div>
    );
  }

  // Findings ready or resolved — view results
  if (state === 'findings_ready' || state === 'resolved') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewResults}
          className={`border-green-500/50 text-green-600 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30 ${className ?? ''}`}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          {t('investigation.button.viewResults', 'View Results')}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={onCreateTask}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <PlusCircle className="h-4 w-4 mr-1.5" />
          {t('investigation.button.createTask', 'Create Task')}
        </Button>
      </div>
    );
  }

  // Task created / building / done — show status + re-investigate option
  if (state === 'task_created' || state === 'building' || state === 'done') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onViewResults}
          disabled={disabled}
          className={className}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          {state === 'done'
            ? t('investigation.button.done', 'Done')
            : state === 'building'
              ? t('investigation.button.building', 'Building...')
              : t('investigation.button.taskCreated', 'Task Created')
          }
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onInvestigate}
          disabled={disabled}
          title={t('investigation.button.reInvestigate', 'Re-Investigate')}
          aria-label={t('investigation.button.reInvestigate', 'Re-Investigate')}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  // Queued — disabled + cancel
  if (state === 'queued') {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled
          className={className}
        >
          <Loader2 className="h-4 w-4 mr-1.5 animate-spin opacity-50" />
          {t('investigation.button.queued', 'Queued...')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onCancel}
        >
          {t('investigation.button.cancel', 'Cancel')}
        </Button>
      </div>
    );
  }

  // Default: new — show investigate button
  return (
    <Button
      variant="default"
      size="sm"
      onClick={onInvestigate}
      disabled={disabled}
      className={className}
    >
      <Search className="h-4 w-4 mr-1.5" />
      {t('investigation.button.investigate', 'AI Investigate')}
    </Button>
  );
});
