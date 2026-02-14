import { useTranslation } from 'react-i18next';
import { Github, RefreshCw, Wand2, Loader2, EyeOff, Eye, XCircle } from 'lucide-react';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../../ui/tooltip';
import type { IssueListHeaderProps } from '../types';
import type { InvestigationState } from '@shared/types';

const INVESTIGATION_STATE_LABELS: Record<InvestigationState, string> = {
  new: 'investigation.stateFilters.new',
  queued: 'investigation.stateFilters.queued',
  investigating: 'investigation.stateFilters.investigating',
  interrupted: 'investigation.stateFilters.interrupted',
  findings_ready: 'investigation.stateFilters.findingsReady',
  resolved: 'investigation.stateFilters.resolved',
  failed: 'investigation.stateFilters.failed',
  task_created: 'investigation.stateFilters.taskCreated',
  building: 'investigation.stateFilters.building',
  done: 'investigation.stateFilters.done',
};

const INVESTIGATION_STATE_DEFAULTS: Record<InvestigationState, string> = {
  new: 'New',
  queued: 'Queued',
  investigating: 'Investigating',
  interrupted: 'Interrupted',
  findings_ready: 'Findings Ready',
  resolved: 'Resolved',
  failed: 'Failed',
  task_created: 'Task Created',
  building: 'Building',
  done: 'Done',
};

const INVESTIGATION_STATE_COLORS: Record<InvestigationState, string> = {
  new: 'bg-muted text-muted-foreground',
  queued: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  investigating: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  interrupted: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  findings_ready: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  task_created: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  building: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const FILTER_STATES: InvestigationState[] = ['new', 'investigating', 'findings_ready', 'task_created', 'done', 'failed'];

export function IssueListHeader({
  repoFullName,
  openIssuesCount,
  isLoading,
  onRefresh,
  autoFixEnabled,
  autoFixRunning,
  autoFixProcessing,
  onAutoFixToggle,
  // Investigation system (F5)
  investigationStateFilter,
  onInvestigationStateFilterChange,
  investigationStateCounts,
  showDismissed,
  onToggleShowDismissed,
  activeInvestigationCount,
  onCancelAllInvestigations,
  children,
}: IssueListHeaderProps) {
  const { t } = useTranslation('common');

  const toggleInvestigationState = (state: InvestigationState) => {
    if (!onInvestigationStateFilterChange) return;
    const current = investigationStateFilter ?? [];
    if (current.includes(state)) {
      onInvestigationStateFilterChange(current.filter(s => s !== state));
    } else {
      onInvestigationStateFilterChange([...current, state]);
    }
  };

  return (
    <div className="shrink-0 p-4 border-b border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted">
            <Github className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              {t('issues.title')}
            </h2>
            <p className="text-xs text-muted-foreground">
              {repoFullName}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {t('issues.openCount', { count: openIssuesCount })}
          </Badge>
          {activeInvestigationCount != null && activeInvestigationCount > 0 && (
            <>
              <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {t('investigation.stateFilters.activeCount', { count: activeInvestigationCount, defaultValue: '{{count}} investigating' })}
              </Badge>
              {onCancelAllInvestigations && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onCancelAllInvestigations}
                  className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  {t('investigation.button.cancelAll', 'Cancel All')}
                </Button>
              )}
            </>
          )}
          {onToggleShowDismissed && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={showDismissed ? 'secondary' : 'ghost'}
                    size="icon"
                    onClick={onToggleShowDismissed}
                    aria-label={t('investigation.stateFilters.showDismissed')}
                    aria-pressed={showDismissed}
                  >
                    {showDismissed ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{showDismissed
                    ? t('investigation.stateFilters.hideDismissedTooltip', 'Hide dismissed issues')
                    : t('investigation.stateFilters.showDismissedTooltip', 'Show dismissed issues')
                  }</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onRefresh}
            disabled={isLoading}
            aria-label={t('buttons.refresh')}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Issue Management Actions */}
      <div className="flex items-center gap-3 mb-4">
        {/* Auto-Fix Toggle */}
        {onAutoFixToggle && (
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-2">
                    {autoFixRunning ? (
                      <Loader2 className="h-4 w-4 text-primary animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 text-muted-foreground" />
                    )}
                    <Label htmlFor="auto-fix-toggle" className="text-sm cursor-pointer whitespace-nowrap">
                      {t('issues.autoFixNew')}
                    </Label>
                    <Switch
                      id="auto-fix-toggle"
                      checked={autoFixEnabled ?? false}
                      onCheckedChange={onAutoFixToggle}
                      disabled={autoFixRunning}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p>{t('issues.autoFixTooltip')}</p>
                  {autoFixRunning && autoFixProcessing !== undefined && autoFixProcessing > 0 && (
                    <p className="mt-1 text-primary">{t('issues.autoFixProcessing', { count: autoFixProcessing })}</p>
                  )}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      {/* Investigation State Filter Chips */}
      {onInvestigationStateFilterChange && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {FILTER_STATES.map((state) => {
            const isActive = investigationStateFilter?.includes(state) ?? false;
            const count = investigationStateCounts?.[state];
            return (
              <button
                key={state}
                type="button"
                onClick={() => toggleInvestigationState(state)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                  isActive
                    ? INVESTIGATION_STATE_COLORS[state]
                    : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                }`}
              >
                {t(INVESTIGATION_STATE_LABELS[state], INVESTIGATION_STATE_DEFAULTS[state])}
                {count != null && count > 0 && (
                  <span className="text-[10px] opacity-70">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {children}
    </div>
  );
}
