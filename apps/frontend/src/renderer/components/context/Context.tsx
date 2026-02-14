import { useState, useEffect, useCallback } from 'react';
import { FolderTree, Brain, Eye } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { useContextStore } from '../../stores/context-store';
import { useObservationStore } from '../../stores/observation-store';
import {
  loadObservations,
  searchObservations,
  pinObservation,
  editObservation,
  deleteObservation,
  promoteObservation
} from '../../stores/observation-store';
import { useProjectContext, useRefreshIndex, useMemorySearch } from './hooks';
import { ProjectIndexTab } from './ProjectIndexTab';
import { MemoriesTab } from './MemoriesTab';
import { ObservationPanel } from './ObservationPanel';
import type { ContextProps } from './types';
import type { Observation } from '../../../shared/types';

export function Context({ projectId }: ContextProps) {
  const {
    projectIndex,
    indexLoading,
    indexError,
    memoryStatus,
    memoryState,
    recentMemories,
    memoriesLoading,
    searchResults,
    searchLoading
  } = useContextStore();

  const {
    observations,
    observationStats,
    observationLoading,
    observationSearchResults,
    observationSearchLoading
  } = useObservationStore();

  const [activeTab, setActiveTab] = useState('index');

  // Custom hooks
  useProjectContext(projectId);
  const handleRefreshIndex = useRefreshIndex(projectId);
  const handleSearch = useMemorySearch(projectId);

  // Load observations when projectId changes
  useEffect(() => {
    if (projectId) {
      loadObservations(projectId);
    }
  }, [projectId]);

  // Observation handlers
  const handleObservationSearch = useCallback(
    (query: string) => {
      if (projectId) {
        searchObservations(projectId, query);
      }
    },
    [projectId]
  );

  const handlePin = useCallback(
    (id: string, pinned: boolean) => {
      if (projectId) {
        pinObservation(projectId, id, pinned);
      }
    },
    [projectId]
  );

  const handleEdit = useCallback(
    (observation: Observation) => {
      if (projectId) {
        const { id, ...fields } = observation;
        editObservation(projectId, id, fields);
      }
    },
    [projectId]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (projectId) {
        deleteObservation(projectId, id);
      }
    },
    [projectId]
  );

  const handlePromote = useCallback(
    (observation: Observation) => {
      if (projectId) {
        promoteObservation(projectId, observation.id);
      }
    },
    [projectId]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
        <div className="border-b border-border px-6 py-3">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="index" className="gap-2">
              <FolderTree className="h-4 w-4" />
              Project Index
            </TabsTrigger>
            <TabsTrigger value="memories" className="gap-2">
              <Brain className="h-4 w-4" />
              Memories
            </TabsTrigger>
            <TabsTrigger value="observations" className="gap-2">
              <Eye className="h-4 w-4" />
              Observations
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Project Index Tab */}
        <TabsContent value="index" className="flex-1 overflow-hidden m-0">
          <ProjectIndexTab
            projectIndex={projectIndex}
            indexLoading={indexLoading}
            indexError={indexError}
            onRefresh={handleRefreshIndex}
          />
        </TabsContent>

        {/* Memories Tab */}
        <TabsContent value="memories" className="flex-1 overflow-hidden m-0">
          <MemoriesTab
            memoryStatus={memoryStatus}
            memoryState={memoryState}
            recentMemories={recentMemories}
            memoriesLoading={memoriesLoading}
            searchResults={searchResults}
            searchLoading={searchLoading}
            onSearch={handleSearch}
          />
        </TabsContent>

        {/* Observations Tab */}
        <TabsContent value="observations" className="flex-1 overflow-hidden m-0">
          <ObservationPanel
            observations={observations}
            stats={observationStats}
            loading={observationLoading}
            searchResults={observationSearchResults}
            searchLoading={observationSearchLoading}
            onSearch={handleObservationSearch}
            onPin={handlePin}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onPromote={handlePromote}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
