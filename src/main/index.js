import { is } from '@electron-toolkit/utils';
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { IpcMainHandle } from './ipcMain';

const isDevelopment = process.env.NODE_ENV !== 'production';
const WINDOW_WIDTH = 1320;
const WINDOW_HEIGHT = 640;

async function createWindow() {
  try {
    // Create the browser window.
    const win = new BrowserWindow({
      height: WINDOW_HEIGHT,
      width: WINDOW_WIDTH,
      minHeight: WINDOW_HEIGHT,
      minWidth: WINDOW_WIDTH,
      frame: false,
      show: false,
      useContentSize: true,
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });
    win.once('ready-to-show', () => {
      win.show();
    });
    IpcMainHandle(win);
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      await win.loadURL(process.env['ELECTRON_RENDERER_URL']);
      win.webContents.openDevTools();
    } else {
      await win.loadFile(path.join(__dirname, '../renderer/index.html'));
    }
  } catch (error) {
    console.log(error);
  }
}

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', async () => {
  // if (isDevelopment && !process.env.IS_TEST) {
  //   // Install Vue Devtools
  //   try {
  //     await installExtension(VUEJS_DEVTOOLS);
  //   } catch (e) {
  //     console.error('Vue Devtools failed to install:', e.toString());
  //   }
  // }
  createWindow();
});
// app.allowRendererProcessReuse = false;

// Exit cleanly on request from parent process in development mode.
if (isDevelopment) {
  if (process.platform === 'win32') {
    process.on('message', (data) => {
      if (data === 'graceful-exit') {
        app.quit();
      }
    });
  } else {
    process.on('SIGTERM', () => {
      app.quit();
    });
  }
}
