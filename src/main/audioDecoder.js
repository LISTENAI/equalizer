import { join } from 'path';
import ffmpeg from 'fluent-ffmpeg-7';

let ffmpegPath = join(__static, 'ffmpeg.exe');
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
  ffmpegPath = ffmpegPath.replace('\\public\\', '\\ffmpeg\\');
} else {
  ffmpegPath = ffmpegPath.replace('\\resources\\app.asar\\', '\\');
}

//tell the ffmpeg package where it can find the needed binaries.
console.log('Using ffmpeg at: ', ffmpegPath);
ffmpeg.setFfmpegPath(ffmpegPath);

export const decoder = ffmpeg;
