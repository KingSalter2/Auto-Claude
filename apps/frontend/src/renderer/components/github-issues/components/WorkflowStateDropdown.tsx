import { ChevronDown } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '../../ui/dropdown-menu';
import {
  WORKFLOW_STATE_COLORS,
  WORKFLOW_STATE_LABELS,
  getValidTargets,
} from '../../../../shared/constants/enrichment';
import type { WorkflowState, Resolution } from '../../../../shared/types/enrichment';

const RESOLUTIONS: { value: Resolution; label: string }[] = [
  { value: 'completed', label: 'Completed' },
  { value: 'split', label: 'Split' },
  { value: 'duplicate', label: 'Duplicate' },
  { value: 'wontfix', label: "Won't fix" },
  { value: 'stale', label: 'Stale' },
];

interface WorkflowStateDropdownProps {
  currentState: WorkflowState;
  previousState?: WorkflowState | null;
  isAgentLocked?: boolean;
  onTransition: (to: WorkflowState, resolution?: Resolution) => void;
}

export function WorkflowStateDropdown({
  currentState,
  previousState,
  isAgentLocked,
  onTransition,
}: WorkflowStateDropdownProps) {
  const isBlocked = currentState === 'blocked';
  const targets = isBlocked ? [] : getValidTargets(currentState);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5"
          disabled={isAgentLocked}
          aria-label="Change workflow state"
          title={isAgentLocked ? 'Agent is currently working on this issue' : undefined}
        >
          <span
            className={`inline-block w-2 h-2 rounded-full ${WORKFLOW_STATE_COLORS[currentState].bg}`}
          />
          {WORKFLOW_STATE_LABELS[currentState]}
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>Move to</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isBlocked && previousState && (
          <DropdownMenuItem onSelect={() => onTransition(previousState)}>
            <span
              className={`inline-block w-2 h-2 rounded-full mr-2 ${WORKFLOW_STATE_COLORS[previousState].bg}`}
            />
            Unblock → {WORKFLOW_STATE_LABELS[previousState]}
          </DropdownMenuItem>
        )}
        {targets.map((target) => {
          if (target === 'done') {
            return (
              <DropdownMenuSub key={target}>
                <DropdownMenuSubTrigger>
                  <span
                    className={`inline-block w-2 h-2 rounded-full mr-2 ${WORKFLOW_STATE_COLORS.done.bg}`}
                  />
                  {WORKFLOW_STATE_LABELS.done}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuLabel>Resolution</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {RESOLUTIONS.map((res) => (
                    <DropdownMenuItem
                      key={res.value}
                      onSelect={() => onTransition('done', res.value)}
                    >
                      {res.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            );
          }

          return (
            <DropdownMenuItem key={target} onSelect={() => onTransition(target)}>
              <span
                className={`inline-block w-2 h-2 rounded-full mr-2 ${WORKFLOW_STATE_COLORS[target].bg}`}
              />
              {WORKFLOW_STATE_LABELS[target]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
