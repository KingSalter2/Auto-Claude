import { useTranslation } from 'react-i18next';
import type { IssueDependencies } from '../../../../shared/types/dependencies';
import { hasDependencies, totalDependencyCount } from '../../../../shared/types/dependencies';

interface DependencyListProps {
  dependencies: IssueDependencies;
  isLoading: boolean;
  error: string | null;
  onRefresh?: () => void;
}

export function DependencyList({
  dependencies,
  isLoading,
  error,
  onRefresh,
}: DependencyListProps) {
  const { t } = useTranslation('common');
  const hasData = hasDependencies(dependencies);
  const total = totalDependencyCount(dependencies);

  if (isLoading) {
    return (
      <output className="text-xs text-muted-foreground italic block">
        {t('dependencies.loading')}
      </output>
    );
  }

  if (error) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-destructive" role="alert">{error}</p>
        {onRefresh && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            onClick={onRefresh}
          >
            {t('dependencies.retry')}
          </button>
        )}
      </div>
    );
  }

  if (!hasData) {
    return (
      <p className="text-xs text-muted-foreground italic">
        {t('dependencies.none')}
      </p>
    );
  }

  return (
    <section className="space-y-2" aria-label={t('dependencies.title')}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">
          {t('dependencies.title')}
        </span>
        <span className="text-xs text-muted-foreground">
          {total}
        </span>
      </div>

      {dependencies.tracks.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">
            {t('dependencies.tracks')}
          </span>
          <ul className="space-y-0.5">
            {dependencies.tracks.map((dep) => (
              <li
                key={`track-${dep.issueNumber}-${dep.repo ?? 'local'}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dep.state === 'open' ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                />
                <span className="text-foreground">
                  {dep.repo ? `${dep.repo}#${dep.issueNumber}` : `#${dep.issueNumber}`}
                </span>
                <span className="text-muted-foreground truncate">{dep.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {dependencies.trackedBy.length > 0 && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground font-medium">
            {t('dependencies.trackedBy')}
          </span>
          <ul className="space-y-0.5">
            {dependencies.trackedBy.map((dep) => (
              <li
                key={`trackedBy-${dep.issueNumber}-${dep.repo ?? 'local'}`}
                className="flex items-center gap-1.5 text-xs"
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    dep.state === 'open' ? 'bg-green-500' : 'bg-purple-500'
                  }`}
                />
                <span className="text-foreground">
                  {dep.repo ? `${dep.repo}#${dep.issueNumber}` : `#${dep.issueNumber}`}
                </span>
                <span className="text-muted-foreground truncate">{dep.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
