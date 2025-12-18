import { ipcMain, dialog, BrowserWindow } from 'electron';

export default () => {
  ipcMain.handle('open-file', (e, data) => {
    const result = dialog.showOpenDialogSync(BrowserWindow.getFocusedWindow(), data);
    return { code: 0, data: result };
  });
};
