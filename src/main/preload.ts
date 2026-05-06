// Disable no-unused-vars, broken for spread args
/* eslint no-unused-vars: off */
import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

export type Channels =
  | 'ipc-example'
  | 'start-extraction'
  | 'stop-extraction'
  | 'extraction-event'
  | 'updater-event'
  | 'update:check'
  | 'update:download'
  | 'update:install'
  | 'update:get-status'
  | 'links:import'
  | 'links:export'
  | 'engine:get-health';

export type LinkStatus =
  | 'pending'
  | 'opening'
  | 'verifying'
  | 'waiting_free'
  | 'waiting_start'
  | 'intercepting'
  | 'success'
  | 'failed'
  | `attempt_${number}`;

export type LogLevel = 'info' | 'warn' | 'warning' | 'error';

export type ExtractionConfig = {
  concurrency: number;
  retries: number;
  headless: boolean;
};

export type StartExtractionPayload = {
  links: string[];
  config: ExtractionConfig;
};

export type ExtractionEvent =
  | {
      type: 'log';
      level: LogLevel;
      message: string;
    }
  | {
      type: 'progress';
      link: string;
      status: LinkStatus;
      attempt?: number;
    }
  | {
      type: 'result';
      link: string;
      status: 'success' | 'failed';
      download_url?: string;
      error?: string;
    }
  | {
      type: 'done';
    };

export type UpdaterEvent = {
  type:
    | 'idle'
    | 'checking'
    | 'available'
    | 'not-available'
    | 'downloading'
    | 'downloaded'
    | 'error'
    | 'disabled';
  currentVersion: string;
  version?: string;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  message?: string;
};

export type ImportLinksResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      filePath: string;
      links: string[];
    };

export type ExportLinksPayload = {
  links: string[];
};

export type ExportLinksResult =
  | {
      canceled: true;
    }
  | {
      canceled: false;
      filePath: string;
      count: number;
    };

export type EngineHealth = {
  appVersion: string;
  platform: string;
  packaged: boolean;
  enginePath: string;
  engineExists: boolean;
  browserMode: 'playwright-chromium';
  browserNote: string;
};

type SendPayloadByChannel = {
  'ipc-example': [unknown];
  'start-extraction': [StartExtractionPayload];
  'stop-extraction': [];
  'update:check': [];
  'update:download': [];
  'update:install': [];
  'update:get-status': [];
};

type ListenPayloadByChannel = {
  'ipc-example': unknown;
  'extraction-event': ExtractionEvent;
  'updater-event': UpdaterEvent;
};

type InvokePayloadByChannel = {
  'links:import': [];
  'links:export': [ExportLinksPayload];
  'engine:get-health': [];
};

type InvokeResultByChannel = {
  'links:import': ImportLinksResult;
  'links:export': ExportLinksResult;
  'engine:get-health': EngineHealth;
};

type SendChannels = keyof SendPayloadByChannel;
type ListenChannels = keyof ListenPayloadByChannel;
type InvokeChannels = keyof InvokePayloadByChannel;

const electronHandler = {
  ipcRenderer: {
    sendMessage<C extends SendChannels>(
      channel: C,
      ...args: SendPayloadByChannel[C]
    ) {
      ipcRenderer.send(channel, ...args);
    },
    on<C extends ListenChannels>(
      channel: C,
      func: (payload: ListenPayloadByChannel[C]) => void,
    ) {
      const subscription = (
        _event: IpcRendererEvent,
        payload: ListenPayloadByChannel[C],
      ) => func(payload);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },
    once<C extends ListenChannels>(
      channel: C,
      func: (payload: ListenPayloadByChannel[C]) => void,
    ) {
      ipcRenderer.once(channel, (_event, payload: ListenPayloadByChannel[C]) =>
        func(payload),
      );
    },
    invoke<C extends InvokeChannels>(
      channel: C,
      ...args: InvokePayloadByChannel[C]
    ): Promise<InvokeResultByChannel[C]> {
      return ipcRenderer.invoke(channel, ...args);
    },
  },
};

contextBridge.exposeInMainWorld('electron', electronHandler);

export type ElectronHandler = typeof electronHandler;
