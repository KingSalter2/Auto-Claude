/**
 * Triage Result Card — displays a single AI triage result for review.
 */

import { useTranslation } from 'react-i18next';
import { getConfidenceLevel } from '../../../../shared/constants/ai-triage';
import type { TriageReviewItem } from '../../../../shared/types/ai-triage';

const CONFIDENCE_COLORS = {
  high: 'bg-green-500/20 text-green-400',
  medium: 'bg-yellow-500/20 text-yellow-400',
  low: 'bg-red-500/20 text-red-400',
} as const;

interface TriageResultCardProps {
  item: TriageReviewItem;
  onAccept: (issueNumber: number) => void;
  onReject: (issueNumber: number) => void;
}

export function TriageResultCard({ item, onAccept, onReject }: TriageResultCardProps) {
  const { t } = useTranslation(['common']);
  const { result } = item;
  const level = getConfidenceLevel(result.confidence);
  const isPending = item.status === 'pending';

  return (
    <section
      className="rounded-lg border border-border/50 p-3 space-y-2"
      aria-label={t('common:aiTriage.resultCard', { issueNumber: item.issueNumber })}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground/70">#{item.issueNumber}</span>
          <span className="text-sm text-foreground truncate max-w-[200px]">{item.issueTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-1.5 py-0.5 rounded bg-foreground/10">{result.category}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CONFIDENCE_COLORS[level]}`}>
            {Math.round(result.confidence * 100)}%
          </span>
        </div>
      </div>

      {/* Labels */}
      <div className="flex flex-wrap gap-1">
        {result.labelsToAdd.map((label) => (
          <span key={`add-${label}`} className="text-xs px-1.5 py-0.5 rounded bg-green-500/20 text-green-400">
            +{label}
          </span>
        ))}
        {result.labelsToRemove.map((label) => (
          <span key={`rm-${label}`} className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
            -{label}
          </span>
        ))}
      </div>

      {/* Duplicate */}
      {result.isDuplicate && result.duplicateOf && (
        <div className="text-xs text-foreground/50">
          {t('common:aiTriage.duplicateOf')} <span className="font-medium">#{result.duplicateOf}</span>
        </div>
      )}

      {/* Status / Actions */}
      {item.status === 'accepted' && (
        <div className="text-xs text-green-400">{t('common:aiTriage.accepted')}</div>
      )}
      {item.status === 'rejected' && (
        <div className="text-xs text-red-400">{t('common:aiTriage.rejected')}</div>
      )}
      {item.status === 'auto-applied' && (
        <div className="text-xs text-blue-400">{t('common:aiTriage.autoApplied')}</div>
      )}

      {isPending && (
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            aria-label={t('common:aiTriage.acceptResult')}
            className="text-xs px-3 py-1 rounded bg-green-600 hover:bg-green-500 text-white transition-colors"
            onClick={() => onAccept(item.issueNumber)}
          >
            {t('common:aiTriage.accept')}
          </button>
          <button
            type="button"
            aria-label={t('common:aiTriage.rejectResult')}
            className="text-xs px-3 py-1 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
            onClick={() => onReject(item.issueNumber)}
          >
            {t('common:aiTriage.reject')}
          </button>
        </div>
      )}
    </section>
  );
}
