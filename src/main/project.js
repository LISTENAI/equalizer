import { ProjectHandle } from './projectHandle';
import { ipcMain, dialog } from 'electron';
import { mainWindow } from './ipcMain';

async function openProject() {
    mainWindow.setEnabled(false);
    const res = dialog.showOpenDialogSync({
        properties: ['openFile'],
        filters: [{ name: 'custom File Type', extensions: ['lsaudio'] }]
    });
    mainWindow.setEnabled(true);

    if (res) {
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
    mainWindow.setEnabled(false);
    const res = dialog.showOpenDialogSync({
        properties: ['openDirectory']
    });
    mainWindow.setEnabled(true);

    if (res) {
        return res[0];
    } else {
        return '';
    }
}

export default () => {
    ipcMain.handle('open-dict', () => openDict());
    ipcMain.handle('open-project', async () => await openProject());
    ipcMain.handle('create-project', async (_e, msg) => await createProject(msg));
    ipcMain.handle('save-project', async (_e, msg) => await saveProject(msg));
};