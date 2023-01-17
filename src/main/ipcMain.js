
import { ipcMain, BrowserWindow, ipcRenderer } from 'electron';
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
