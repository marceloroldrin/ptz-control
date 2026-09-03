import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureLocalConfig, setConfigPaths } from '../src/config.js';
import { startServer } from '../src/server.js';

const require = createRequire(import.meta.url);
const { app, BrowserWindow, shell } = require('electron');

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;
let serverHandle = null;

async function bootstrap() {
  const root = app.getAppPath();

  setConfigPaths({
    defaultPath: path.join(root, 'config', 'cameras.json'),
    localPath: path.join(app.getPath('userData'), 'cameras.local.json'),
  });

  await ensureLocalConfig();

  serverHandle = await startServer({
    publicDir: path.join(root, 'public'),
    host: '127.0.0.1',
    port: 8765,
  });

  return serverHandle.url;
}

function createWindow(url) {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 780,
    minWidth: 360,
    minHeight: 600,
    title: 'PTZ Control',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  mainWindow.loadURL(url);

  mainWindow.webContents.setWindowOpenHandler(({ url: targetUrl }) => {
    shell.openExternal(targetUrl);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  try {
    const url = await bootstrap();
    createWindow(url);
  } catch (error) {
    console.error(error);
    app.quit();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverHandle) {
      createWindow(serverHandle.url);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async () => {
  if (serverHandle) {
    await serverHandle.close();
    serverHandle = null;
  }
});
