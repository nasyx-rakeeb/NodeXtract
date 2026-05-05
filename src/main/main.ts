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
import { app, BrowserWindow, shell, ipcMain } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;

    autoUpdater.on('checking-for-update', () => log.info('AutoUpdater: Checking for update...'));
    autoUpdater.on('update-available', (info) => {
      log.info('AutoUpdater: Update available.', info);
      mainWindow?.webContents.send('update-status', { type: 'available', version: info.version });
    });
    autoUpdater.on('update-not-available', (info) => log.info('AutoUpdater: Update not available.', info));
    autoUpdater.on('error', (err) => {
      log.error('AutoUpdater: Error in auto-updater.', err);
      mainWindow?.webContents.send('update-status', { type: 'error', message: err.message });
    });
    autoUpdater.on('download-progress', (progressObj) => {
      log.info(`AutoUpdater: Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}%`);
      mainWindow?.webContents.send('update-status', { type: 'progress', percent: progressObj.percent });
    });
    autoUpdater.on('update-downloaded', (info) => {
      log.info('AutoUpdater: Update downloaded', info);
      mainWindow?.webContents.send('update-status', { type: 'downloaded', version: info.version });
    });

    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

let pythonProcess: ChildProcess | null = null;

ipcMain.on('start-extraction', async (event, data: any) => {
  if (pythonProcess) {
    event.reply('extraction-event', { type: 'log', level: 'warn', message: 'Extraction is already running.' });
    return;
  }

  const links = Array.isArray(data) ? data : data.links;
  const config = Array.isArray(data) ? { concurrency: 5, retries: 3, headless: false } : (data.config || { concurrency: 5, retries: 3, headless: false });

  const tempFilePath = path.join(app.getPath('userData'), 'temp_links.json');
  fs.writeFileSync(tempFilePath, JSON.stringify(links, null, 2), 'utf-8');
  
  const binName = process.platform === 'win32' ? 'extractor.exe' : 'extractor';
  const extractorPath = app.isPackaged 
    ? path.join(process.resourcesPath, 'resources/bin', binName)
    : path.join(app.getAppPath(), 'engine/extractor.py');
  
  const args = [
    '--input', tempFilePath,
    '--concurrency', config.concurrency.toString(),
    '--retries', config.retries.toString()
  ];
  if (config.headless) {
    args.push('--headless');
  }
  
  if (app.isPackaged) {
    pythonProcess = spawn(extractorPath, args);
  } else {
    pythonProcess = spawn('python', ['-u', extractorPath, ...args]);
  }
  
  let buffer = '';

  pythonProcess.stdout?.on('data', (data) => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        try {
          const jsonEvent = JSON.parse(line);
          event.reply('extraction-event', jsonEvent);
        } catch (e) {
          event.reply('extraction-event', { type: 'log', level: 'error', message: `Raw output: ${line}` });
        }
      }
    }
  });

  pythonProcess.stderr?.on('data', (data) => {
    event.reply('extraction-event', { type: 'log', level: 'error', message: data.toString() });
  });

  pythonProcess.on('error', (err) => {
    pythonProcess = null;
    event.reply('extraction-event', { type: 'log', level: 'error', message: `Failed to start extractor: ${err.message}` });
    event.reply('extraction-event', { type: 'done' });
  });

  pythonProcess.on('close', (code) => {
    pythonProcess = null;
    event.reply('extraction-event', { type: 'log', level: 'info', message: `Python process exited with code ${code}` });
    event.reply('extraction-event', { type: 'done' });
  });
});

ipcMain.on('stop-extraction', (event) => {
  if (pythonProcess) {
    pythonProcess.kill();
    pythonProcess = null;
    event.reply('extraction-event', { type: 'log', level: 'warn', message: 'Extraction stopped by user.' });
    event.reply('extraction-event', { type: 'done' });
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
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
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
