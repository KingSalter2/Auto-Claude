/**
 * Issue Split Dialog — multi-step flow for splitting an issue into sub-issues.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SplitSuggestion, SplitProgress } from '../../../../shared/types/ai-triage';

interface IssueSplitDialogProps {
  suggestion: SplitSuggestion;
  progress: SplitProgress | null;
  onConfirm: (issueNumber: number, subIssues: SplitSuggestion['subIssues']) => void;
  onCancel: () => void;
}

export function IssueSplitDialog({ suggestion, progress, onConfirm, onCancel }: IssueSplitDialogProps) {
  const { t } = useTranslation(['common']);
  const [subIssues, setSubIssues] = useState(suggestion.subIssues.map((s) => ({ ...s })));
  const isInProgress = progress !== null;

  const updateTitle = (index: number, title: string) => {
    setSubIssues((prev) => prev.map((s, i) => (i === index ? { ...s, title } : s)));
  };

  const updateBody = (index: number, body: string) => {
    setSubIssues((prev) => prev.map((s, i) => (i === index ? { ...s, body } : s)));
  };

  return (
    <section className="space-y-4" aria-label={t('common:issueSplit.title')}>
      {/* Rationale */}
      <div className="text-sm text-foreground/70 bg-foreground/5 rounded p-3">
        {suggestion.rationale}
      </div>

      {/* Progress */}
      {progress && (
        <div className="text-sm text-foreground/70">
          <span className="capitalize">{progress.phase}</span>: {progress.message}
          {progress.createdCount !== undefined && (
            <span className="ml-1">({progress.createdCount}/{progress.totalCount})</span>
          )}
        </div>
      )}

      {/* Sub-issues */}
      <div className="space-y-3">
        {subIssues.map((sub, index) => (
          <div key={index} className="border border-border/50 rounded p-3 space-y-2">
            <input
              type="text"
              value={sub.title}
              onChange={(e) => updateTitle(index, e.target.value)}
              className="w-full bg-transparent text-sm font-medium border-b border-border/30 pb-1 outline-none focus:border-blue-500"
              disabled={isInProgress}
              aria-label={t('common:issueSplit.subIssueTitle', { index: String(index + 1) })}
            />
            <textarea
              value={sub.body}
              onChange={(e) => updateBody(index, e.target.value)}
              className="w-full bg-transparent text-xs text-foreground/70 resize-none outline-none min-h-[60px]"
              disabled={isInProgress}
              aria-label={t('common:issueSplit.subIssueBody', { index: String(index + 1) })}
            />
            {sub.labels.length > 0 && (
              <div className="flex gap-1">
                {sub.labels.map((label) => (
                  <span key={label} className="text-xs px-1.5 py-0.5 rounded bg-foreground/10">
                    {label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          aria-label={t('common:issueSplit.cancel')}
          className="text-xs px-3 py-1.5 rounded bg-foreground/10 hover:bg-foreground/20 text-foreground/70 transition-colors"
          onClick={onCancel}
          disabled={isInProgress}
        >
          {t('common:issueSplit.cancel')}
        </button>
        <button
          type="button"
          aria-label={t('common:issueSplit.confirm')}
          className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50"
          onClick={() => onConfirm(suggestion.issueNumber, subIssues)}
          disabled={isInProgress || subIssues.length === 0}
        >
          {t('common:issueSplit.confirm')} ({subIssues.length})
        </button>
      </div>
    </section>
  );
}
