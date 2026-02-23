import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { useSettingsStore } from '../../stores/settings-store';
import { useToast } from '../../hooks/use-toast';
import type { BuiltinProvider, ProviderAccount } from '@shared/types/provider-account';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  provider: BuiltinProvider;
  authType: 'oauth' | 'api-key';
  editAccount?: ProviderAccount;
}

export function AddAccountDialog({
  open,
  onOpenChange,
  provider,
  authType,
  editAccount,
}: AddAccountDialogProps) {
  const { t } = useTranslation('settings');
  const { addProviderAccount, updateProviderAccount } = useSettingsStore();
  const { toast } = useToast();

  const isEditing = !!editAccount;

  // Form state
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [region, setRegion] = useState('us-east-1');
  const [isSaving, setIsSaving] = useState(false);

  // Reset form when dialog opens/editAccount changes
  useEffect(() => {
    if (open) {
      if (editAccount) {
        setName(editAccount.name);
        setApiKey(editAccount.apiKey ?? '');
        setBaseUrl(editAccount.baseUrl ?? '');
        setRegion(editAccount.region ?? 'us-east-1');
      } else {
        setName('');
        setApiKey('');
        setBaseUrl(provider === 'ollama' ? 'http://localhost:11434' : '');
        setRegion('us-east-1');
      }
    }
  }, [open, editAccount, provider]);

  const needsApiKey = provider !== 'ollama' && authType === 'api-key';
  const needsBaseUrl = provider === 'ollama' || provider === 'azure' || provider === 'openai-compatible' || (provider === 'anthropic' && authType === 'api-key');
  const needsRegion = provider === 'amazon-bedrock';
  const isOAuthOnly = provider === 'anthropic' && authType === 'oauth';

  const isBaseUrlRequired = provider === 'ollama' || provider === 'azure' || provider === 'openai-compatible';

  const canSave = () => {
    if (!name.trim()) return false;
    if (needsApiKey && !apiKey.trim()) return false;
    if (isBaseUrlRequired && !baseUrl.trim()) return false;
    return true;
  };

  const handleSave = async () => {
    if (!canSave()) return;

    setIsSaving(true);
    try {
      const payload = {
        provider,
        name: name.trim(),
        authType,
        apiKey: needsApiKey ? apiKey.trim() : undefined,
        baseUrl: needsBaseUrl && baseUrl.trim() ? baseUrl.trim() : undefined,
        region: needsRegion ? region : undefined,
        isActive: false,
        priority: 999,
      };

      let result;
      if (isEditing && editAccount) {
        result = await updateProviderAccount(editAccount.id, {
          name: payload.name,
          apiKey: payload.apiKey,
          baseUrl: payload.baseUrl,
          region: payload.region,
        });
      } else {
        result = await addProviderAccount(payload);
      }

      if (result.success) {
        toast({
          title: isEditing
            ? t('providers.dialog.toast.updated')
            : t('providers.dialog.toast.added'),
          description: name.trim(),
        });
        onOpenChange(false);
      } else {
        toast({
          variant: 'destructive',
          title: t('providers.dialog.toast.error'),
          description: result.error ?? t('accounts.toast.tryAgain'),
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const title = isEditing
    ? t('providers.dialog.editTitle', { provider })
    : t('providers.dialog.addTitle', { provider });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {isOAuthOnly
              ? t('providers.dialog.oauthDescription')
              : t('providers.dialog.apiKeyDescription')}
          </DialogDescription>
        </DialogHeader>

        {isOAuthOnly ? (
          <div className="rounded-lg bg-muted/50 border border-border p-4 text-sm text-muted-foreground">
            {t('providers.dialog.oauthInstructions')}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="account-name">{t('providers.dialog.fields.name')}</Label>
              <Input
                id="account-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('providers.dialog.placeholders.name')}
                autoFocus
              />
            </div>

            {/* API Key */}
            {needsApiKey && (
              <div className="space-y-2">
                <Label htmlFor="account-apikey">{t('providers.dialog.fields.apiKey')}</Label>
                <Input
                  id="account-apikey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={t('providers.dialog.placeholders.apiKey')}
                />
              </div>
            )}

            {/* Base URL */}
            {needsBaseUrl && (
              <div className="space-y-2">
                <Label htmlFor="account-baseurl">
                  {t('providers.dialog.fields.baseUrl')}
                  {!isBaseUrlRequired && (
                    <span className="text-muted-foreground font-normal ml-1">
                      {t('providers.dialog.optional')}
                    </span>
                  )}
                </Label>
                <Input
                  id="account-baseurl"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={
                    provider === 'ollama'
                      ? 'http://localhost:11434'
                      : provider === 'anthropic'
                        ? 'https://api.anthropic.com'
                        : t('providers.dialog.placeholders.baseUrl')
                  }
                />
              </div>
            )}

            {/* Region (Bedrock) */}
            {needsRegion && (
              <div className="space-y-2">
                <Label htmlFor="account-region">{t('providers.dialog.fields.region')}</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger id="account-region">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>
            {t('providers.dialog.cancel')}
          </Button>
          {!isOAuthOnly && (
            <Button onClick={handleSave} disabled={!canSave() || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? t('providers.dialog.save') : t('providers.dialog.add')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
