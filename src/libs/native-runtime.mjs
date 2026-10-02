import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
export const NATIVE_TARGETS = ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64'];
export function nativeDirectory({ packaged, appRoot, resourcesPath }) {
  return packaged ? path.join(resourcesPath, 'native') : path.join(appRoot, 'native/build/lib');
}
export function verifyNativeResources(directory, platform = process.platform, arch = process.arch) {
  if (!NATIVE_TARGETS.includes(`${platform}-${arch}`)) throw new Error(`不支持的原生运行平台：${platform}-${arch}`);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(path.join(directory, 'native-manifest.json'), 'utf8')); }
  catch { throw new Error('原生资源清单缺失或损坏。开发环境请执行 npm run native:build；安装版请重新安装。'); }
  if (manifest.schemaVersion !== 1 || manifest.platform !== platform || manifest.arch !== arch) throw new Error('原生资源架构与当前客户端不匹配');
  const result = {};
  for (const name of ['eqdrc', 'eqdraw', 'soundeffect']) {
    const file = platform === 'win32' ? `lsaudio_${name}.dll` : platform === 'darwin' ? `liblsaudio_${name}.dylib` : `liblsaudio_${name}.so`;
    const absolute = path.join(directory, file);
    let digest;
    try { digest = crypto.createHash('sha256').update(fs.readFileSync(absolute)).digest('hex'); }
    catch { throw new Error(`缺少原生运行库：${file}`); }
    if (manifest.files[file] !== digest) throw new Error(`原生运行库校验失败：${file}`);
    result[name] = absolute;
  }
  return result;
}
