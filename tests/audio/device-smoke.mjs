// Optional audible Windows hardware smoke test. Never run by default in CI.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createAudioOutput } from '@echogarden/audio-io';
import koffi from 'koffi';
import assets from '../../ffmpeg/assets.cjs';
import { createPcmService } from '../../src/main/audio/pcm-source.mjs';
import { PcmPlayer } from '../../src/main/audio/playback.mjs';
import { processDspFrame } from '../../src/main/audio/dsp-frame.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('This smoke test uses the original Windows x64 DSP DLL');
const lib = koffi.load(path.join(root, 'dlls/x64/SoundEffect.dll'));
const create = lib.func('int IFLYTEK_AudioCreate(void*,void*)'), init = lib.func('int IFLYTEK_AudioInitial(void*)'), del = lib.func('int IFLYTEK_AudioDelete(void*)');
const api = { audioProcess: lib.func('int IFLYTEK_AudioProcess(void*,void*,void*,int)') };
const instance = Buffer.alloc(23552), used = Buffer.alloc(4);
if (create(instance, used) !== 0 || init(instance) !== 0) throw new Error('DSP initialization failed');
const directory = path.join(root, 'artifacts/audio'); await mkdir(directory, { recursive: true });
const file = path.join(directory, 'device-smoke.pcm'); const input = Buffer.alloc(6400);
for (let i = 0; i < 3200; ++i) input.writeInt16LE(Math.round(600 * Math.sin(2 * Math.PI * 440 * i / 16000)), i * 2);
await writeFile(file, input);
const ffmpeg = path.join(assets.cacheDirectory(assets.getTarget()), 'ffmpeg.exe');
const wave = path.join(directory, 'device-smoke.wav');
await promisify(execFile)(ffmpeg, ['-nostdin', '-v', 'error', '-y', '-f', 's16le', '-ar', '16000', '-ac', '1', '-i', file, wave], { windowsHide: true });
const service = createPcmService({ getFfmpegPath: () => ffmpeg });
let finished; const complete = new Promise(resolve => { finished = resolve; });
let timeout; const deadline = new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Audio device did not drain within 10 seconds')), 10000); });
const states = [];
const player = new PcmPlayer({ openPcmSource: service.openPcmSource, createAudioOutput, processFrame: frame => processDspFrame(api, instance, frame),
  onState: state => { states.push(state); if (!state.isPlaying) finished(state); },
});
try {
  await player.play(wave); const result = await Promise.race([complete, deadline]);
  if (result.message) throw new Error(result.message);
  console.log(JSON.stringify({ event: 'audio-device-smoke-passed', samples: 3200, dspBytes: used.readInt32LE(), states }));
} finally { clearTimeout(timeout); await player.stop(); await service.close(); del(instance); lib.unload(); }
