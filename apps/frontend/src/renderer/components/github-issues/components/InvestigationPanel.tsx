import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Shield,
  Wrench,
  TestTube,
  Send,
  Tag,
  Check,
  X,
  FileText,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import type {
  InvestigationReport,
  InvestigationAgentResult,
  InvestigationState,
  SuggestedLabel,
  LinkedPR
} from '@shared/types';

interface InvestigationPanelProps {
  report: InvestigationReport;
  state: InvestigationState;
  /** Show the original issue body instead of AI summary */
  showOriginal?: boolean;
  onToggleOriginal?: () => void;
  onPostToGitHub?: () => void;
  onAcceptLabel?: (label: SuggestedLabel) => void;
  onRejectLabel?: (label: SuggestedLabel) => void;
  isPostingToGitHub?: boolean;
  /** Activity log entries for the investigation lifecycle */
  activityLog?: Array<{ event: string; timestamp: string }>;
  /** Callback to close the issue on GitHub (used for resolved suggestion) */
  onCloseIssue?: () => void;
  /** Whether the close-issue action is in progress */
  isClosingIssue?: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
};

const AGENT_ICONS = {
  root_cause: AlertTriangle,
  impact: Shield,
  fix_advisor: Wrench,
  reproducer: TestTube,
} as const;

const AGENT_LABELS = {
  root_cause: 'investigation.agent.rootCause',
  impact: 'investigation.agent.impact',
  fix_advisor: 'investigation.agent.fixAdvisor',
  reproducer: 'investigation.agent.reproducer',
} as const;

const AGENT_DEFAULTS: Record<string, string> = {
  root_cause: 'Root Cause Analysis',
  impact: 'Impact Assessment',
  fix_advisor: 'Fix Advice',
  reproducer: 'Reproduction Analysis',
};

/**
 * Collapsible section for a single agent's results.
 */
