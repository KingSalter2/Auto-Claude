/**
 * Progressive Trust Settings — configure auto-apply thresholds per category.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ProgressiveTrustConfig } from '../../../../shared/types/ai-triage';
import { THRESHOLD_MIN, THRESHOLD_MAX, THRESHOLD_STEP } from '../../../../shared/constants/ai-triage';

const CATEGORIES = ['type', 'priority', 'labels', 'duplicate'] as const;
type Category = (typeof CATEGORIES)[number];

interface ProgressiveTrustSettingsProps {
  config: ProgressiveTrustConfig;
  onSave: (config: ProgressiveTrustConfig) => void;
  onCancel: () => void;
}

export function ProgressiveTrustSettings({ config: initialConfig, onSave, onCancel }: ProgressiveTrustSettingsProps) {
  const { t } = useTranslation(['common']);
  const [config, setConfig] = useState<ProgressiveTrustConfig>(() =>
    JSON.parse(JSON.stringify(initialConfig)),
  );

  const toggleCategory = (category: Category) => {
    setConfig((prev) => ({
      ...prev,
      autoApply: {
        ...prev.autoApply,
        [category]: {
          ...prev.autoApply[category],
          enabled: !prev.autoApply[category].enabled,
        },
      },
    }));
  };

  const setThreshold = (category: Category, threshold: number) => {
    setConfig((prev) => ({
      ...prev,
      autoApply: {
        ...prev.autoApply,
        [category]: {
          ...prev.autoApply[category],
          threshold,
        },
      },
    }));
  };

  return (
    <section className="space-y-4" aria-label={t('common:progressiveTrust.title')}>
      {/* Category rows */}
      {CATEGORIES.map((category) => (
        <div key={category} className="flex items-center gap-3">
          <label className="flex items-center gap-2 min-w-[120px]">
            <input
              type="checkbox"
              checked={config.autoApply[category].enabled}
              onChange={() => toggleCategory(category)}
              className="rounded"
            />
            <span className="text-sm capitalize">{t(`common:progressiveTrust.${category}`)}</span>
          </label>
          <input
            type="range"
            min={THRESHOLD_MIN}
            max={THRESHOLD_MAX}
            step={THRESHOLD_STEP}
            value={config.autoApply[category].threshold}
            onChange={(e) => setThreshold(category, Number.parseFloat(e.target.value))}
            disabled={!config.autoApply[category].enabled}
            className="flex-1"
            aria-label={t('common:progressiveTrust.threshold', { category })}
          />
          <span className="text-xs text-foreground/50 w-10 text-right">
            {Math.round(config.autoApply[category].threshold * 100)}%
          </span>
        </div>
      ))}

      {/* Batch size */}
      <div className="flex items-center gap-3">
        <label className="text-sm min-w-[120px]">{t('common:progressiveTrust.batchSize')}</label>
        <input
          type="number"
          value={config.batchSize}
          onChange={(e) => setConfig((prev) => ({ ...prev, batchSize: Number.parseInt(e.target.value, 10) || 0 }))}
          className="w-20 bg-transparent text-sm border border-border/50 rounded px-2 py-1 outline-none"
          min={1}
          max={200}
        />
      </div>

      {/* Confirm above */}
      <div className="flex items-center gap-3">
        <label className="text-sm min-w-[120px]">{t('common:progressiveTrust.confirmAbove')}</label>
        <input
          type="number"
          value={config.confirmAbove}
          onChange={(e) => setConfig((prev) => ({ ...prev, confirmAbove: Number.parseInt(e.target.value, 10) || 0 }))}
          className="w-20 bg-transparent text-sm border border-border/50 rounded px-2 py-1 outline-none"
          min={0}
          max={100}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          aria-label={t('common:progressiveTrust.cancel')}
          className="text-xs px-3 py-1.5 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
          onClick={onCancel}
        >
          {t('common:progressiveTrust.cancel')}
        </button>
        <button
          type="button"
          aria-label={t('common:progressiveTrust.save')}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
          onClick={() => onSave(config)}
        >
          {t('common:progressiveTrust.save')}
        </button>
      </div>
    </section>
  );
}
