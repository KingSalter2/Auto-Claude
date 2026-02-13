import { useTranslation } from 'react-i18next';
import type { TriageMetrics, MetricsTimeWindow } from '../../../../shared/types/metrics';
import { formatDuration } from '../../../../shared/types/metrics';
import { WORKFLOW_STATE_COLORS } from '../../../../shared/constants/enrichment';
import type { WorkflowState } from '../../../../shared/types/enrichment';

interface MetricsDashboardProps {
  metrics: TriageMetrics;
  timeWindow: MetricsTimeWindow;
  isLoading: boolean;
  error: string | null;
  onTimeWindowChange: (window: MetricsTimeWindow) => void;
  onRefresh: () => void;
}

const TIME_WINDOWS: { value: MetricsTimeWindow; label: string }[] = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: 'all', label: 'All time' },
];

const STATE_ORDER: WorkflowState[] = ['new', 'triage', 'ready', 'in_progress', 'review', 'done', 'blocked'];

export function MetricsDashboard({
  metrics,
  timeWindow,
  isLoading,
  error,
  onTimeWindowChange,
  onRefresh,
}: MetricsDashboardProps) {
  const { t } = useTranslation('common');

  const totalIssues = STATE_ORDER.reduce((sum, s) => sum + (metrics.stateCounts[s] ?? 0), 0);

  return (
    <section className="space-y-4" aria-label={t('metrics.title')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-foreground">
          {t('metrics.title')}
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded border border-border overflow-hidden" role="group" aria-label={t('metrics.timeWindow')}>
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.value}
                type="button"
                aria-pressed={timeWindow === tw.value}
                className={`px-2 py-0.5 text-xs transition-colors ${
                  timeWindow === tw.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent'
                }`}
                onClick={() => onTimeWindowChange(tw.value)}
              >
                {tw.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={onRefresh}
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? t('metrics.computing') : t('metrics.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-xs text-destructive" role="alert">{error}</p>
      )}

      {/* State Distribution */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">
          {t('metrics.stateDistribution')}
        </h4>
        <div className="flex h-3 rounded-full overflow-hidden bg-muted">
          {STATE_ORDER.map((state) => {
            const count = metrics.stateCounts[state] ?? 0;
            const pct = totalIssues > 0 ? (count / totalIssues) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={state}
                className={`h-full transition-all ${WORKFLOW_STATE_COLORS[state].bg}`}
                style={{ width: `${pct}%` }}
                title={`${t(`enrichment.states.${state}`)}: ${count}`}
              />
            );
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {STATE_ORDER.map((state) => {
            const count = metrics.stateCounts[state] ?? 0;
            if (count === 0) return null;
            return (
              <div key={state} className="flex items-center gap-1 text-xs">
                <span
                  className={`w-2 h-2 rounded-full ${WORKFLOW_STATE_COLORS[state].bg}`}
                />
                <span className="text-muted-foreground">{t(`enrichment.states.${state}`)}</span>
                <span className="text-foreground font-medium">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completeness Distribution */}
      <div className="space-y-1">
        <h4 className="text-xs font-medium text-muted-foreground">
          {t('metrics.completeness')}
        </h4>
        <div className="grid grid-cols-4 gap-2">
          {(['low', 'medium', 'high', 'excellent'] as const).map((cat) => (
            <div key={cat} className="text-center">
              <div className="text-sm font-medium text-foreground">
                {metrics.completenessDistribution[cat]}
              </div>
              <div className="text-xs text-muted-foreground capitalize">
                {t(`metrics.completeness_${cat}`)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="text-center p-2 bg-card rounded border border-border">
          <div className="text-sm font-medium text-foreground">
            {metrics.totalTransitions}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('metrics.transitions')}
          </div>
        </div>
        <div className="text-center p-2 bg-card rounded border border-border">
          <div className="text-sm font-medium text-foreground">
            {metrics.avgBacklogAge > 0 ? formatDuration(metrics.avgBacklogAge) : '—'}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('metrics.avgBacklog')}
          </div>
        </div>
        <div className="text-center p-2 bg-card rounded border border-border">
          <div className="text-sm font-medium text-foreground">
            {metrics.weeklyThroughput.length > 0
              ? metrics.weeklyThroughput[metrics.weeklyThroughput.length - 1].count
              : 0}
          </div>
          <div className="text-xs text-muted-foreground">
            {t('metrics.thisWeek')}
          </div>
        </div>
      </div>
    </section>
  );
}
