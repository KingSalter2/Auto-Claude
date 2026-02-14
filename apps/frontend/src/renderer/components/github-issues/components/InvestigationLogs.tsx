import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SearchCode,
  BarChart3,
  Wrench,
  RotateCcw,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Loader2,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Badge } from '../../ui/badge';
import { cn } from '../../../lib/utils';
import { CollapsibleCard } from '../../github-prs/components/CollapsibleCard';
import type {
  InvestigationLogs as InvestigationLogsType,
  InvestigationAgentType,
  InvestigationAgentLog,
  InvestigationLogEntry,
} from '@shared/types';

interface InvestigationLogsProps {
  issueNumber: number;
  projectId: string;
  isInvestigating: boolean;
}

type AgentKey = InvestigationAgentType | 'orchestrator';

const AGENT_ORDER: AgentKey[] = [
  'orchestrator',
  'root_cause',
  'impact',
  'fix_advisor',
  'reproducer',
];

const AGENT_I18N_KEYS: Record<AgentKey, string> = {
  orchestrator: 'investigation.statusTree.orchestrator',
  root_cause: 'investigation.statusTree.rootCause',
  impact: 'investigation.statusTree.impact',
  fix_advisor: 'investigation.statusTree.fixAdvisor',
  reproducer: 'investigation.statusTree.reproducer',
};

const AGENT_ICONS: Record<AgentKey, typeof SearchCode> = {
  orchestrator: FolderOpen,
  root_cause: SearchCode,
  impact: BarChart3,
  fix_advisor: Wrench,
  reproducer: RotateCcw,
};

const AGENT_COLORS: Record<AgentKey, string> = {
  orchestrator: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  root_cause: 'text-red-500 bg-red-500/10 border-red-500/30',
  impact: 'text-orange-500 bg-orange-500/10 border-orange-500/30',
  fix_advisor: 'text-blue-500 bg-blue-500/10 border-blue-500/30',
  reproducer: 'text-purple-500 bg-purple-500/10 border-purple-500/30',
};

export function InvestigationLogs({
  issueNumber,
  projectId,
  isInvestigating,
}: InvestigationLogsProps) {
  const { t } = useTranslation('common');
  const [logs, setLogs] = useState<InvestigationLogsType | null>(null);
  const [expandedAgents, setExpandedAgents] = useState<Set<AgentKey>>(new Set());

  const fetchLogs = useCallback(async () => {
    try {
      const result = await window.electronAPI.github.getInvestigationLogs(projectId, issueNumber);
      if (result) setLogs(result);
    } catch {
      // Silently ignore fetch errors
    }
  }, [projectId, issueNumber]);

  useEffect(() => {
    fetchLogs();
    if (!isInvestigating) return;

    const interval = setInterval(fetchLogs, 1500);
    const cleanup = window.electronAPI.github.onInvestigationLogsUpdated(
      (eventProjectId, data) => {
        if (eventProjectId === projectId && data.issueNumber === issueNumber) {
          fetchLogs();
        }
      },
    );
    return () => {
      clearInterval(interval);
      cleanup();
    };
  }, [isInvestigating, projectId, issueNumber, fetchLogs]);

  // Auto-expand active agents during investigation
  useEffect(() => {
    if (!logs || !isInvestigating) return;
    const activeAgents = new Set(expandedAgents);
    for (const agentKey of AGENT_ORDER) {
      if (logs.agents[agentKey]?.status === 'active') {
        activeAgents.add(agentKey);
      }
    }
    if (activeAgents.size !== expandedAgents.size) {
      setExpandedAgents(activeAgents);
    }
  }, [logs, isInvestigating]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleAgent = (agent: AgentKey) => {
    setExpandedAgents(prev => {
      const next = new Set(prev);
      if (next.has(agent)) {
        next.delete(agent);
      } else {
        next.add(agent);
      }
      return next;
    });
  };

  const hasAnyLogs = logs && AGENT_ORDER.some(key => logs.agents[key]?.entries.length > 0);

  return (
    <CollapsibleCard
      title={t('investigation.logs.title', 'Investigation Logs')}
      icon={<FolderOpen className="h-4 w-4 text-muted-foreground" />}
      defaultOpen={false}
    >
      <div className="p-4 space-y-2">
        {!hasAnyLogs ? (
          <p className="text-sm text-muted-foreground italic">
            {t('investigation.logs.noLogs', 'No logs yet')}
          </p>
        ) : (
          AGENT_ORDER.map((agentKey) => {
            const agentLog = logs?.agents[agentKey];
            if (!agentLog || agentLog.entries.length === 0) return null;
            return (
              <AgentLogSection
                key={agentKey}
                agentKey={agentKey}
                agentLog={agentLog}
                isExpanded={expandedAgents.has(agentKey)}
                onToggle={() => toggleAgent(agentKey)}
                isInvestigating={isInvestigating}
              />
            );
          })
        )}
      </div>
    </CollapsibleCard>
  );
}

interface AgentLogSectionProps {
  agentKey: AgentKey;
  agentLog: InvestigationAgentLog;
  isExpanded: boolean;
  onToggle: () => void;
  isInvestigating: boolean;
}

function AgentLogSection({ agentKey, agentLog, isExpanded, onToggle, isInvestigating }: AgentLogSectionProps) {
  const { t } = useTranslation('common');
  const Icon = AGENT_ICONS[agentKey];
  const entryCount = agentLog.entries.length;

  const getStatusBadge = () => {
    const status = agentLog.status;
    if (status === 'active') {
      return (
        <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/30 flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t('investigation.logs.running', 'Running')}
        </Badge>
      );
    }
    switch (status) {
      case 'completed':
        return (
          <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/30 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {t('investigation.logs.complete', 'Complete')}
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30 flex items-center gap-1">
            <XCircle className="h-3 w-3" />
            {t('investigation.logs.failed', 'Failed')}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="text-xs text-muted-foreground">
            {t('investigation.logs.pending', 'Pending')}
          </Badge>
        );
    }
  };

  return (
    <div className="rounded-lg border overflow-hidden w-full min-w-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'w-full flex items-center justify-between p-3 transition-colors',
          'hover:bg-secondary/50',
          agentLog.status === 'active' && AGENT_COLORS[agentKey],
          agentLog.status === 'completed' && 'border-success/30 bg-success/5',
          agentLog.status === 'failed' && 'border-destructive/30 bg-destructive/5',
          agentLog.status === 'pending' && 'border-border bg-secondary/30',
        )}
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <Icon className={cn('h-4 w-4', agentLog.status === 'active' ? AGENT_COLORS[agentKey].split(' ')[0] : 'text-muted-foreground')} />
          <span className="font-medium text-sm">{t(AGENT_I18N_KEYS[agentKey])}</span>
          <span className="text-xs text-muted-foreground">
            ({entryCount})
          </span>
        </div>
        <div className="flex items-center gap-2">
          {getStatusBadge()}
        </div>
      </button>
      {isExpanded && (
        <AgentLogEntries
          agentLog={agentLog}
          isActive={agentLog.status === 'active'}
        />
      )}
    </div>
  );
}

