import { useTranslation } from 'react-i18next';
import { getWorkflowLabels } from '../../../../shared/constants/label-sync';

interface LabelSyncSettingsProps {
  enabled: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  error: string | null;
  onEnable: () => void;
  onDisable: (cleanup: boolean) => void;
}

export function LabelSyncSettings({
  enabled,
  isSyncing,
  lastSyncedAt,
  error,
  onEnable,
  onDisable,
}: LabelSyncSettingsProps) {
  const { t } = useTranslation('common');

  return (
    <section className="space-y-3" aria-label={t('labelSync.settings')}>
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-foreground">
            {t('labelSync.title')}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('labelSync.description')}
          </p>
        </div>
        <button
          type="button"
          className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            enabled
              ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
          onClick={() => enabled ? onDisable(false) : onEnable()}
          disabled={isSyncing}
          aria-busy={isSyncing}
        >
          {isSyncing
            ? t('labelSync.syncing')
            : enabled
              ? t('labelSync.disable')
              : t('labelSync.enable')}
        </button>
      </div>

      {enabled && lastSyncedAt && (
        <p className="text-xs text-muted-foreground">
          {t('labelSync.lastSynced', { date: new Date(lastSyncedAt).toLocaleDateString() })}
        </p>
      )}

      {enabled && (
        <button
          type="button"
          className="text-xs text-destructive hover:underline"
          onClick={() => onDisable(true)}
          disabled={isSyncing}
        >
          {t('labelSync.disableAndCleanup')}
        </button>
      )}

      {enabled && (
        <div className="flex flex-wrap gap-1.5">
          {getWorkflowLabels().map((label) => (
            <span
              key={label.name}
              data-testid="label-swatch"
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
              style={{ backgroundColor: `#${label.color}20`, color: `#${label.color}` }}
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: `#${label.color}` }}
              />
              {label.name}
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
