import { createAudioOutput } from '@echogarden/audio-io';
import { BrowserWindow } from 'electron';
import { iflytekSoundEffect } from '../libs/capi';
import { fromAudioParam } from '../libs';
import { openPcmSource } from './audioDecoder';
import { PcmPlayer } from './audio/playback.mjs';
import { processDspFrame } from './audio/dsp-frame.mjs';
export class Player {
  constructor() {
    this.instance = Buffer.alloc(23552);
    const used = Buffer.alloc(4);
    const created = iflytekSoundEffect.audioCreate(this.instance, used);
    const initialized = created < 0 ? created : iflytekSoundEffect.audioInitial(this.instance);
    if (initialized < 0) throw new Error(`音频算法初始化失败: ${initialized}`);
    this.playback = new PcmPlayer({ openPcmSource, createAudioOutput, processFrame: frame => this.runAudioProcess(frame),
      onState: state => { for (const window of BrowserWindow.getAllWindows()) if (!window.isDestroyed()) window.webContents.send('player-state', state); },
    });
  }
  setParams(audioConf) {
    const result = iflytekSoundEffect.audioSet(this.instance, fromAudioParam(audioConf));
    if (result < 0) throw new Error(`音频参数设置失败: ${result}`);
    return result;
  }
  play(file) { return this.playback.play(file); }
  stop() { return this.playback.stop(); }
  runAudioProcess(frame) {
    return processDspFrame(iflytekSoundEffect, this.instance, frame);
  }
  async deinit() { await this.stop(); iflytekSoundEffect.audioDelete(this.instance); }
}
const player = new Player();
export const stopPlayer = () => player.stop();
export function playerIpc(ipcMain) {
  ipcMain.handle('player-play', async (_event, payload) => {
    try { const file = typeof payload === 'string' ? payload : payload?.file; if (!file) throw new Error('请选择音频文件'); await player.play(file); return { code: 0 }; }
    catch (error) { return { code: -1, message: error.message }; }
  });
  ipcMain.handle('player-stop', async () => {
    try { await player.stop(); return { code: 0 }; } catch (error) { return { code: -1, message: error.message }; }
  });
  ipcMain.handle('player-set-params', async (_event, params) => {
    try { return { code: 0, result: player.setParams(JSON.parse(params)) }; } catch (error) { return { code: -1, message: error.message }; }
  });
}
