/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import fs from 'fs';
import { spawn, ChildProcess } from 'child_process';
import {
  app,
  BrowserWindow,
  shell,
  ipcMain,
  Menu,
  dialog,
  type IpcMainEvent,
} from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';

import type {
  DevEngineMode,
  EngineHealth,
  ExportLinksPayload,
  ExportLinksResult,
  ExtractionEvent,
  ImportLinksResult,
  StartExtractionPayload,
  UpdaterEvent,
} from './preload';
import { resolveHtmlPath } from './util';

let mainWindow: BrowserWindow | null = null;

class AppUpdater {
  private latestEvent: UpdaterEvent = {
    type: 'idle',
    currentVersion: app.getVersion(),
    message: 'Updates have not been checked yet.',
  };

  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
      log.info('AutoUpdater: Checking for update...');
      this.emit({ type: 'checking', message: 'Checking for updates.' });
    });
    autoUpdater.on('update-available', (info) => {
      log.info('AutoUpdater: Update available.', info);
      this.emit({
        type: 'available',
        version: info.version,
        message: `Version ${info.version} is available. Download will start automatically.`,
      });
    });
    autoUpdater.on('update-not-available', (info) => {
      log.info('AutoUpdater: Update not available.', info);
      this.emit({
        type: 'not-available',
        version: info.version,
        message: 'You are running the latest version.',
      });
    });
    autoUpdater.on('error', (err) => {
      log.error('AutoUpdater: Error in auto-updater.', err);
      this.emit({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });
    autoUpdater.on('download-progress', (progressObj) => {
      log.info(
        `AutoUpdater: Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`,
      );
      this.emit({
        type: 'downloading',
        percent: progressObj.percent,
        transferred: progressObj.transferred,
        total: progressObj.total,
        bytesPerSecond: progressObj.bytesPerSecond,
        message: `Downloading update (${Math.round(progressObj.percent)}%).`,
      });
    });
    autoUpdater.on('update-downloaded', (info) => {
      log.info('AutoUpdater: Update downloaded', info);
      this.emit({
        type: 'downloaded',
        version: info.version,
        message: 'Update downloaded. Restart to install.',
      });
    });
  }

  emit(event: Omit<UpdaterEvent, 'currentVersion'>) {
    this.latestEvent = {
      currentVersion: app.getVersion(),
      ...event,
    };
    mainWindow?.webContents.send('updater-event', this.latestEvent);
  }

  sendCurrentStatus() {
    mainWindow?.webContents.send('updater-event', this.latestEvent);
  }

  checkForUpdates() {
    if (!app.isPackaged) {
      this.emit({
        type: 'disabled',
        message: 'Updates are available only in packaged builds.',
      });
      return;
    }

    autoUpdater.checkForUpdates().catch((err) => {
      this.emit({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  downloadUpdate() {
    if (!app.isPackaged) {
      this.emit({
        type: 'disabled',
        message: 'Updates are available only in packaged builds.',
      });
      return;
    }

    autoUpdater.downloadUpdate().catch((err) => {
      this.emit({
        type: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }

  quitAndInstall() {
    if (this.latestEvent.type !== 'downloaded') {
      this.emit({
        type: 'error',
        message: 'No downloaded update is ready to install.',
      });
      return;
    }

    autoUpdater.quitAndInstall(false, true);
  }
}

let appUpdater: AppUpdater | null = null;

const getBundledEnginePath = () => {
  const binName = process.platform === 'win32' ? 'extractor.exe' : 'extractor';

  return app.isPackaged
    ? path.join(process.resourcesPath, 'resources/bin', binName)
    : path.join(app.getAppPath(), 'resources/bin', binName);
};

const getScriptEnginePath = () =>
  path.join(app.getAppPath(), 'engine/extractor.py');

const getEnginePath = (devEngineMode: DevEngineMode = 'script') => {
  if (app.isPackaged || devEngineMode === 'binary') {
    return getBundledEnginePath();
  }

  return getScriptEnginePath();
};

ipcMain.handle('links:import', async (): Promise<ImportLinksResult> => {
  if (!mainWindow) return { canceled: true };

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import links',
    properties: ['openFile'],
    filters: [{ name: 'Text Files', extensions: ['txt'] }],
  });

  if (result.canceled || result.filePaths.length === 0) {
    return { canceled: true };
  }

  const filePath = result.filePaths[0];
  const content = fs.readFileSync(filePath, 'utf-8');
  const links = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    canceled: false,
    filePath,
    links,
  };
});

ipcMain.handle(
  'links:export',
  async (_event, payload: ExportLinksPayload): Promise<ExportLinksResult> => {
    if (!mainWindow) return { canceled: true };

    const result = await dialog.showSaveDialog(mainWindow, {
      title: 'Export ready links',
      defaultPath: `nodextract-links-${new Date().toISOString().slice(0, 10)}.txt`,
      filters: [{ name: 'Text Files', extensions: ['txt'] }],
    });

    if (result.canceled || !result.filePath) {
      return { canceled: true };
    }

    fs.writeFileSync(result.filePath, payload.links.join('\n'), 'utf-8');

    return {
      canceled: false,
      filePath: result.filePath,
      count: payload.links.length,
    };
  },
);

ipcMain.handle(
  'engine:get-health',
  async (
    _event,
    options?: { devEngineMode?: DevEngineMode },
  ): Promise<EngineHealth> => {
    const engineMode = app.isPackaged
      ? 'binary'
      : options?.devEngineMode || 'script';
    const enginePath = getEnginePath(engineMode);

    return {
      appVersion: app.getVersion(),
      platform: process.platform,
      packaged: app.isPackaged,
      enginePath,
      engineExists: fs.existsSync(enginePath),
      engineMode,
      browserMode: 'playwright-chromium',
      browserNote:
        'Uses Playwright managed Chromium; system Chrome is not required.',
    };
  },
);

ipcMain.on('update:get-status', () => {
  appUpdater?.sendCurrentStatus();
});

ipcMain.on('update:check', () => {
  appUpdater?.checkForUpdates();
});

ipcMain.on('update:download', () => {
  appUpdater?.downloadUpdate();
});

ipcMain.on('update:install', () => {
  appUpdater?.quitAndInstall();
});

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

let pythonProcess: ChildProcess | null = null;

const defaultExtractionConfig = {
  concurrency: 5,
  retries: 3,
  headless: false,
  devEngineMode: 'script' as DevEngineMode,
};

const replyExtractionEvent = (
  event: IpcMainEvent,
  payload: ExtractionEvent,
) => {
  event.reply('extraction-event', payload);
};

const normalizeStartPayload = (
  payload: StartExtractionPayload | string[],
): StartExtractionPayload => {
  if (Array.isArray(payload)) {
    return {
      links: payload,
      config: defaultExtractionConfig,
    };
  }

  return {
    links: payload.links,
    config: payload.config || defaultExtractionConfig,
  };
};

ipcMain.on(
  'start-extraction',
  async (event, payload: StartExtractionPayload | string[]) => {
    if (pythonProcess) {
      replyExtractionEvent(event, {
        type: 'log',
        level: 'warn',
        message: 'Extraction is already running.',
      });
      return;
    }

    const { links, config } = normalizeStartPayload(payload);

    const tempFilePath = path.join(app.getPath('userData'), 'temp_links.json');
    fs.writeFileSync(tempFilePath, JSON.stringify(links, null, 2), 'utf-8');

    const devEngineMode =
      config.devEngineMode || defaultExtractionConfig.devEngineMode;
    const extractorPath = getEnginePath(devEngineMode);

    const args = [
      '--input',
      tempFilePath,
      '--concurrency',
      config.concurrency.toString(),
      '--retries',
      config.retries.toString(),
    ];
    if (config.headless) {
      args.push('--headless');
    }

    if (app.isPackaged || devEngineMode === 'binary') {
      pythonProcess = spawn(extractorPath, args);
    } else {
      pythonProcess = spawn('python', ['-u', extractorPath, ...args]);
    }

    let buffer = '';

    pythonProcess.stdout?.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      lines.forEach((line) => {
        if (line.trim()) {
          try {
            const jsonEvent = JSON.parse(line);
            replyExtractionEvent(event, jsonEvent as ExtractionEvent);
          } catch {
            replyExtractionEvent(event, {
              type: 'log',
              level: 'error',
              message: `Raw output: ${line}`,
            });
          }
        }
      });
    });

    pythonProcess.stderr?.on('data', (chunk) => {
      replyExtractionEvent(event, {
        type: 'log',
        level: 'error',
        message: chunk.toString(),
      });
    });

    pythonProcess.on('error', (err) => {
      pythonProcess = null;
      replyExtractionEvent(event, {
        type: 'log',
        level: 'error',
        message: `Failed to start extractor: ${err.message}`,
      });
      replyExtractionEvent(event, { type: 'done' });
    });

    pythonProcess.on('close', (code) => {
      pythonProcess = null;
      replyExtractionEvent(event, {
        type: 'log',
        level: 'info',
        message: `Python process exited with code ${code}`,
      });
      replyExtractionEvent(event, { type: 'done' });
    });
  },
);

ipcMain.on('stop-extraction', (event) => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
    replyExtractionEvent(event, {
      type: 'log',
      level: 'warn',
      message: 'Extraction stopped by user.',
    });
    replyExtractionEvent(event, { type: 'done' });
  }
});

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

if (isDebug) {
  require('electron-debug').default();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icon.png'),
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.maximize();
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  Menu.setApplicationMenu(null);

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  if (!appUpdater) {
    appUpdater = new AppUpdater();
  }
  appUpdater.sendCurrentStatus();
  appUpdater.checkForUpdates();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);
