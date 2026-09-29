import { eqDrawPoints, drcDrawPoints, writeToBinFile, readFromBinFile } from '../libs/index';
import { join } from 'path';
export default (ipcMain) => {
    ipcMain.handle('eq-draw', (_e, eqData, chartConf) => eqDrawPoints(eqData, chartConf));
    ipcMain.handle('drc-draw', (_e, drcData, chartConf) => drcDrawPoints(drcData, chartConf));
    ipcMain.handle('write-bin', (_e, binpath, name, audioConf) => {
        return writeToBinFile(join(binpath, name), audioConf);
    });
    ipcMain.handle('read-bin', (_e, binfile) => {
        return readFromBinFile(binfile);
    });
};
