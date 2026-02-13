/**
 * InvestigationSettings — subsection within the GitHub settings page.
 *
 * All 8 settings from the design doc:
 *  1. Auto-create tasks (toggle, default off)
 *  2. Auto-start tasks (toggle, default off)
 *  3. Pipeline mode (dropdown: Full / Skip to planning / Minimal)
 *  4. Auto-post to GitHub (toggle, default off)
 *  5. Auto-close issues (toggle, default off)
 *  6. Max parallel investigations (number 1-10, default 3)
 *  7. Label include filter (multi-select)
 *  8. Label exclude filter (multi-select)
 */

import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Brain, Loader2 } from 'lucide-react';
import { Switch } from '../../ui/switch';
import { Label } from '../../ui/label';
import { Input } from '../../ui/input';
import { Separator } from '../../ui/separator';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '../../ui/select';
import { useInvestigationStore } from '../../../stores/github/investigation-store';
import type { InvestigationSettings as InvestigationSettingsType, InvestigationPipelineMode } from '@shared/types';

const DEFAULT_SETTINGS: InvestigationSettingsType = {
  autoCreateTasks: false,
  autoStartTasks: false,
  pipelineMode: 'full',
  autoPostToGitHub: false,
  autoCloseIssues: false,
  maxParallelInvestigations: 3,
  labelIncludeFilter: [],
  labelExcludeFilter: [],
};

interface InvestigationSettingsProps {
  projectId: string;
}

