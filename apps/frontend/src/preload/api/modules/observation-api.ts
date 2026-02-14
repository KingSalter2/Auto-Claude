import { IPC_CHANNELS } from '../../../shared/constants';
import type {
  Observation,
  ObservationStats,
  IPCResult
} from '../../../shared/types';
import { invokeIpc } from './ipc-utils';

/**
 * Observation API operations
 */
export interface ObservationAPI {
  observationList: (projectHash: string, specId?: string) => Promise<IPCResult<Observation[]>>;
  observationSearch: (projectHash: string, query: string, category?: string, scope?: string) => Promise<IPCResult<Observation[]>>;
  observationGet: (projectHash: string, id: string) => Promise<IPCResult<Observation>>;
  observationPin: (projectHash: string, id: string, pinned: boolean) => Promise<IPCResult<void>>;
  observationEdit: (projectHash: string, id: string, fields: Partial<Observation>) => Promise<IPCResult<void>>;
  observationDelete: (projectHash: string, id: string) => Promise<IPCResult<void>>;
  observationPromote: (projectHash: string, id: string) => Promise<IPCResult<void>>;
  observationGetStats: (projectHash: string) => Promise<IPCResult<ObservationStats>>;
}

/**
 * Creates the Observation API implementation
 */
export const createObservationAPI = (): ObservationAPI => ({
  observationList: (projectHash: string, specId?: string): Promise<IPCResult<Observation[]>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_LIST, projectHash, specId),

  observationSearch: (projectHash: string, query: string, category?: string, scope?: string): Promise<IPCResult<Observation[]>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_SEARCH, projectHash, query, category, scope),

  observationGet: (projectHash: string, id: string): Promise<IPCResult<Observation>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_GET, projectHash, id),

  observationPin: (projectHash: string, id: string, pinned: boolean): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_PIN, projectHash, id, pinned),

  observationEdit: (projectHash: string, id: string, fields: Partial<Observation>): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_EDIT, projectHash, id, fields),

  observationDelete: (projectHash: string, id: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_DELETE, projectHash, id),

  observationPromote: (projectHash: string, id: string): Promise<IPCResult<void>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_PROMOTE, projectHash, id),

  observationGetStats: (projectHash: string): Promise<IPCResult<ObservationStats>> =>
    invokeIpc(IPC_CHANNELS.OBSERVATION_GET_STATS, projectHash),
});
