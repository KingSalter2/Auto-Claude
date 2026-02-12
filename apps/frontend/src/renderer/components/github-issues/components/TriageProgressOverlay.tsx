/**
 * Triage Progress Overlay — shows progress bar with cancel button.
 */

import { useTranslation } from 'react-i18next';
import type { EnrichmentProgress } from '../../../../shared/types/ai-triage';

interface TriageProgressOverlayProps {
  progress: EnrichmentProgress;
  onCancel: () => void;
}

export function TriageProgressOverlay({ progress, onCancel }: TriageProgressOverlayProps) {
  const { t } = useTranslation(['common']);

  return (
    <section
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      aria-label={t('common:aiTriage.progressOverlay')}
    >
      <div className="bg-background border border-border rounded-lg p-6 w-80 space-y-4">
        <p className="text-sm text-foreground">{progress.message}</p>

        {/* Progress bar */}
        <div
          role="progressbar"
          aria-valuenow={progress.progress}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-2 bg-foreground/10 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress.progress}%` }}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            aria-label={t('common:aiTriage.cancel')}
            className="text-xs px-3 py-1.5 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
            onClick={onCancel}
          >
            {t('common:aiTriage.cancel')}
          </button>
        </div>
      </div>
    </section>
  );
}
