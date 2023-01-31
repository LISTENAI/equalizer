
import { ipcMain, BrowserWindow, dialog } from 'electron';
import { ProjectHandle } from './project';
let mainWindow = null;
export function IpcMainHandle(window) {
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
  ipcMain.handle('open-dict', () => openDict());
  ipcMain.handle('open-project', async () => await openProject());
  ipcMain.handle('create-project', async (_e, msg) => await createProject(msg));
  ipcMain.handle('save-project', async (_e, msg) => await saveProject(msg));


};
async function openProject() {
  const res = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  });
  if (res) {
    console.log(res);
    const data = await ProjectHandle.checkProject(res[0]);
    return data;
  } else {
    return { code: 0, data: null };
  }

}
async function createProject(params) {
  return await ProjectHandle.createProject(params);
}
async function saveProject(params) {
  return await ProjectHandle.saveProject(params);
}
//打开目录
function openDict() {
  const res = dialog.showOpenDialogSync({
    properties: ['openDirectory']
  });
  if (res) {
    return res[0];
  } else {
    return '';
  }
}
