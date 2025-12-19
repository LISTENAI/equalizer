import koffi from 'koffi';
import path from 'path';
import * as stru from './stru';

// __static is provided by electron-builder at runtime; join to the dlls dir
let binDllPath = path.join(__static, 'dlls');
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
    // resolve path differences when running in dev vs packaged app
    binDllPath = binDllPath.replace('\\public\\', '\\');
}
else {
    binDllPath = binDllPath.replace('\\resources\\app.asar\\', '\\');
}

const detectArchFolder = function () {
    switch (process.arch) {
        case "ia32":
            return 'x86';
        case "x64":
            return 'x64';
        case "arm64":
            return 'arm64';
        default:
            throw new Error('Arch not supported!');
    }
};

const archFolder = detectArchFolder();
const binDll = path.join(binDllPath, archFolder, 'iflytekEqDrcDrawApi.dll');
const eqDrawDll = path.join(binDllPath, archFolder, 'eqdrawDLL.dll');

console.log('native dlls ->', binDll, eqDrawDll);

const lib = koffi.load(binDll);
export const iflytekBinHandle = lib.func('int writeToBinFile(const char*, struDrcPrm*)');

const eqLib = koffi.load(eqDrawDll);
const nativeEqDrawPoints = eqLib.func('struEqDrawResult* eqDrawPoints(struMonoEqPrm*, struUIXYInfo*)')
const nativeFreePoints = eqLib.func('void freePoints(struEqDrawResult*)');
const nativeDrcDrawPoints = eqLib.func('struDrcDrawResult* drcDrawPoints(struDrcPrm*, struUIDrcInfo*)');
const nativeFreeDrcPoints = eqLib.func('void freeDrcPoints(struDrcDrawResult*)');
export const iflytekEqDraw = {
    eqDrawPoints: (monoEqPrm, xyData) => {
        const res = nativeEqDrawPoints(monoEqPrm, xyData);
        const parsed = koffi.decode(res, stru.struEqDrawResult);
        nativeFreePoints(res);
        return parsed;
    },
    drcDrawPoints: (drcPrm, drcInfo) => {
        const res = nativeDrcDrawPoints(drcPrm, drcInfo);
        const parsed = koffi.decode(res, stru.struDrcDrawResult);
        nativeFreeDrcPoints(res);
        return parsed;
    }
};