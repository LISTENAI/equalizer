import { createAudioOutput } from '@echogarden/audio-io';
import { spawn } from 'child_process';
import { BrowserWindow } from 'electron';
import EventEmitter, { once } from 'events';
import { iflytekSoundEffect } from '../libs/capi';
import { ffmpegPath } from './audioDecoder';

const SAMPLE_RATE = 16000;
const CHANNELS = 1;
const PCM_BYTES = 2; // s16le bytes per sample
const INT_BYTES = 4; // 32-bit buffer used by native audioProcess
const FRAME_SAMPLES = 64; // native FRAME_SHIFT in reference C code
const FRAME_BYTES = FRAME_SAMPLES * PCM_BYTES;
const CHUNK_DURATION_MS = 100;

const clampInt16 = (value) => Math.max(-32768, Math.min(32767, value));

function buildFilterPrms(filters = []) {
  const filterPrms = [];
  filters.forEach((filter, idx) => {
    // support both object form and array form
    const params = Array.isArray(filter)
      ? {
          FilterEnable: filter[0],
          FilterType: filter[1],
          fSampleRateHz: filter[2],
          fQ: filter[3],
          fDbGain: filter[4],
          fFreqHz: filter[5],
        }
      : {
          FilterEnable: filter.enable,
          FilterType: filter.type,
          fSampleRateHz: filter.dSampleRateHz,
          fQ: filter.q,
          fDbGain: filter.gain,
          fFreqHz: filter.fc,
        };
    filterPrms[idx] = params;
  });
  return filterPrms;
}

class RingBuffer {
  constructor(maxBytes) {
    this.buf = Buffer.alloc(0);
    this.maxBytes = maxBytes;
  }

  push(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
  }

  read(size) {
    if (size) {
      if (this.buf.length < size) return null;
      const out = this.buf.subarray(0, size);
      this.buf = this.buf.subarray(size);
      return out;
    } else {
      const size = this.length;
      if (this.buf.length < size) return null;
      const out = this.buf.subarray(0, size);
      this.buf = this.buf.subarray(size);
      return out;
    }
  }

  get free() {
    return this.maxBytes - this.buf.length;
  }

  get length() {
    return this.buf.length;
  }
}

export class Player {
  instance = Buffer.allocUnsafe(23552);
  currentDecoder = null;
  currentReadable = null;
  stopController = null;
  remainder = Buffer.alloc(0);
  isPlaying = false;
  stopping = false;
  emitter = new EventEmitter();
  audioOutput = null;
  ringBuffer = null;
  decodeEnd = true;

  constructor() {
    let UseByte = Buffer.alloc(4);
    this.instance.fill(0);
    const result = iflytekSoundEffect.audioCreate(this.instance, UseByte);
    console.log('Audio create result:', result);
    console.log('UseByte:', UseByte.readInt32LE(0));
    const initialResult = iflytekSoundEffect.audioInitial(this.instance);
    console.log('Audio initial result:', initialResult);
  }

  setParams(audioConf) {
    // clear buffered decoded data so new params take effect ASAP
    this.remainder = Buffer.alloc(0);
    const bassBoost = audioConf &&
      audioConf.bass_boost && {
        iEnable: Number(audioConf.bass_boost.enable),
        fFs: audioConf.bass_boost.fs,
        fDbGain: audioConf.bass_boost.gain,
        fFreqHz: audioConf.bass_boost.freq,
      };
    const trebleoost = audioConf &&
      audioConf.treble_boost && {
        iEnable: Number(audioConf.treble_boost.enable),
        fFs: audioConf.treble_boost.fs,
        fDbGain: audioConf.treble_boost.gain,
        fFreqHz: audioConf.treble_boost.freq,
      };
    const filterprms = buildFilterPrms(
      audioConf && audioConf.eq && audioConf.eq.filters,
    );
    const monoEqPrm = audioConf &&
      audioConf.eq && {
        Enable: Number(audioConf.eq.enable),
        FilterPrm: filterprms,
      };
    const dots = [];
    ((audioConf && audioConf.drc && audioConf.drc.dots) || []).forEach(
      (dot, idx) => {
        dots[idx] = { X: dot[0], Y: dot[1], W: dot[2] };
      },
    );
    const drc = audioConf &&
      audioConf.drc && {
        iEnable: Number(audioConf.drc.enable),
        Fs: audioConf.drc.fs,
        At: audioConf.drc.at,
        Rt: audioConf.drc.rt,
        Type: audioConf.drc.mode,
        RmsTime: audioConf.drc.rms,
        SegNum: audioConf.drc.seg,
        Dot: dots,
      };
    const gain = audioConf &&
      audioConf.agc && {
        iEnable: Number(audioConf.agc.enable),
        dSampleRate: audioConf.agc.sr,
        dVolume: audioConf.agc.vol,
      };
    const audioPrm = {
      BassBoostPrm: bassBoost,
      TrebleoostPrm: trebleoost,
      PeqPrm: monoEqPrm,
      DrcPrm: drc,
      GainPrm: gain,
    };

    console.log('Setting parameters:', audioPrm);

    const result = iflytekSoundEffect.audioSet(this.instance, audioPrm);
    console.log('Set parameters result:', result);
    return result;
  }

