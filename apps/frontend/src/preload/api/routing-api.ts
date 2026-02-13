import { ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import type {
  IPCResult,
  RoutingAnalyzeTaskInput,
  RoutingRecommendation,
  RoutingSettings,
} from '../../shared/types';

export interface RoutingAPI {
  analyzeTask: (input: RoutingAnalyzeTaskInput) => Promise<IPCResult<RoutingRecommendation>>;
  getDefaults: (projectId: string) => Promise<IPCResult<RoutingSettings>>;
  saveDefaults: (projectId: string, settings: RoutingSettings) => Promise<IPCResult>;
}

export const createRoutingAPI = (): RoutingAPI => ({
  analyzeTask: (input) =>
    ipcRenderer.invoke(IPC_CHANNELS.ROUTING_ANALYZE_TASK, input),

  getDefaults: (projectId) =>
    ipcRenderer.invoke(IPC_CHANNELS.ROUTING_GET_DEFAULTS, projectId),

  saveDefaults: (projectId, settings) =>
    ipcRenderer.invoke(IPC_CHANNELS.ROUTING_SAVE_DEFAULTS, projectId, settings),
});
