
import { ipcMain, BrowserWindow } from 'electron';
import drawHandle from './draw';
import ProjectHandle from './project';
import serialport from './serialport';
import file from './file';

let mainWindow = null;
function IpcMainHandle(window) {
  mainWindow = window;
  BrowserWindow.getFocusedWindow().on('maximize', () => {
    let focusWindow = BrowserWindow.getFocusedWindow();
    focusWindow.webContents.send('windowChange', { isMaximized: focusWindow.isMaximized() });
  });
  BrowserWindow.getFocusedWindow().on('unmaximize', () => {
    let focusWindow = BrowserWindow.getFocusedWindow();
    focusWindow.webContents.send('windowChange', { isMaximized: focusWindow.isMaximized() });
  });
  window.on('close', () => {
    mainWindow = null;
  });
  ipcMain.on('window-min', function () {
    BrowserWindow.getFocusedWindow().minimize();
  });
  ipcMain.on('window-max', function () {
    if (BrowserWindow.getFocusedWindow().isMaximized()) {
      BrowserWindow.getFocusedWindow().restore();
    } else {
      BrowserWindow.getFocusedWindow().maximize();
    }
  });
  ipcMain.on('window-close', function () {
    BrowserWindow.getFocusedWindow().close();
  });

  ProjectHandle();
  drawHandle(ipcMain);
  serialport();
  file();
};
export { IpcMainHandle, mainWindow };