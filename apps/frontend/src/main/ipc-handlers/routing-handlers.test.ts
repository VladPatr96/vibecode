import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/constants';
import { registerRoutingHandlers } from './routing-handlers';
import { projectStore } from '../project-store';

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}));

vi.mock('../project-store', () => ({
  projectStore: {
    getProject: vi.fn(),
  },
}));

describe('routing-handlers', () => {
  const registeredHandlers = new Map<string, Function>();
  let tempDir: string;

  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'routing-handlers-'));

    (ipcMain.handle as ReturnType<typeof vi.fn>).mockImplementation((channel: string, handler: Function) => {
      registeredHandlers.set(channel, handler);
    });

    vi.mocked(projectStore.getProject).mockImplementation((projectId: string) => ({
      id: projectId,
      name: 'Test Project',
      path: tempDir,
      autoBuildPath: '.auto-claude',
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as never);

    registerRoutingHandlers();
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('registers routing IPC handlers', () => {
    expect(registeredHandlers.has(IPC_CHANNELS.ROUTING_ANALYZE_TASK)).toBe(true);
    expect(registeredHandlers.has(IPC_CHANNELS.ROUTING_GET_DEFAULTS)).toBe(true);
    expect(registeredHandlers.has(IPC_CHANNELS.ROUTING_SAVE_DEFAULTS)).toBe(true);
  });

  it('returns default settings when file does not exist', async () => {
    const handler = registeredHandlers.get(IPC_CHANNELS.ROUTING_GET_DEFAULTS)!;
    const result = await handler({}, 'project-1');

    expect(result.success).toBe(true);
    expect(result.data.defaultProviders).toEqual({
      planning: 'claude',
      coding: 'claude',
      qa: 'claude',
    });
  });

  it('saves and reloads routing settings', async () => {
    const saveHandler = registeredHandlers.get(IPC_CHANNELS.ROUTING_SAVE_DEFAULTS)!;
    const getHandler = registeredHandlers.get(IPC_CHANNELS.ROUTING_GET_DEFAULTS)!;
    const settings = {
      defaultProviders: {
        planning: 'gemini',
        coding: 'claude',
        qa: 'codex',
      },
      fallbackChains: {
        claude: ['gemini', 'codex', 'openai', 'opencode'],
        gemini: ['claude', 'codex', 'openai', 'opencode'],
        openai: ['codex', 'claude', 'gemini', 'opencode'],
        codex: ['openai', 'claude', 'gemini', 'opencode'],
        opencode: ['claude', 'gemini', 'codex', 'openai'],
      },
      showConfirmationDialog: false,
    };

    const saveResult = await saveHandler({}, 'project-1', settings);
    const getResult = await getHandler({}, 'project-1');

    expect(saveResult).toEqual({ success: true });
    expect(getResult.success).toBe(true);
    expect(getResult.data).toEqual(settings);
  });

  it('analyzes large task as gemini planning recommendation', async () => {
    const analyzeHandler = registeredHandlers.get(IPC_CHANNELS.ROUTING_ANALYZE_TASK)!;
    const specContent = 'A'.repeat(12_000);
    const result = await analyzeHandler({}, { specContent });

    expect(result.success).toBe(true);
    expect(result.data.planning.provider_type).toBe('gemini');
    expect(result.data.planning.model).toBe('gemini-2.0-flash');
  });
});