function AgentSection({ agent, defaultOpen }: { agent: InvestigationAgentResult; defaultOpen?: boolean }) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const Icon = AGENT_ICONS[agent.agentType];
  const labelKey = AGENT_LABELS[agent.agentType];
  const defaultLabel = AGENT_DEFAULTS[agent.agentType];

  return (
    <div className="border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-left hover:bg-muted/50 transition-colors"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{t(labelKey, defaultLabel)}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {agent.confidence}% confidence
        </span>
      </button>
      {isOpen && (
        <div className="px-3 pb-3 space-y-2 border-t">
          <p className="text-sm text-foreground mt-2">{agent.summary}</p>
          {agent.findings.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">
                {t('investigation.panel.findings', 'Findings')}
              </h5>
              <ul className="space-y-1">
                {agent.findings.map((finding, i) => (
                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                    <span className="mt-1 h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                    {finding}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {agent.codeReferences.length > 0 && (
            <div>
              <h5 className="text-xs font-medium text-muted-foreground mb-1">
                {t('investigation.panel.codeReferences', 'Code References')}
              </h5>
              <div className="space-y-1">
                {agent.codeReferences.map((ref, i) => (
                  <div key={i} className="text-xs font-mono bg-muted/50 rounded px-2 py-1">
                    <span className="text-primary">{ref.file}</span>
                    {ref.line && <span className="text-muted-foreground">:{ref.line}</span>}
                    {ref.endLine && <span className="text-muted-foreground">-{ref.endLine}</span>}
                    {ref.description && (
                      <span className="text-muted-foreground ml-2">— {ref.description}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Investigation results panel — mirrors PR review layout.
 * Shows 4 collapsible agent sections, AI summary, severity badge,
 * suggested labels, and action buttons.
 */
export function InvestigationPanel({
  report,
  state,
  showOriginal,
  onToggleOriginal,
  onPostToGitHub,
  onAcceptLabel,
  onRejectLabel,
  isPostingToGitHub,
  activityLog,
  onCloseIssue,
  isClosingIssue,
}: InvestigationPanelProps) {
  const { t } = useTranslation('common');
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <div className="space-y-4">
      {/* Resolved suggestion banner */}
      {report.likelyResolved && onCloseIssue && state !== 'done' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
          <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300 flex-1">
            {t('investigation.panel.resolvedSuggestion', 'This issue appears to be already resolved. Close it on GitHub?')}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onCloseIssue}
            disabled={isClosingIssue}
            className="border-green-300 text-green-700 hover:bg-green-100 dark:border-green-700 dark:text-green-300 dark:hover:bg-green-900/40"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            {isClosingIssue
              ? t('investigation.panel.closingIssue', 'Closing...')
              : t('investigation.panel.closeIssue', 'Close Issue')
            }
          </Button>
        </div>
      )}

      {/* Header: severity + timestamp */}
      <div className="flex items-center gap-2">
        <Badge className={SEVERITY_COLORS[report.severity] ?? SEVERITY_COLORS.medium}>
          {report.severity.toUpperCase()}
        </Badge>
        {report.likelyResolved && (
          <Badge variant="outline" className="border-green-500/50 text-green-600 dark:text-green-400">
            {t('investigation.panel.likelyResolved', 'Likely Resolved')}
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {new Date(report.timestamp).toLocaleString()}
        </span>
      </div>

      {/* AI Summary */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-sm font-medium">
            {t('investigation.panel.summary', 'Summary')}
          </h4>
          {onToggleOriginal && (
            <button
              type="button"
              onClick={onToggleOriginal}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <FileText className="h-3 w-3" />
              {showOriginal
                ? t('investigation.panel.showSummary', 'Show AI Summary')
                : t('investigation.panel.showOriginal', 'Show Original')
              }
            </button>
          )}
        </div>
        <p className="text-sm text-foreground">{report.summary}</p>
      </div>

      {/* Agent sections */}
      <div className="space-y-2">
        <AgentSection agent={report.rootCause} defaultOpen />
        <AgentSection agent={report.impact} />
        <AgentSection agent={report.fixAdvice} />
        <AgentSection agent={report.reproduction} />
      </div>

      {/* Linked PRs */}
      {report.linkedPRs.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1">
            {t('investigation.panel.linkedPRs', 'Linked PRs')}
          </h4>
          <div className="space-y-1">
            {report.linkedPRs.map((pr: LinkedPR) => (
              <div key={pr.number} className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="text-[10px]">
                  #{pr.number}
                </Badge>
                <span className="text-foreground truncate">{pr.title}</span>
                <Badge variant="secondary" className="text-[10px] ml-auto">
                  {pr.state}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Suggested labels */}
      {report.suggestedLabels.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-1 flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {t('investigation.panel.suggestedLabels', 'Suggested Labels')}
          </h4>
          <div className="flex flex-wrap gap-2">
            {report.suggestedLabels.map((label: SuggestedLabel) => (
              <div key={label.name} className="flex items-center gap-1 bg-muted/50 rounded-full px-2 py-0.5">
                <span className="text-xs">{label.name}</span>
                {label.accepted === undefined && onAcceptLabel && onRejectLabel && (
                  <>
                    <button
                      type="button"
                      onClick={() => onAcceptLabel(label)}
                      className="text-green-600 hover:text-green-700 dark:text-green-400"
                      aria-label={`Accept label ${label.name}`}
                    >
                      <Check className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRejectLabel(label)}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      aria-label={`Reject label ${label.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </>
                )}
                {label.accepted === true && <Check className="h-3 w-3 text-green-500" />}
                {label.accepted === false && <X className="h-3 w-3 text-red-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {onPostToGitHub && state !== 'done' && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={onPostToGitHub}
            disabled={isPostingToGitHub}
          >
            <Send className="h-4 w-4 mr-1.5" />
            {isPostingToGitHub
              ? t('investigation.panel.posting', 'Posting...')
              : t('investigation.panel.postToGitHub', 'Post to GitHub')
            }
          </Button>
        </div>
      )}

      {/* Activity Log */}
      {activityLog && activityLog.length > 0 && (
        <div className="border-t pt-2">
          <button
            type="button"
            onClick={() => setActivityOpen(!activityOpen)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {activityOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            <Clock className="h-3 w-3" />
            {t('investigation.activityLog.title', 'Activity')}
          </button>
          {activityOpen && (
            <ul className="mt-1.5 space-y-1">
              {activityLog.map((entry, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                  <span>{entry.event}</span>
                  <span className="ml-auto text-[10px]">{new Date(entry.timestamp).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
