/**
 * Batch Triage Review — review queue for batch triage results.
 */

import { useTranslation } from 'react-i18next';
import { TriageResultCard } from './TriageResultCard';
import type { TriageReviewItem } from '../../../../shared/types/ai-triage';

interface BatchTriageReviewProps {
  items: TriageReviewItem[];
  onAccept: (issueNumber: number) => void;
  onReject: (issueNumber: number) => void;
  onAcceptAll: () => void;
  onDismiss: () => void;
  onApply: () => void;
  onUndo?: () => void;
}

export function BatchTriageReview({
  items,
  onAccept,
  onReject,
  onAcceptAll,
  onDismiss,
  onApply,
  onUndo,
}: BatchTriageReviewProps) {
  const { t } = useTranslation(['common']);
  const reviewed = items.filter((i) => i.status !== 'pending').length;
  const total = items.length;
  const hasAccepted = items.some((i) => i.status === 'accepted' || i.status === 'auto-applied');
  const hasPending = items.some((i) => i.status === 'pending');

  if (items.length === 0) {
    return (
      <section className="text-center py-8 text-foreground/50" aria-label={t('common:batchReview.title')}>
        <p>{t('common:batchReview.noResults')}</p>
      </section>
    );
  }

  // Sort by confidence ascending (lowest first for review)
  const sorted = [...items].sort((a, b) => a.result.confidence - b.result.confidence);

  return (
    <section className="space-y-3" aria-label={t('common:batchReview.title')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground/70">
          {t('common:batchReview.reviewed', { reviewed: String(reviewed), total: String(total) })}
        </span>
        <div className="flex gap-2">
          {hasPending && (
            <button
              type="button"
              aria-label={t('common:batchReview.acceptAllRemaining')}
              className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
              onClick={onAcceptAll}
            >
              {t('common:batchReview.acceptAll')}
            </button>
          )}
          {hasAccepted && (
            <button
              type="button"
              className="text-xs px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              onClick={onApply}
            >
              {t('common:batchReview.apply')}
            </button>
          )}
          {onUndo && (
            <button
              type="button"
              aria-label={t('common:batchReview.undo')}
              className="text-xs px-3 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white transition-colors"
              onClick={onUndo}
            >
              {t('common:batchReview.undo')}
            </button>
          )}
          <button
            type="button"
            aria-label={t('common:batchReview.dismiss')}
            className="text-xs px-3 py-1 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
            onClick={onDismiss}
          >
            {t('common:batchReview.dismiss')}
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {sorted.map((item) => (
          <div key={item.issueNumber} className="relative">
            {item.status === 'auto-applied' && (
              <span className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 z-10">
                {t('common:batchReview.auto')}
              </span>
            )}
            <TriageResultCard item={item} onAccept={onAccept} onReject={onReject} />
          </div>
        ))}
      </div>
    </section>
  );
}
