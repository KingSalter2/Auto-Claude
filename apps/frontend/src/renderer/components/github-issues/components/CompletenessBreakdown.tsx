/**
 * @deprecated Legacy completeness breakdown — replaced by investigation report details.
 * Kept for backwards compatibility. Will be removed in a future cleanup pass.
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Circle, ChevronDown, ChevronRight } from 'lucide-react';
import type { IssueEnrichment } from '@shared/types/enrichment';
import { COMPLETENESS_WEIGHTS } from '@shared/constants/enrichment';

interface CompletenessBreakdownProps {
  enrichment: IssueEnrichment['enrichment'];
  score: number;
  onSectionClick?: (section: string) => void;
}

const SECTION_LABELS: Record<string, string> = {
  problem: 'Problem',
  goal: 'Goal',
  scopeIn: 'Scope In',
  scopeOut: 'Scope Out',
  acceptanceCriteria: 'Acceptance Criteria',
  technicalContext: 'Technical Context',
  risksEdgeCases: 'Risks & Edge Cases',
};

const ALL_SECTIONS = Object.keys(SECTION_LABELS);

function isFilled(enrichment: IssueEnrichment['enrichment'], section: string): boolean {
  const value = enrichment[section as keyof typeof enrichment];
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return false;
}

export function CompletenessBreakdown({
  enrichment,
  score,
  onSectionClick,
}: CompletenessBreakdownProps) {
  const { t } = useTranslation('common');
  const [expanded, setExpanded] = useState(false);

  return (
    <section aria-label={t('completenessBreakdown.title')} className="space-y-2">
      {/* Header / toggle */}
      <button
        type="button"
        className="flex items-center gap-2 text-sm font-medium hover:text-foreground"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>{score}%</span>
      </button>

      {/* Progress bar */}
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${score}%` }}
        />
      </div>

      {/* Sections list */}
      {expanded && (
        <ul className="space-y-1 pt-1">
          {ALL_SECTIONS.map((section) => {
            const filled = isFilled(enrichment, section);
            const weight = COMPLETENESS_WEIGHTS[section];
            const label = SECTION_LABELS[section];
            return (
              <li key={section} className="flex items-center gap-2 text-xs">
                {filled ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-label={t('completenessBreakdown.filled')} />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-label={t('completenessBreakdown.empty')} />
                )}
                <button
                  type="button"
                  className="flex-1 text-left hover:underline disabled:no-underline"
                  disabled={!onSectionClick}
                  onClick={() => onSectionClick?.(section)}
                >
                  {label}
                </button>
                <span className="text-muted-foreground">
                  {Math.round(weight * 100)}%
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
