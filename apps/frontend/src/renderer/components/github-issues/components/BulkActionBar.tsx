import { useTranslation } from 'react-i18next';
import type { BulkActionType, BulkOperationProgress } from '../../../../shared/types/mutations';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkAction: (action: BulkActionType, payload?: Record<string, unknown>) => void;
  isOperating: boolean;
  progress?: BulkOperationProgress | null;
  untriagedCount?: number;
  onTriageAll?: () => void;
}

const BULK_ACTIONS: Array<{ action: BulkActionType; label: string }> = [
  { action: 'close', label: 'Close' },
  { action: 'reopen', label: 'Reopen' },
  { action: 'add-label', label: 'Add Label' },
  { action: 'remove-label', label: 'Remove Label' },
  { action: 'add-assignee', label: 'Assign' },
  { action: 'remove-assignee', label: 'Unassign' },
  { action: 'transition', label: 'Transition' },
];

export function BulkActionBar({
  selectedCount,
  onBulkAction,
  isOperating,
  progress,
  untriagedCount,
  onTriageAll,
}: BulkActionBarProps) {
  const { t } = useTranslation('common');
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      role="toolbar"
      aria-label={t('bulk.actions')}
      className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2"
    >
      <span className="text-sm font-medium text-foreground">
        {selectedCount} selected
      </span>

      <div className="flex items-center gap-1.5 ml-2">
        {BULK_ACTIONS.map(({ action, label }) => (
          <button
            key={action}
            type="button"
            className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isOperating}
            onClick={() => onBulkAction(action)}
          >
            {label}
          </button>
        ))}
      </div>

      {onTriageAll && untriagedCount != null && untriagedCount > 0 && (
        <button
          type="button"
          className="ml-2 px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isOperating}
          onClick={onTriageAll}
          aria-label={t('aiTriage.triageAllButton')}
        >
          {t('aiTriage.triageAllButton')}
          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {untriagedCount}
          </span>
        </button>
      )}

      {isOperating && progress && (
        <span className="ml-auto text-xs text-muted-foreground">
          Processing {progress.processedItems}/{progress.totalItems}...
        </span>
      )}
    </div>
  );
}
