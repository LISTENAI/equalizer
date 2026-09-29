
import { ipcMain, BrowserWindow, shell } from 'electron';
import drawHandle from './draw';
import ProjectHandle from './project';
import serialport from './serialport';
import file from './file';
import { playerIpc } from './player';

let mainWindow = null;
let registered = false;
function IpcMainHandle(window) {
  mainWindow = window;
  window.on('maximize', () => {
    window.webContents.send('windowChange', { isMaximized: window.isMaximized() });
  });
  window.on('unmaximize', () => {
    window.webContents.send('windowChange', { isMaximized: window.isMaximized() });
  });
  window.on('close', () => {
    if (mainWindow === window) mainWindow = null;
  });
  if (registered) return;
  registered = true;
  ipcMain.on('window-min', function () {
    mainWindow?.minimize();
  });
  ipcMain.on('window-max', function () {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) {
      mainWindow.restore();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.on('window-close', function () {
    mainWindow?.close();
  });
  ipcMain.on('open-external', function (event, url) {
    shell.openExternal(url);
  });

  playerIpc(ipcMain);
  ProjectHandle();
  drawHandle(ipcMain);
  serialport();
  file();
};
export { IpcMainHandle, mainWindow };
