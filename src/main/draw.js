import {eqDrawPoints, writeToBinFile} from '../libs/index';
export default (ipcMain) => {
    ipcMain.handle('eq-draw', (_e, eqData, chartConf) => eqDrawPoints(eqData, chartConf));
    ipcMain.handle('write-bin', (_e, binpath, audioConf) => writeToBinFile(binpath, audioConf));
}