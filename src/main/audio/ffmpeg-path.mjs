import path from 'node:path';
import manifest from '../../../ffmpeg/manifest.json' with { type: 'json' };

export function resolveFfmpegPath({ packaged, appRoot, resourcesPath, platform = process.platform, arch = process.arch, override }) {
  const target = `${platform}-${arch}`;
  const entry = manifest.targets[target];
  if (!entry) throw new Error(`Unsupported FFmpeg target: ${target}`);
  if (!packaged && override) {
    if (!path.isAbsolute(override)) throw new Error('FFMPEG_PATH must be an absolute path');
    return override;
  }
  const root = packaged ? resourcesPath : appRoot;
  if (!root || !path.isAbsolute(root)) throw new Error('FFmpeg resource root must be absolute');
  return packaged ? path.join(root, 'ffmpeg', entry.executable)
    : path.join(root, '.cache', 'ffmpeg', manifest.release, target, entry.executable);
}
