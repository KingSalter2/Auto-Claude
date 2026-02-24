import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useActiveProvider } from '../../hooks/useActiveProvider';
import { PROVIDER_REGISTRY } from '@shared/constants/providers';
import type { BuiltinProvider } from '@shared/types/provider-account';
import { ProviderTabBar } from './ProviderTabBar';
import { AgentProfileSettings } from './AgentProfileSettings';
import { FeatureModelSettings } from './FeatureModelSettings';
import { ProviderModelOverrides } from './ProviderModelOverrides';
import { Separator } from '../ui/separator';

/**
 * ProviderAgentTabs
 *
 * Orchestrator wrapper for the entire agent settings section.
 * Shows a provider tab bar and renders agent/feature/override settings
 * scoped to the selected provider.
 */
export function ProviderAgentTabs() {
  const { t } = useTranslation('settings');
  const { connectedProviders } = useActiveProvider();

  // Order: anthropic first, then remaining providers alphabetically
  const orderedProviders = useMemo<BuiltinProvider[]>(() => {
    const sorted = [...connectedProviders].sort((a, b) => a.localeCompare(b));
    const anthIdx = sorted.indexOf('anthropic');
    if (anthIdx > 0) {
      sorted.splice(anthIdx, 1);
      sorted.unshift('anthropic');
    }
    return sorted;
  }, [connectedProviders]);

  const [activeTab, setActiveTab] = useState<BuiltinProvider | null>(null);

  // Keep active tab valid when providers change; fall back to first in list
  const resolvedTab: BuiltinProvider | null =
    activeTab && orderedProviders.includes(activeTab)
      ? activeTab
      : orderedProviders[0] ?? null;

  if (orderedProviders.length === 0) {
    return (
      <div className="rounded-lg bg-muted/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t('agentProfile.providerTabs.noProviders')}
        </p>
      </div>
    );
  }

  const providerDisplayName =
    resolvedTab !== null
      ? (PROVIDER_REGISTRY.find((p) => p.id === resolvedTab)?.name ?? resolvedTab)
      : '';

  return (
    <div className="space-y-6">
      {/* Section heading */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-1">{t('agentProfile.title')}</h3>
        <p className="text-sm text-muted-foreground">{t('agentProfile.sectionDescription')}</p>
      </div>
      <Separator />

      {/* Tab strip (below heading) */}
      <ProviderTabBar
        providers={orderedProviders}
        activeProvider={resolvedTab as BuiltinProvider}
        onProviderChange={(provider) => setActiveTab(provider)}
      />

      {/* Subtitle */}
      {resolvedTab !== null && (
        <p className="text-sm text-muted-foreground">
          {t('agentProfile.providerTabs.configureFor', { provider: providerDisplayName })}
        </p>
      )}

      {/* Provider-scoped agent profile settings */}
      <AgentProfileSettings provider={resolvedTab} />

      {/* Provider-scoped feature model settings */}
      <FeatureModelSettings provider={resolvedTab} />

      {/* Provider model overrides (manages its own provider state) */}
      <ProviderModelOverrides />
    </div>
  );
}
