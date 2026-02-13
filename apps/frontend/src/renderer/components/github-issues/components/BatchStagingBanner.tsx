/**
 * BatchStagingBanner — collapsible inline banner shown at the top of the issues
 * view when auto-create is enabled and there are pending task creations.
 *
 * Each pending item shows issue title, investigation summary snippet,
 * and approve/reject buttons. Batch "Approve All" / "Reject All" actions
 * are provided at the top.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Layers } from 'lucide-react';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '../../ui/collapsible';
import type { BatchStagingItem } from '@shared/types';

interface BatchStagingBannerProps {
  projectId: string;
  items: BatchStagingItem[];
  onApprove: (issueNumber: number) => void;
  onReject: (issueNumber: number) => void;
  onApproveAll: () => void;
}

export function BatchStagingBanner({
  projectId: _projectId,
  items,
  onApprove,
  onReject,
  onApproveAll,
}: BatchStagingBannerProps) {
  const { t } = useTranslation('common');
  const [isOpen, setIsOpen] = useState(items.length > 0);

  if (items.length === 0) {
    return null;
  }

  const pendingItems = items.filter((item) => item.approved === undefined);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="mx-2 mt-2 rounded-lg border border-info/30 bg-info/5">
        {/* Header / trigger */}
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-info/10 rounded-t-lg transition-colors"
          >
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-info" />
              ) : (
                <ChevronRight className="h-4 w-4 text-info" />
              )}
              <Layers className="h-4 w-4 text-info" />
              <span className="text-sm font-medium text-foreground">
                {t('investigation.batchStaging.title', 'Pending Task Creations')}
              </span>
              <Badge variant="info" className="text-[10px] px-1.5 py-0">
                {pendingItems.length}
              </Badge>
            </div>
            {/* Batch actions — stop propagation so clicks don't toggle collapse */}
            <div
              className="flex items-center gap-1"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => { if (e.key === 'Enter') e.stopPropagation(); }}
            >
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-success hover:text-success"
                onClick={onApproveAll}
                disabled={pendingItems.length === 0}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t('investigation.batchStaging.approveAll', 'Approve All')}
              </Button>
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expandable item list */}
        <CollapsibleContent>
          <div className="border-t border-info/20">
            {items.map((item) => (
              <div
                key={item.issueNumber}
                className="flex items-center justify-between px-3 py-2 border-b border-border/30 last:border-b-0"
              >
                <div className="flex-1 min-w-0 mr-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground font-mono">
                      #{item.issueNumber}
                    </span>
                    <span className="text-sm text-foreground truncate">
                      {item.issueTitle}
                    </span>
                  </div>
                  {item.report.summary && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {item.report.summary}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.approved === undefined ? (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-success hover:text-success hover:bg-success/10"
                        onClick={() => onApprove(item.issueNumber)}
                        title={t('investigation.batchStaging.approve', 'Approve')}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onReject(item.issueNumber)}
                        title={t('investigation.batchStaging.reject', 'Reject')}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  ) : item.approved ? (
                    <Badge variant="success" className="text-[10px]">
                      {t('investigation.batchStaging.approved', 'Approved')}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-[10px]">
                      {t('investigation.batchStaging.rejected', 'Rejected')}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
