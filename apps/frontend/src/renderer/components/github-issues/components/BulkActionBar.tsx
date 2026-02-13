import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BulkActionType, BulkOperationProgress } from '../../../../shared/types/mutations';
import { estimateBatchCost } from '../../../../shared/constants/ai-triage';

interface BulkActionBarProps {
  selectedCount: number;
  onBulkAction: (action: BulkActionType, payload?: Record<string, unknown>) => void;
  isOperating: boolean;
  progress?: BulkOperationProgress | null;
  untriagedCount?: number;
  onTriageAll?: () => void;
  onSelectAll?: () => void;
  onDeselectAll?: () => void;
}

const BULK_ACTIONS: Array<{ action: BulkActionType; labelKey: string }> = [
  { action: 'close', labelKey: 'bulk.actionClose' },
  { action: 'reopen', labelKey: 'bulk.actionReopen' },
  { action: 'add-label', labelKey: 'bulk.actionAddLabel' },
  { action: 'remove-label', labelKey: 'bulk.actionRemoveLabel' },
  { action: 'add-assignee', labelKey: 'bulk.actionAssign' },
  { action: 'remove-assignee', labelKey: 'bulk.actionUnassign' },
  { action: 'transition', labelKey: 'bulk.actionTransition' },
];

export function BulkActionBar({
  selectedCount,
  onBulkAction,
  isOperating,
  progress,
  untriagedCount,
  onTriageAll,
  onSelectAll,
  onDeselectAll,
}: BulkActionBarProps) {
  const { t } = useTranslation('common');
  const [pendingAction, setPendingAction] = useState<BulkActionType | null>(null);
  const [pendingTriageAll, setPendingTriageAll] = useState(false);

  if (selectedCount === 0) {
    return null;
  }

  const handleConfirm = () => {
    if (pendingAction) {
      onBulkAction(pendingAction);
      setPendingAction(null);
    }
  };

  const handleCancel = () => {
    setPendingAction(null);
  };

  return (
    <div
      role="toolbar"
      aria-label={t('bulk.actions')}
      className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2"
    >
      <span className="text-sm font-medium text-foreground">
        {t('bulk.selected', { count: selectedCount })}
      </span>

      {onSelectAll && (
        <button
          type="button"
          className="px-2 py-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isOperating}
          onClick={onSelectAll}
        >
          {t('phase5.selectAll')}
        </button>
      )}
      {onDeselectAll && (
        <button
          type="button"
          className="px-2 py-1 text-xs text-primary hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isOperating}
          onClick={onDeselectAll}
        >
          {t('phase5.deselectAll')}
        </button>
      )}

      {pendingAction ? (
        <div className="flex items-center gap-2 ml-2" role="alert">
          <span className="text-xs text-foreground">
            {t('bulk.confirmMessage', { action: pendingAction, count: selectedCount })}
          </span>
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded-md border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20"
            onClick={handleConfirm}
          >
            {t('bulk.confirm')}
          </button>
          <button
            type="button"
            className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
            onClick={handleCancel}
          >
            {t('bulk.cancel')}
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5 ml-2">
          {BULK_ACTIONS.map(({ action, labelKey }) => (
            <button
              key={action}
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isOperating}
              onClick={() => setPendingAction(action)}
            >
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}

      {onTriageAll && untriagedCount != null && untriagedCount > 0 && (
        pendingTriageAll ? (
          <div className="flex items-center gap-2 ml-2" role="alert">
            <span className="text-xs text-foreground">
              {t('aiTriage.confirmTriage', { count: untriagedCount, cost: estimateBatchCost(untriagedCount, 'sonnet') })}
            </span>
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-destructive bg-destructive/10 text-destructive hover:bg-destructive/20"
              onClick={() => { onTriageAll(); setPendingTriageAll(false); }}
            >
              {t('bulk.confirm')}
            </button>
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              onClick={() => setPendingTriageAll(false)}
            >
              {t('bulk.cancel')}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="ml-2 px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isOperating}
            onClick={() => setPendingTriageAll(true)}
            aria-label={t('aiTriage.triageAllButton')}
          >
            {t('aiTriage.triageAllButton')}
            <span className="ml-1 inline-flex items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
              {untriagedCount}
            </span>
          </button>
        )
      )}

      {isOperating && progress && (
        <span className="ml-auto text-xs text-muted-foreground">
          {t('bulk.processing', { current: progress.processedItems, total: progress.totalItems })}
        </span>
      )}
    </div>
  );
}