  getParams() {
    let params = {};
    const result = iflytekSoundEffect.audioGet(this.instance, params);
    console.log('Get parameters result:', result);
    return params;
  }

  play(filePath) {
    console.log('Playing file:', filePath);
    if (!filePath) {
      throw new Error('filePath is required');
    }
    this.startPlayback(filePath);
  }

  readBytes = 0;
  remainingData = Buffer.alloc(0);

  _resolveData(data, callback) {
    let buffer = Buffer.concat([this.remainingData, data]);
    let offset = 0;
    while (buffer.length - offset >= FRAME_BYTES) {
      const frame = buffer.subarray(offset, offset + FRAME_BYTES);
      // Process the frame here if needed
      const after = this.runAudioProcess(frame);
      const temp = new Int16Array(after.buffer);
      callback?.(temp, offset / PCM_BYTES);
      offset += FRAME_BYTES;
    }
    if (offset < buffer.length) {
      // Handle any remaining data that didn't form a complete frame
      this.remainingData = buffer.subarray(offset);
    } else {
      this.remainingData = Buffer.alloc(0);
    }
  }

  feedAudioData(outputBuffer) {
    // outputBuffer would be Int16Array
    const needLength = outputBuffer.length * PCM_BYTES;

    try {
      if (this.ringBuffer) {
        const ringBuffer = this.ringBuffer;
        const process = this.currentDecodeProcess;
        // read ring buffer to outputBuffer
        const data = ringBuffer.read(needLength);
        if (data) {
          this.readBytes += data.length;

          this._resolveData(data, (output, offset) => {
            outputBuffer.set(output, offset);
          });
        } else {
          console.log(
            'No data available, decode ended:',
            this.decodeEnd,
            'buffer length:',
            ringBuffer.length,
            'need:',
            needLength,
          );
          if (this.decodeEnd) {
            if (ringBuffer.length == 0) {
              // If process ended and buffer is nearly empty, stop playback
              this.stop();
            } else if (ringBuffer.length < needLength) {
              const data = ringBuffer.read();
              if (data) {
                console.log(
                  'Reading data from ring buffer:',
                  data.length,
                  'bytes',
                );
                this._resolveData(data, (output, offset) => {
                  outputBuffer.set(output, offset);
                });
              } else {
                // No data available, but process is still running
                console.log(
                  'No data available from ring buffer, but process still running',
                );
              }
            }
          }
        }

        // Resume process if buffer has space
        if (ringBuffer.free > needLength) {
          if (process && process.stdout) {
            process.stdout.resume();
          }
        }
      }
    } catch (e) {
      console.error('Error in feedAudioData:', e);
    }
  }

