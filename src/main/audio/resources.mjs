import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import manifest from '../../../ffmpeg/manifest.json' with { type: 'json' };
import { resolveFfmpegPath } from './ffmpeg-path.mjs';
export function verifyFfmpegResource(options) {
  const file = resolveFfmpegPath(options);
  try {
    fs.accessSync(file, process.platform === 'win32' ? fs.constants.R_OK : fs.constants.X_OK);
    const text = execFileSync(file, ['-version'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
    const expected = manifest.targets[`${process.platform}-${process.arch}`].version;
    if (!(options.override && !options.packaged) && !text.startsWith(`ffmpeg version ${expected} `) && !text.startsWith(`ffmpeg version ${expected}-`)) throw new Error(`期望版本 ${expected}`);
  } catch (error) { throw new Error(`FFmpeg 资源缺失、架构错误或无法运行，请重新准备资源或安装客户端。${error.message}`); }
  return file;
}
