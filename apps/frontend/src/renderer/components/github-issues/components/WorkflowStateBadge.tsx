import { Badge } from '../../ui/badge';
import {
  WORKFLOW_STATE_COLORS,
  WORKFLOW_STATE_LABELS,
} from '../../../../shared/constants/enrichment';
import type { WorkflowState } from '../../../../shared/types/enrichment';

interface WorkflowStateBadgeProps {
  state: WorkflowState;
}

export function WorkflowStateBadge({ state }: WorkflowStateBadgeProps) {
  const colors = WORKFLOW_STATE_COLORS[state];
  const label = WORKFLOW_STATE_LABELS[state];

  return (
    <div aria-live="polite">
      <Badge
        variant="outline"
        className={`text-xs ${colors.bg} ${colors.text}`}
        role="status"
        aria-label={label}
      >
        {label}
      </Badge>
    </div>
  );
}
