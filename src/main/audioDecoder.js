import ffmpeg from 'fluent-ffmpeg-7';
import { app } from 'electron';
import { resolveFfmpegPath } from './audio/ffmpeg-path.mjs';
const _ffmpegPath = resolveFfmpegPath({
  packaged: app.isPackaged,
  appRoot: app.getAppPath(),
  resourcesPath: process.resourcesPath,
  override: process.env.FFMPEG_PATH,
});
ffmpeg.setFfmpegPath(_ffmpegPath);

export const decoder = ffmpeg;
export const ffmpegPath = _ffmpegPath;
