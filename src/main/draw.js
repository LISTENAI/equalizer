import { eqDrawPoints, writeToBinFile } from '../libs/index';
import { join } from 'path';
const iconv = require("iconv-lite");
export default (ipcMain) => {
    ipcMain.handle('eq-draw', (_e, eqData, chartConf) => eqDrawPoints(eqData, chartConf));
    ipcMain.handle('write-bin', (_e, binpath, name, audioConf) => {
        const pathstr = iconv.encode(join(binpath, name), 'GBK');
        return writeToBinFile(pathstr, audioConf);
    });
};