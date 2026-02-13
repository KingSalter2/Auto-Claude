import { ScrollArea } from '../../ui/scroll-area';
import { EnrichmentPanel } from './EnrichmentPanel';
import { DependencyList } from './DependencyList';
import { MetricsDashboard } from './MetricsDashboard';
import type { TriageSidebarProps } from '../types';

export function TriageSidebar({
  enrichment,
  currentState,
  previousState,
  isAgentLocked,
  onTransition,
  completenessScore,
  onAITriage,
  onImproveIssue,
  onSplitIssue,
  isAIBusy,
  dependencies,
  isDepsLoading,
  depsError,
  metrics,
  metricsTimeWindow,
  isMetricsLoading,
  onTimeWindowChange,
  onRefreshMetrics,
}: TriageSidebarProps) {
  return (
    <section aria-label="Triage sidebar">
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-4">
          <EnrichmentPanel
            enrichment={enrichment}
            currentState={currentState}
            previousState={previousState}
            isAgentLocked={isAgentLocked}
            onTransition={onTransition}
            completenessScore={completenessScore}
            onAITriage={isAIBusy ? undefined : onAITriage}
            onImproveIssue={isAIBusy ? undefined : onImproveIssue}
            onSplitIssue={isAIBusy ? undefined : onSplitIssue}
          />
          {dependencies && (
            <DependencyList
              dependencies={dependencies}
              isLoading={isDepsLoading ?? false}
              error={depsError ?? null}
            />
          )}
          {metrics && onTimeWindowChange && onRefreshMetrics && (
            <MetricsDashboard
              metrics={metrics}
              timeWindow={metricsTimeWindow ?? '30d'}
              isLoading={isMetricsLoading ?? false}
              error={null}
              onTimeWindowChange={onTimeWindowChange}
              onRefresh={onRefreshMetrics}
            />
          )}
        </div>
      </ScrollArea>
    </section>
  );
}
