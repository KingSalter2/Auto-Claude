import { useState } from 'react';
import {
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  Pencil,
  Trash2,
  ArrowUpCircle,
  FileCode
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import type { Observation } from '../../../shared/types';
import {
  observationCategoryIcons,
  observationCategoryColors,
  observationPriorityColors
} from './constants';
import { formatDate } from './utils';

interface ObservationCardProps {
  observation: Observation;
  onPin?: (id: string, pinned: boolean) => void;
  onEdit?: (observation: Observation) => void;
  onDelete?: (id: string) => void;
  onPromote?: (observation: Observation) => void;
}

export function ObservationCard({
  observation,
  onPin,
  onEdit,
  onDelete,
  onPromote
}: ObservationCardProps) {
  const { t } = useTranslation(['common']);
  const [expanded, setExpanded] = useState(false);

  const CategoryIcon = observationCategoryIcons[observation.category] || FileCode;
  const categoryColor = observationCategoryColors[observation.category] || '';
  const priorityColor = observationPriorityColors[observation.priority] || '';
  const categoryLabel = observation.category.replace(/_/g, ' ');
  const metadata = observation.metadata ?? {};
  const stalenessScore = (metadata.staleness_score as number) ?? 0;
  const agentType = metadata.agent_type as string | undefined;
  const sessionNum = metadata.session_num as number | undefined;
  const evidence = observation.context;

  return (
    <Card className="bg-muted/30 border-border/50 hover:border-border transition-colors">
      <CardContent className="pt-4 pb-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-accent/10">
              <CategoryIcon className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={cn('text-xs capitalize font-medium', categoryColor)}>
                  {categoryLabel}
                </Badge>
                <Badge variant="outline" className={cn('text-xs capitalize font-medium', priorityColor)}>
                  {observation.priority}
                </Badge>
                {observation.pin && (
                  <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                )}
              </div>
              <p className="text-sm text-foreground mt-1.5 line-clamp-2">
                {observation.content}
              </p>
              {/* Metadata row */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDate(observation.timestamp)}
                </div>
                {observation.spec_id && (
                  <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={observation.spec_id}>
                    {observation.spec_id}
                  </span>
                )}
                {sessionNum !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    {t('common:session')} #{sessionNum}
                  </span>
                )}
                {agentType && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {agentType}
                  </Badge>
                )}
              </div>
              {/* Staleness bar */}
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 max-w-[120px] rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      stalenessScore > 0.7
                        ? 'bg-red-400'
                        : stalenessScore > 0.4
                          ? 'bg-amber-400'
                          : 'bg-green-400'
                    )}
                    style={{ width: `${Math.min(stalenessScore * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">
                  {t('common:staleness')}
                </span>
              </div>
            </div>
          </div>
          {evidence && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="shrink-0 gap-1"
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-4 w-4" />
                  {t('common:collapse')}
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4" />
                  {t('common:expand')}
                </>
              )}
            </Button>
          )}
        </div>

        {/* Expanded Evidence */}
        {expanded && evidence && (
          <div className="mt-4 pt-4 border-t border-border/50">
            <pre className="text-xs text-muted-foreground whitespace-pre-wrap font-mono p-3 bg-background rounded-lg max-h-64 overflow-auto border border-border/50">
              {evidence}
            </pre>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPin?.(observation.id, !observation.pin)}
            className={cn('gap-1', observation.pin && 'text-amber-400')}
          >
            <Star className={cn('h-3.5 w-3.5', observation.pin && 'fill-amber-400')} />
            {t('common:pin')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit?.(observation)}
            className="gap-1"
          >
            <Pencil className="h-3.5 w-3.5" />
            {t('common:edit')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete?.(observation.id)}
            className="gap-1 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t('common:delete')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onPromote?.(observation)}
            className="gap-1 ml-auto"
          >
            <ArrowUpCircle className="h-3.5 w-3.5" />
            {t('common:promote')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
