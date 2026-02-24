import { useTranslation } from 'react-i18next';
import { ChevronDown } from 'lucide-react';
import { PROVIDER_REGISTRY } from '@shared/constants/providers';
import type { BuiltinProvider } from '@shared/types/provider-account';
import { cn } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

const MAX_VISIBLE_TABS = 3;

interface ProviderTabBarProps {
  providers: BuiltinProvider[];
  activeProvider: BuiltinProvider;
  onProviderChange: (provider: BuiltinProvider) => void;
}

function getProviderDisplayName(provider: BuiltinProvider): string {
  const info = PROVIDER_REGISTRY.find((p) => p.id === provider);
  return info?.name ?? provider;
}

export function ProviderTabBar({
  providers,
  activeProvider,
  onProviderChange,
}: ProviderTabBarProps) {
  const { t } = useTranslation('settings');

  if (providers.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t('agentProfile.providerTabs.noProviders')}
      </p>
    );
  }

  const visibleProviders = providers.slice(0, MAX_VISIBLE_TABS);
  const overflowProviders = providers.slice(MAX_VISIBLE_TABS);
  const hasOverflow = overflowProviders.length > 0;
  const isActiveInOverflow = hasOverflow && overflowProviders.includes(activeProvider);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {visibleProviders.map((provider) => {
        const isActive = provider === activeProvider;
        return (
          <button
            key={provider}
            type="button"
            onClick={() => onProviderChange(provider)}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-full transition-colors',
              isActive
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {getProviderDisplayName(provider)}
          </button>
        );
      })}

      {hasOverflow && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-full transition-colors flex items-center gap-1',
                isActiveInOverflow
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              )}
            >
              {isActiveInOverflow
                ? getProviderDisplayName(activeProvider)
                : t('agentProfile.providerTabs.moreProviders')}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {overflowProviders.map((provider) => (
              <DropdownMenuItem
                key={provider}
                onClick={() => onProviderChange(provider)}
                className={cn(
                  provider === activeProvider && 'bg-accent text-accent-foreground'
                )}
              >
                {getProviderDisplayName(provider)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
