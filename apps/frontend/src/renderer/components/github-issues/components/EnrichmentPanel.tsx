import { useTranslation } from 'react-i18next';
import { WorkflowStateDropdown } from './WorkflowStateDropdown';
import { CompletenessIndicator } from './CompletenessIndicator';
import { CompletenessBreakdown } from './CompletenessBreakdown';
import { Badge } from '../../ui/badge';
import type { WorkflowState, Resolution, IssueEnrichment } from '@shared/types/enrichment';

interface EnrichmentPanelProps {
  enrichment: IssueEnrichment | null;
  currentState: WorkflowState;
  previousState?: WorkflowState | null;
  isAgentLocked?: boolean;
  onTransition: (to: WorkflowState, resolution?: Resolution) => void;
  completenessScore: number;
  onAITriage?: () => void;
  onImproveIssue?: () => void;
  onSplitIssue?: () => void;
  lastError?: string | null;
  onRetry?: () => void;
  onPostComment?: () => void;
  onDismissComment?: () => void;
  hasExistingAIComment?: boolean;
}

const ENRICHMENT_SECTION_KEYS = [
  { key: 'problem', i18nKey: 'enrichment.panel.problemStatement' },
  { key: 'goal', i18nKey: 'enrichment.panel.goal' },
  { key: 'scopeIn', i18nKey: 'enrichment.panel.inScope' },
  { key: 'scopeOut', i18nKey: 'enrichment.panel.outOfScope' },
  { key: 'acceptanceCriteria', i18nKey: 'enrichment.panel.acceptanceCriteria' },
  { key: 'technicalContext', i18nKey: 'enrichment.panel.technicalContext' },
  { key: 'risksEdgeCases', i18nKey: 'enrichment.panel.risksEdgeCases' },
] as const;

export function EnrichmentPanel({
  enrichment,
  currentState,
  previousState,
  isAgentLocked,
  onTransition,
  completenessScore,
  onAITriage,
  onImproveIssue,
  onSplitIssue,
  lastError,
  onRetry,
  onPostComment,
  onDismissComment,
  hasExistingAIComment,
}: EnrichmentPanelProps) {
  const { t } = useTranslation('common');
  const enrichmentData = enrichment?.enrichment;
  const priority = enrichment?.priority;
  const showTriageButton = currentState === 'new' || currentState === 'triage';
  const showActionButtons = currentState !== 'done';

  return (
    <div className="space-y-4">
      {/* Workflow state + priority row */}
      <div className="flex items-center gap-3" aria-live="polite">
        <WorkflowStateDropdown
          currentState={currentState}
          previousState={previousState}
          isAgentLocked={isAgentLocked}
          onTransition={onTransition}
        />
        {priority ? (
          <Badge variant="outline" className="text-xs capitalize">
            {priority}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">{t('enrichment.panel.noPriority')}</span>
        )}
      </div>

      {/* Completeness score */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1">{t('enrichment.panel.completeness')}</h4>
        <CompletenessIndicator score={completenessScore} />
      </div>

      {/* Completeness breakdown */}
      {enrichmentData && (
        <CompletenessBreakdown
          enrichment={enrichmentData}
          score={completenessScore}
        />
      )}

      {/* Error display with retry */}
      {lastError && (
        <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <span className="flex-1">{lastError}</span>
          {onRetry && (
            <button
              type="button"
              className="shrink-0 rounded-md border border-destructive/30 px-2 py-0.5 text-xs hover:bg-destructive/20"
              onClick={onRetry}
              aria-label={t('aiTriage.retry')}
            >
              {t('aiTriage.retry')}
            </button>
          )}
        </div>
      )}

      {/* AI action buttons */}
      {showActionButtons && (
        <div className="flex items-center gap-2">
          {showTriageButton && onAITriage && (
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              onClick={onAITriage}
              aria-label={t('aiTriage.enrichButton')}
            >
              {t('aiTriage.enrichButton')}
            </button>
          )}
          {onImproveIssue && (
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              onClick={onImproveIssue}
              aria-label={t('aiTriage.improveButton')}
            >
              {t('aiTriage.improveButton')}
            </button>
          )}
          {onSplitIssue && (
            <button
              type="button"
              className="px-2.5 py-1 text-xs rounded-md border border-border bg-card hover:bg-accent"
              onClick={onSplitIssue}
              aria-label={t('aiTriage.splitButton')}
            >
              {t('aiTriage.splitButton')}
            </button>
          )}
        </div>
      )}

      {/* Enrichment sections */}
      <div className="space-y-3">
        {ENRICHMENT_SECTION_KEYS.map(({ key, i18nKey }) => {
          const value = enrichmentData?.[key];
          const hasContent = Array.isArray(value) ? value.length > 0 : !!value?.trim();

          return (
            <div key={key}>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">{t(i18nKey)}</h4>
              {hasContent ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {Array.isArray(value) ? value.join('\n') : value}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">{t('enrichment.panel.notYetEnriched')}</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Post enrichment comment */}
      {onPostComment && (
        <div className="border-t border-border pt-3 space-y-2">
          {hasExistingAIComment && (
            <div role="alert" className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-600 dark:text-yellow-400">
              {t('enrichmentComment.duplicateWarning')}
            </div>
          )}
          <div className="flex gap-2">
            {onDismissComment && (
              <button
                type="button"
                className="flex-1 text-xs px-3 py-1.5 rounded-md bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
                onClick={onDismissComment}
                aria-label={t('enrichmentComment.cancel')}
              >
                {t('enrichmentComment.cancel')}
              </button>
            )}
            <button
              type="button"
              className="flex-1 text-xs px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              onClick={onPostComment}
              aria-label={t('enrichmentComment.post')}
            >
              {t('enrichmentComment.post')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
