
import { ipcMain, BrowserWindow, shell } from 'electron';
import drawHandle from './draw';
import ProjectHandle from './project';
import serialport from './serialport';
import file from './file';

let mainWindow = null;
function IpcMainHandle(window) {
  mainWindow = window;
  window.on('maximize', () => {
    let focusWindow = BrowserWindow.getFocusedWindow();
    focusWindow.webContents.send('windowChange', { isMaximized: focusWindow.isMaximized() });
  });
  window.on('unmaximize', () => {
    let focusWindow = BrowserWindow.getFocusedWindow();
    focusWindow.webContents.send('windowChange', { isMaximized: focusWindow.isMaximized() });
  });
  window.on('close', () => {
    mainWindow = null;
  });
  ipcMain.on('window-min', function () {
    window.minimize();
  });
  ipcMain.on('window-max', function () {
    if (window.isMaximized()) {
      window.restore();
    } else {
      window.maximize();
    }
  });
  ipcMain.on('window-close', function () {
    window.close();
  });
  ipcMain.on('open-external', function (event, url) {
    shell.openExternal(url);
  });

  ProjectHandle();
  drawHandle(ipcMain);
  serialport();
  file();
};
export { IpcMainHandle, mainWindow };