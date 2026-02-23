import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { useSettingsStore } from '../../stores/settings-store';
import { useToast } from '../../hooks/use-toast';
import { PROVIDER_REGISTRY } from '@shared/constants/providers';
import { ProviderSection } from './ProviderSection';
import { AddAccountDialog } from './AddAccountDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '../ui/alert-dialog';
import type { BuiltinProvider, ProviderAccount } from '@shared/types/provider-account';

export function ProviderAccountsList() {
  const { t } = useTranslation('settings');
  const {
    deleteProviderAccount,
    setActiveProviderAccount,
    getProviderAccounts,
    checkEnvCredentials,
    envCredentials,
  } = useSettingsStore();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // AddAccountDialog state
  const [dialogState, setDialogState] = useState<{
    open: boolean;
    provider: BuiltinProvider;
    authType: 'oauth' | 'api-key';
    editAccount?: ProviderAccount;
  }>({
    open: false,
    provider: 'anthropic',
    authType: 'api-key',
  });

  // Check env credentials on mount
  useEffect(() => {
    checkEnvCredentials().catch(() => {
      // Non-fatal
    });
  }, [checkEnvCredentials]);

  const allAccounts = getProviderAccounts();

  // Group accounts by provider, preserving PROVIDER_REGISTRY order
  const accountsByProvider = PROVIDER_REGISTRY.reduce<Map<BuiltinProvider, ProviderAccount[]>>(
    (map, p) => {
      map.set(p.id, allAccounts.filter(a => a.provider === p.id));
      return map;
    },
    new Map()
  );

  // Sort: providers with accounts first, then empty
  const sortedProviders = [...PROVIDER_REGISTRY].sort((a, b) => {
    const aCount = accountsByProvider.get(a.id)?.length ?? 0;
    const bCount = accountsByProvider.get(b.id)?.length ?? 0;
    if (aCount > 0 && bCount === 0) return -1;
    if (aCount === 0 && bCount > 0) return 1;
    return 0;
  });

  const handleAddAccount = (provider: BuiltinProvider, authType: 'oauth' | 'api-key') => {
    setDialogState({ open: true, provider, authType });
  };

  const handleEditAccount = (account: ProviderAccount) => {
    setDialogState({
      open: true,
      provider: account.provider,
      authType: account.authType,
      editAccount: account,
    });
  };

  const handleDeleteAccount = (id: string) => {
    setDeleteTarget(id);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const result = await deleteProviderAccount(deleteTarget);
      if (result.success) {
        toast({
          title: t('providers.toast.deleted'),
        });
      } else {
        toast({
          variant: 'destructive',
          title: t('providers.toast.deleteFailed'),
          description: result.error ?? t('accounts.toast.tryAgain'),
        });
      }
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleSetActive = async (id: string) => {
    const account = allAccounts.find(a => a.id === id);
    if (!account) return;
    const result = await setActiveProviderAccount(account.provider, id);
    if (result.success) {
      toast({ title: t('providers.toast.activated', { name: account.name }) });
    } else {
      toast({
        variant: 'destructive',
        title: t('providers.toast.activateFailed'),
        description: result.error ?? t('accounts.toast.tryAgain'),
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedProviders.map((providerInfo) => {
        const accounts = accountsByProvider.get(providerInfo.id) ?? [];
        // Check if any env var is detected for this provider
        const envDetected = providerInfo.envVars.some(v => envCredentials?.[v]);

        return (
          <ProviderSection
            key={providerInfo.id}
            provider={providerInfo}
            accounts={accounts}
            envDetected={envDetected}
            onAddAccount={handleAddAccount}
            onEditAccount={handleEditAccount}
            onDeleteAccount={handleDeleteAccount}
            onSetActive={handleSetActive}
          />
        );
      })}

      {/* Add / Edit dialog */}
      <AddAccountDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState(s => ({ ...s, open }))}
        provider={dialogState.provider}
        authType={dialogState.authType}
        editAccount={dialogState.editAccount}
      />

      {/* Delete confirmation */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('providers.dialog.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('providers.dialog.deleteDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {t('providers.dialog.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                  {t('providers.dialog.deleting')}
                </>
              ) : (
                t('providers.dialog.delete')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