  async startPlayback(filePath) {
    const process = spawn(
      ffmpegPath,
      [
        '-i',
        filePath,
        '-f',
        's16le',
        '-ar',
        SAMPLE_RATE.toString(),
        '-ac',
        CHANNELS.toString(),
        'pipe:1',
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    process.on('error', (err) => {
      console.error('Decode process error:', err);
    });
    process.on('exit', (code, signal) => {
      console.log('Decode process exited with code:', code, 'signal:', signal);
    });
    this.decodeEnd = false;
    process.stdout.on('end', () => {
      console.log('Decode process stdout ended');
      this.decodeEnd = true;
    });
    // !DEBUG ONLY!
    // process.stderr.on('data', (data) => {
    //   console.log('Decode process stderr:', data.toString());
    // });

    const ringBuffer = new RingBuffer(
      (2 * CHUNK_DURATION_MS * SAMPLE_RATE * CHANNELS * PCM_BYTES) / 1000,
    );
    this.ringBuffer = ringBuffer;
    process.stdout.on('data', (chunk) => {
      if (this.ringBuffer == ringBuffer) {
        ringBuffer.push(chunk);

        if (ringBuffer.free <= 0) {
          // Buffer is full, pause the process to avoid memory buildup
          process.stdout.pause();
        }
      }
    });

    this.currentDecodeProcess = process;

    this.readBytes = 0;
    await once(process.stdout, 'readable');
    this.audioOutput = await createAudioOutput(
      {
        channelCount: CHANNELS,
        sampleRate: SAMPLE_RATE,
        bufferDuration: CHUNK_DURATION_MS,
      },
      (data) => this.feedAudioData(data),
    );

    this.isPlaying = true;
    this.emitState(true);
  }

  async clearPlayback() {
    if (this.currentDecodeProcess) {
      this.currentDecodeProcess.kill();
      this.currentDecodeProcess = null;
    }
    if (this.audioOutput) {
      await this.audioOutput.dispose();
      this.audioOutput = null;
    }
  }

  runAudioProcess(chunk) {
    const sampleCount = Math.floor(chunk.length / PCM_BYTES);
    if (!sampleCount) {
      return null;
    }

    const inputBuffer = Buffer.alloc(FRAME_SAMPLES * INT_BYTES);
    const outputBuffer = Buffer.alloc(FRAME_SAMPLES * INT_BYTES);

    for (let i = 0; i < FRAME_SAMPLES; i++) {
      const sample = i < sampleCount ? chunk.readInt16LE(i * PCM_BYTES) : 0;
      inputBuffer.writeInt32LE(sample, i * INT_BYTES);
    }

    const result = iflytekSoundEffect.audioProcess(
      this.instance,
      inputBuffer,
      outputBuffer,
      FRAME_SAMPLES,
    );
    if (result < 0) {
      throw new Error(`audioProcess failed with code ${result}`);
    }
    const samplesWritten =
      result > 0 && result <= FRAME_SAMPLES ? result : FRAME_SAMPLES;
    const processedPcm = Buffer.alloc(samplesWritten * PCM_BYTES);
    for (let i = 0; i < samplesWritten; i++) {
      const value = outputBuffer.readInt32LE(i * INT_BYTES);
      processedPcm.writeInt16LE(clampInt16(value), i * PCM_BYTES);
    }
    return processedPcm;
  }

  async stop() {
    this.clearPlayback();
    this.isPlaying = false;
    this.emitState(false);
  }

  async deinit() {
    await this.stop();
    try {
      iflytekSoundEffect.audioDelete(this.instance);
    } catch (err) {
      console.error('Failed to delete audio instance:', err);
    }
  }

  emitState(isPlaying) {
    this.emitter.emit('state', { isPlaying });
  }

  on(event, listener) {
    this.emitter.on(event, listener);
  }

  off(event, listener) {
    this.emitter.off(event, listener);
  }
}

const player = new Player();

export function playerIpc(ipcMain) {
  player.on('state', (payload) => {
    const target = BrowserWindow.getAllWindows()[0];
    if (target && !target.isDestroyed()) {
      target.webContents.send('player-state', payload);
    }
  });

  ipcMain.handle('player-play', async (event, payload) => {
    try {
      const args =
        typeof payload === 'string' ? { file: payload } : payload || {};
      const { file: filePath } = args;
      if (!filePath) {
        throw new Error('File path is required');
      }
      player.play(filePath);
      return { code: 0 };
    } catch (error) {
      console.error('player-play failed:', error);
      return { code: -1, message: error?.message || 'play failed' };
    }
  });

  ipcMain.handle('player-stop', async () => {
    try {
      await player.stop();
      return { code: 0 };
    } catch (error) {
      console.error('player-stop failed:', error);
      return { code: -1, message: error?.message || 'stop failed' };
    }
  });

  ipcMain.handle('player-set-params', async (_event, params) => {
    try {
      const paramsObj = JSON.parse(params);
      const result = player.setParams(paramsObj);
      return { code: 0, result };
    } catch (error) {
      console.error('player-set-params failed:', error);
      return { code: -1, message: error?.message || 'set params failed' };
    }
  });
}
