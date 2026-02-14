import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Eye,
  Search,
  RefreshCw,
  Code,
  Building2,
  TestTube,
  Workflow
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { cn } from '../../lib/utils';
import { ObservationCard } from './ObservationCard';
import { observationFilterCategories } from './constants';
import type { Observation, ObservationStats, ObservationPriority } from '../../../shared/types';

type ObservationFilterCategory = keyof typeof observationFilterCategories;

const filterIcons: Record<ObservationFilterCategory, React.ElementType> = {
  all: Eye,
  code: Code,
  architecture: Building2,
  quality: TestTube,
  workflow: Workflow
};

interface ObservationPanelProps {
  observations: Observation[];
  stats: ObservationStats | null;
  loading: boolean;
  searchResults: Observation[];
  searchLoading: boolean;
  onSearch: (query: string) => void;
  onPin: (id: string, pinned: boolean) => void;
  onEdit: (observation: Observation) => void;
  onDelete: (id: string) => void;
  onPromote: (observation: Observation) => void;
}

function getObservationFilterCategory(observation: Observation): ObservationFilterCategory {
  for (const [key, config] of Object.entries(observationFilterCategories)) {
    if (key === 'all') continue;
    if (config.types.includes(observation.category)) {
      return key as ObservationFilterCategory;
    }
  }
  return 'code';
}

export function ObservationPanel({
  observations,
  stats,
  loading,
  searchResults,
  searchLoading,
  onSearch,
  onPin,
  onEdit,
  onDelete,
  onPromote
}: ObservationPanelProps) {
  const { t } = useTranslation(['common']);
  const [activeFilter, setActiveFilter] = useState<ObservationFilterCategory>('all');
  const [priorityFilter, setPriorityFilter] = useState<ObservationPriority | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (value.trim()) {
        onSearch(value.trim());
      }
    }, 300);
  }, [onSearch]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const categoryCounts = useMemo(() => {
    const counts: Record<ObservationFilterCategory, number> = {
      all: observations.length,
      code: 0,
      architecture: 0,
      quality: 0,
      workflow: 0
    };
    for (const obs of observations) {
      const cat = getObservationFilterCategory(obs);
      counts[cat]++;
    }
    return counts;
  }, [observations]);

  const filteredObservations = useMemo(() => {
    let result = observations;
    if (activeFilter !== 'all') {
      result = result.filter(obs => getObservationFilterCategory(obs) === activeFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter(obs => obs.priority === priorityFilter);
    }
    return result;
  }, [observations, activeFilter, priorityFilter]);

  const displayList = searchQuery.trim() && searchResults.length > 0 ? searchResults : filteredObservations;

  return (
    <ScrollArea className="h-full">
      <div className="p-6 space-y-6">
        {/* Stats Header */}
        {stats && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-2 rounded-lg bg-muted/30">
                  <div className="text-lg font-semibold text-foreground">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">{t('common:total')}</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-green-500/10">
                  <div className="text-lg font-semibold text-green-400">{stats.active_count}</div>
                  <div className="text-xs text-muted-foreground">{t('common:active')}</div>
                </div>
                <div className="text-center p-2 rounded-lg bg-gray-500/10">
                  <div className="text-lg font-semibold text-gray-400">{stats.archived_count}</div>
                  <div className="text-xs text-muted-foreground">{t('common:archived')}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(observationFilterCategories) as ObservationFilterCategory[]).map((category) => {
            const config = observationFilterCategories[category];
            const count = categoryCounts[category];
            const Icon = filterIcons[category];
            const isActive = activeFilter === category;

            return (
              <Button
                key={category}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'gap-1.5 h-8',
                  isActive && 'bg-accent text-accent-foreground',
                  !isActive && count === 0 && 'opacity-50'
                )}
                onClick={() => setActiveFilter(category)}
                disabled={count === 0 && category !== 'all'}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{config.label}</span>
                {count > 0 && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      'ml-1 px-1.5 py-0 text-xs',
                      isActive && 'bg-background/20'
                    )}
                  >
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>

        {/* Priority Filter & Search */}
        <div className="flex gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as ObservationPriority | 'all')}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">{t('common:allPriorities')}</option>
            <option value="critical">{t('common:critical')}</option>
            <option value="high">{t('common:high')}</option>
            <option value="medium">{t('common:medium')}</option>
            <option value="low">{t('common:low')}</option>
          </select>
          <Input
            placeholder={t('common:searchObservations')}
            value={searchQuery}
            onChange={handleSearchChange}
            className="flex-1"
          />
          {searchLoading && (
            <div className="flex items-center">
              <Search className="h-4 w-4 animate-pulse text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Observation List */}
        {loading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && displayList.length === 0 && observations.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Eye className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('common:noObservationsYet')}
            </p>
          </div>
        )}

        {!loading && displayList.length === 0 && observations.length > 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Eye className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {t('common:noObservationsMatch')}
            </p>
            <Button
              variant="link"
              size="sm"
              onClick={() => {
                setActiveFilter('all');
                setPriorityFilter('all');
                setSearchQuery('');
              }}
              className="mt-2"
            >
              {t('common:clearFilters')}
            </Button>
          </div>
        )}

        {!loading && displayList.length > 0 && (
          <div className="space-y-3">
            <span className="text-xs text-muted-foreground">
              {displayList.length} of {observations.length} {t('common:observations')}
            </span>
            {displayList.map((observation) => (
              <ObservationCard
                key={observation.id}
                observation={observation}
                onPin={onPin}
                onEdit={onEdit}
                onDelete={onDelete}
                onPromote={onPromote}
              />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
