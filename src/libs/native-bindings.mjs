import koffi from 'koffi';
import fs from 'node:fs';
import * as stru from './stru.js';
import { verifyNativeResources } from './native-runtime.mjs';

export function loadNativeBindings(directory) {
  const paths = verifyNativeResources(directory);
  const loaded = [];
  try {
    const core = koffi.load(paths.eqdrc); loaded.push(core);
    const drawing = koffi.load(paths.eqdraw); loaded.push(drawing);
    const sound = koffi.load(paths.soundeffect); loaded.push(sound);
    const encode = core.func('int lsaudio_audio_encode(struAudioPrm*, void*, size_t)');
    const decode = core.func('int lsaudio_audio_decode(const void*, size_t, _Out_ struAudioPrm*)');
    const eq = drawing.func('struEqDrawResult* eqDrawPoints(struMonoEqPrm*, struUIXYInfo*)');
    const drc = drawing.func('struDrcDrawResult* drcDrawPoints(struDrcPrm, struUIDrcInfo*)');
    const freeEq = drawing.func('void freePoints(struEqDrawResult*)');
    const freeDrc = drawing.func('void freeDrcPoints(struDrcDrawResult*)');
    function result(pointer, type, release) {
      if (!pointer) throw new Error('原生绘图结果分配失败');
      try {
        const value = koffi.decode(pointer, type);
        if (value.ret < 0) throw new Error(`原生绘图参数错误：${value.ret}`);
        const max = type === stru.struEqDrawResult ? 1024 : 315;
        if (value.arr_size < 0 || value.arr_size > max || (value.dot_size !== undefined && (value.dot_size < 0 || value.dot_size > 7))) throw new Error('原生绘图返回了无效长度');
        return value;
      } finally { release(pointer); }
    }
    return {
      iflytekBinHandle: {
        writeToBinFile(file, params) {
          const bytes = Buffer.alloc(360); const ret = encode(params, bytes, bytes.length);
          if (ret) return ret;
          try { fs.writeFileSync(file, bytes); return 0; } catch { return -3; }
        },
        readFromBinFile(file, params) {
          try { const bytes = fs.readFileSync(file); return decode(bytes, bytes.length, params); } catch { return -4; }
        },
      },
      iflytekEqDraw: {
        eqDrawPoints: (params, ui) => result(eq(params, ui), stru.struEqDrawResult, freeEq),
        drcDrawPoints: (params, ui) => result(drc(params, ui), stru.struDrcDrawResult, freeDrc),
      },
      iflytekSoundEffect: {
        audioCreate: sound.func('int IFLYTEK_AudioCreate(void*, _Out_ int*)'),
        audioInitial: sound.func('int IFLYTEK_AudioInitial(void*)'),
        audioReset: sound.func('int IFLYTEK_AudioReset(void*, int)'),
        audioSet: sound.func('int IFLYTEK_AudioSet(void*, struAudioPrm*)'),
        audioGet: sound.func('int IFLYTEK_AudioGet(void*, _Out_ struAudioPrm*)'),
        audioProcess: sound.func('int IFLYTEK_AudioProcess(void*, const int*, _Out_ int*, int)'),
        audioDelete: sound.func('int IFLYTEK_AudioDelete(void*)'),
        audioGetInfo: sound.func('int IFLYTEK_AudioGetInfo(_Out_ const char**)'),
        setAlgParam: sound.func('int IFLYTEK_SetAlgParam(void*, int, void*)'),
      },
    };
  } catch (error) { for (const library of loaded.reverse()) library.unload(); throw error; }
}
