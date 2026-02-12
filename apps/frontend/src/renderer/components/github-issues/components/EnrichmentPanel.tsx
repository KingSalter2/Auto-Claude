import { WorkflowStateDropdown } from './WorkflowStateDropdown';
import { CompletenessIndicator } from './CompletenessIndicator';
import { Badge } from '../../ui/badge';
import type { WorkflowState, Resolution, IssueEnrichment } from '../../../../shared/types/enrichment';

interface EnrichmentPanelProps {
  enrichment: IssueEnrichment | null;
  currentState: WorkflowState;
  previousState?: WorkflowState | null;
  isAgentLocked?: boolean;
  onTransition: (to: WorkflowState, resolution?: Resolution) => void;
  completenessScore: number;
}

const ENRICHMENT_SECTIONS = [
  { key: 'problem', label: 'Problem Statement' },
  { key: 'goal', label: 'Goal' },
  { key: 'scopeIn', label: 'In Scope' },
  { key: 'scopeOut', label: 'Out of Scope' },
  { key: 'acceptanceCriteria', label: 'Acceptance Criteria' },
  { key: 'technicalContext', label: 'Technical Context' },
] as const;

export function EnrichmentPanel({
  enrichment,
  currentState,
  previousState,
  isAgentLocked,
  onTransition,
  completenessScore,
}: EnrichmentPanelProps) {
  const enrichmentData = enrichment?.enrichment;
  const priority = enrichment?.priority;

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
          <span className="text-xs text-muted-foreground">No priority</span>
        )}
      </div>

      {/* Completeness score */}
      <div>
        <h4 className="text-xs font-medium text-muted-foreground mb-1">Completeness</h4>
        <CompletenessIndicator score={completenessScore} />
      </div>

      {/* Enrichment sections */}
      <div className="space-y-3">
        {ENRICHMENT_SECTIONS.map(({ key, label }) => {
          const value = enrichmentData?.[key];
          const hasContent = Array.isArray(value) ? value.length > 0 : !!value?.trim();

          return (
            <div key={key}>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">{label}</h4>
              {hasContent ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {Array.isArray(value) ? value.join('\n') : value}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">Not yet enriched</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
