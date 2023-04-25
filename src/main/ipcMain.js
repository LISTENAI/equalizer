
import { ipcMain, BrowserWindow } from 'electron';
import drawHandle from './draw';
import ProjectHandle from './project';

let mainWindow = null;
function IpcMainHandle(window) {
  mainWindow = window;
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

};
export { IpcMainHandle, mainWindow };