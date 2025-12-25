import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg-7';
import { is } from '@electron-toolkit/utils';

// Resolve static path for native dlls, compatible with Vite/Electron build
const staticRoot = is.dev ? process.cwd() : process.resourcesPath;

let ffmpegPath = join(staticRoot, 'ffmpeg.exe');
if (!is.dev) {
  ffmpegPath = ffmpegPath.replace('\\resources\\app.asar\\', '\\');
}

//tell the ffmpeg package where it can find the needed binaries.
console.log('Using ffmpeg at: ', ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

export const decoder = ffmpeg;
