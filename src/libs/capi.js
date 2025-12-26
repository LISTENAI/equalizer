import koffi from 'koffi';
import path from 'path';
import * as stru from './stru';
import { is } from '@electron-toolkit/utils';

// Resolve static path for native dlls, compatible with Vite/Electron build
const staticRoot = is.dev ? process.cwd() : process.resourcesPath;

let binDllPath = path.join(staticRoot, 'dlls');
if (!is.dev) {
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
export const iflytekBinHandle = {
    writeToBinFile: lib.func('int writeToBinFile(const char*, struAudioPrm*)'),
    readFromBinFile: lib.func('int readFromBinFile(const char*, _Out_ struAudioPrm*)'),
};

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