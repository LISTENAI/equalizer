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
const soundEffectDll = path.join(binDllPath, archFolder, 'SoundEffect.dll');

console.log('native dlls ->', binDll, eqDrawDll, soundEffectDll);

export const IFLYTEK_ALG_ID_E =  {
    IFLYTEK_ALG_ID_BASSBOOST: 0,
    IFLYTEK_ALG_ID_TREBLEBOOST: 1,
    IFLYTEK_ALG_ID_PEQ: 2,
    IFLYTEK_ALG_ID_DRC: 3,
    IFLYTEK_ALG_ID_GAIN: 4,
    IFLYTEK_ALG_ID_LIMITER: 5
};

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

const soundEffectLib = koffi.load(soundEffectDll);
const nativeAudioCreate = soundEffectLib.func('int IFLYTEK_AudioCreate(_Out_ char*, _Out_ int*)');
const nativeAudioInitial = soundEffectLib.func('int IFLYTEK_AudioInitial(_Out_ char*)');
const nativeAudioReset = soundEffectLib.func('int IFLYTEK_AudioReset(_Out_ char*, int)');
const nativeAudioSet = soundEffectLib.func('int IFLYTEK_AudioSet(_Out_ char*, struAudioPrm*)');
const nativeAudioGet = soundEffectLib.func('int IFLYTEK_AudioGet(_Out_ char*, _Out_ struAudioPrm*)');
const nativeAudioProcess = soundEffectLib.func('int IFLYTEK_AudioProcess(_Out_ char*, _Out_ int*, _Out_ int*, int)');
const nativeAudioDelete = soundEffectLib.func('int IFLYTEK_AudioDelete(_Out_ char*)');
const nativeAudioGetInfo = soundEffectLib.func('int IFLYTEK_AudioGetInfo(_Out_ const char**)');
const nativeSetAlgParam = soundEffectLib.func('int IFLYTEK_SetAlgParam(_Out_ char*, int, _Out_ char*)');

export const iflytekSoundEffect = {
    audioCreate: nativeAudioCreate,
    audioInitial: nativeAudioInitial,
    audioReset: nativeAudioReset,
    audioSet: nativeAudioSet,
    audioGet: nativeAudioGet,
    audioProcess: nativeAudioProcess,
    audioDelete: nativeAudioDelete,
    audioGetInfo: nativeAudioGetInfo,
    setAlgParam: nativeSetAlgParam
};