import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg-7';
import { is } from '@electron-toolkit/utils';

// Resolve static path for native dlls, compatible with Vite/Electron build
const staticRoot = is.dev ? process.cwd() : process.resourcesPath;

let _ffmpegPath = join(staticRoot, 'ffmpeg', 'ffmpeg.exe');
if (!is.dev) {
  _ffmpegPath = _ffmpegPath.replace('\\resources\\app.asar\\', '\\');
}

//tell the ffmpeg package where it can find the needed binaries.
console.log('Using ffmpeg at: ', _ffmpegPath);
ffmpeg.setFfmpegPath(_ffmpegPath);

export const decoder = ffmpeg;
export const ffmpegPath = _ffmpegPath;