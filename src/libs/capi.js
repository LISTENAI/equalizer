import { app } from 'electron';
import { nativeDirectory } from './native-runtime.mjs';
import { loadNativeBindings } from './native-bindings.mjs';
const bindings = loadNativeBindings(nativeDirectory({ packaged: app.isPackaged, appRoot: app.getAppPath(), resourcesPath: process.resourcesPath }));
export const { iflytekBinHandle, iflytekEqDraw, iflytekSoundEffect } = bindings;
export const IFLYTEK_ALG_ID_E = {
  IFLYTEK_ALG_ID_BASSBOOST: 0, IFLYTEK_ALG_ID_TREBLEBOOST: 1,
  IFLYTEK_ALG_ID_PEQ: 2, IFLYTEK_ALG_ID_DRC: 3, IFLYTEK_ALG_ID_GAIN: 4, IFLYTEK_ALG_ID_LIMITER: 5,
};