interface AgentLogEntriesProps {
  agentLog: InvestigationAgentLog;
  isActive: boolean;
  maxVisible?: number;
}

function AgentLogEntries({ agentLog, isActive, maxVisible = 20 }: AgentLogEntriesProps) {
  const { t } = useTranslation('common');
  const [showAll, setShowAll] = useState(false);
  const entriesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isUserNearBottom = useRef(true);

  const entries = agentLog.entries;
  const hasMore = entries.length > maxVisible;
  const visibleEntries = showAll ? entries : entries.slice(-maxVisible);

  // Track whether user has scrolled away from the bottom
  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 40; // px tolerance
    isUserNearBottom.current = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
  }, []);

  // Auto-scroll to latest entry only if user is near the bottom
  useEffect(() => {
    if (isActive && isUserNearBottom.current && entriesEndRef.current) {
      entriesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [entries.length, isActive]);

  return (
    <div ref={scrollContainerRef} onScroll={handleScroll} className="border-t border-border/30 max-h-[300px] overflow-y-auto overflow-x-hidden w-full">
      <div className="p-2 space-y-0.5 w-full min-w-0">
        {hasMore && !showAll && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
            onClick={() => setShowAll(true)}
          >
            {t('investigation.statusTree.showMore', { count: entries.length - maxVisible })}
          </button>
        )}
        {visibleEntries.map((entry, i) => (
          <div
            key={`${entry.timestamp}-${i}`}
            className={cn(
              'text-xs font-mono truncate leading-5',
              entry.type === 'error' && 'text-destructive',
              entry.type === 'tool_start' && 'text-muted-foreground',
              entry.type === 'text' && 'text-foreground/80',
              entry.type === 'info' && 'text-muted-foreground',
              entry.type === 'thinking' && 'text-muted-foreground/60 italic',
            )}
          >
            {entry.content}
          </div>
        ))}
        {hasMore && showAll && (
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-1"
            onClick={() => setShowAll(false)}
          >
            {t('investigation.statusTree.showLess')}
          </button>
        )}
        <div ref={entriesEndRef} />
      </div>
    </div>
  );
}