export function InvestigationSettings({ projectId }: InvestigationSettingsProps) {
  const { t } = useTranslation(['settings', 'common']);
  const storeSettings = useInvestigationStore((s) => s.getSettings(projectId));
  const setStoreSettings = useInvestigationStore((s) => s.setSettings);
  const [settings, setSettings] = useState<InvestigationSettingsType>(
    storeSettings ?? DEFAULT_SETTINGS,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [labelIncludeInput, setLabelIncludeInput] = useState('');
  const [labelExcludeInput, setLabelExcludeInput] = useState('');

  // Load settings from store on mount / projectId change
  useEffect(() => {
    if (storeSettings) {
      setSettings(storeSettings);
    }
  }, [storeSettings]);

  // Persist to store + backend whenever local settings change
  const persist = useCallback(
    (updated: InvestigationSettingsType) => {
      setSettings(updated);
      setStoreSettings(projectId, updated);
      // Save to backend if API available
      if (window.electronAPI?.github?.saveInvestigationSettings) {
        setIsLoading(true);
        window.electronAPI.github
          .saveInvestigationSettings(projectId, updated)
          .catch(() => { /* silently handle save errors */ })
          .finally(() => setIsLoading(false));
      }
    },
    [projectId, setStoreSettings],
  );

  const updateSetting = <K extends keyof InvestigationSettingsType>(
    key: K,
    value: InvestigationSettingsType[K],
  ) => {
    persist({ ...settings, [key]: value });
  };

  const addLabelFilter = (type: 'include' | 'exclude', label: string) => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const key = type === 'include' ? 'labelIncludeFilter' : 'labelExcludeFilter';
    if (settings[key].includes(trimmed)) return;
    persist({ ...settings, [key]: [...settings[key], trimmed] });
    if (type === 'include') setLabelIncludeInput('');
    else setLabelExcludeInput('');
  };

  const removeLabelFilter = (type: 'include' | 'exclude', label: string) => {
    const key = type === 'include' ? 'labelIncludeFilter' : 'labelExcludeFilter';
    persist({ ...settings, [key]: settings[key].filter((l) => l !== label) });
  };

  return (
    <section className="space-y-4" aria-label={t('settings:investigation.title', 'AI Investigation')}>
      {/* Section Header */}
      <div className="flex items-center gap-2">
        <Brain className="h-4 w-4 text-info" />
        <h4 className="text-sm font-medium text-foreground">
          {t('settings:investigation.title', 'AI Investigation')}
        </h4>
        {isLoading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
      </div>
      <p className="text-xs text-muted-foreground">
        {t('settings:investigation.description', 'Configure how AI investigations create tasks and interact with GitHub.')}
      </p>

      <Separator />

      {/* 1. Auto-create tasks */}
      <SettingToggle
        label={t('settings:investigation.autoCreateTasks', 'Auto-create tasks')}
        description={t(
          'settings:investigation.autoCreateTasksDescription',
          'Automatically create kanban tasks from investigation results',
        )}
        checked={settings.autoCreateTasks}
        onCheckedChange={(v) => updateSetting('autoCreateTasks', v)}
      />

      {/* 2. Auto-start tasks */}
      <SettingToggle
        label={t('settings:investigation.autoStartTasks', 'Auto-start tasks')}
        description={t(
          'settings:investigation.autoStartTasksDescription',
          'Auto-start build pipeline when tasks are created',
        )}
        checked={settings.autoStartTasks}
        onCheckedChange={(v) => updateSetting('autoStartTasks', v)}
      />

      {/* 3. Pipeline mode */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">
            {t('settings:investigation.pipelineMode', 'Pipeline mode')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              'settings:investigation.pipelineModeDescription',
              'Pipeline mode for investigation-created tasks',
            )}
          </p>
        </div>
        <Select
          value={settings.pipelineMode}
          onValueChange={(v) => updateSetting('pipelineMode', v as InvestigationPipelineMode)}
        >
          <SelectTrigger className="w-[180px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="full">
              {t('settings:investigation.pipelineFull', 'Full')}
            </SelectItem>
            <SelectItem value="skip_to_planning">
              {t('settings:investigation.pipelineSkipToPlanning', 'Skip to planning')}
            </SelectItem>
            <SelectItem value="minimal">
              {t('settings:investigation.pipelineMinimal', 'Minimal')}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* 4. Auto-post to GitHub */}
      <SettingToggle
        label={t('settings:investigation.autoPostToGitHub', 'Auto-post to GitHub')}
        description={t(
          'settings:investigation.autoPostToGitHubDescription',
          'Automatically post investigation results to GitHub',
        )}
        checked={settings.autoPostToGitHub}
        onCheckedChange={(v) => updateSetting('autoPostToGitHub', v)}
      />

      {/* 5. Auto-close issues */}
      <SettingToggle
        label={t('settings:investigation.autoCloseIssues', 'Auto-close issues')}
        description={t(
          'settings:investigation.autoCloseIssuesDescription',
          'Close GitHub issues when linked task completes',
        )}
        checked={settings.autoCloseIssues}
        onCheckedChange={(v) => updateSetting('autoCloseIssues', v)}
      />

      <Separator />

      {/* 6. Max parallel investigations */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">
            {t('settings:investigation.maxParallel', 'Max parallel investigations')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              'settings:investigation.maxParallelDescription',
              'Maximum concurrent investigations (1-10)',
            )}
          </p>
        </div>
        <Input
          type="number"
          min={1}
          max={10}
          value={settings.maxParallelInvestigations}
          onChange={(e) => {
            const val = Math.min(10, Math.max(1, Number.parseInt(e.target.value, 10) || 1));
            updateSetting('maxParallelInvestigations', val);
          }}
          className="w-20 h-8 text-xs text-center"
        />
      </div>

      <Separator />

      {/* 7. Label include filter */}
      <div className="space-y-2">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">
            {t('settings:investigation.labelIncludeFilter', 'Label include filter')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              'settings:investigation.labelIncludeFilterDescription',
              'Only auto-create tasks for issues with these labels',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {settings.labelIncludeFilter.map((label) => (
            <LabelChip
              key={label}
              label={label}
              onRemove={() => removeLabelFilter('include', label)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t('settings:investigation.labelPlaceholder', 'Add label...')}
            value={labelIncludeInput}
            onChange={(e) => setLabelIncludeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLabelFilter('include', labelIncludeInput);
              }
            }}
            className="h-7 text-xs flex-1"
          />
        </div>
      </div>

      {/* 8. Label exclude filter */}
      <div className="space-y-2">
        <div className="space-y-0.5">
          <Label className="font-normal text-foreground">
            {t('settings:investigation.labelExcludeFilter', 'Label exclude filter')}
          </Label>
          <p className="text-xs text-muted-foreground">
            {t(
              'settings:investigation.labelExcludeFilterDescription',
              'Never auto-create tasks for issues with these labels',
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {settings.labelExcludeFilter.map((label) => (
            <LabelChip
              key={label}
              label={label}
              onRemove={() => removeLabelFilter('exclude', label)}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            placeholder={t('settings:investigation.labelPlaceholder', 'Add label...')}
            value={labelExcludeInput}
            onChange={(e) => setLabelExcludeInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addLabelFilter('exclude', labelExcludeInput);
              }
            }}
            className="h-7 text-xs flex-1"
          />
        </div>
      </div>
    </section>
  );
}

// ---- Internal sub-components ----

interface SettingToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function SettingToggle({ label, description, checked, onCheckedChange }: SettingToggleProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-0.5">
        <Label className="font-normal text-foreground">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface LabelChipProps {
  label: string;
  onRemove: () => void;
}

function LabelChip({ label, onRemove }: LabelChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs bg-muted text-muted-foreground">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="ml-0.5 hover:text-destructive transition-colors"
        aria-label={`Remove ${label}`}
      >
        &times;
      </button>
    </span>
  );
}
