import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
// Only mutate the disposable unpacked build, never an installed client.
const app = path.resolve(process.platform === 'win32' ? 'dist/win-unpacked' : process.platform === 'darwin' ? `dist/mac${process.arch === 'arm64' ? '-arm64' : ''}/LSAudio.app/Contents` : 'dist/linux-unpacked');
const exe = path.join(app, process.platform === 'win32' ? 'LSAudio.exe' : process.platform === 'darwin' ? 'MacOS/LSAudio' : 'lsaudio');
const resources = path.join(app, process.platform === 'darwin' ? 'Resources' : 'resources');
const manifestPath = path.join(resources, 'native/native-manifest.json');
const original = fs.readFileSync(manifestPath);
const profile = path.resolve('artifacts/startup-failures/profile');
fs.mkdirSync(profile, { recursive: true });
function fails(pattern) {
  const result = spawnSync(exe, [`--user-data-dir=${profile}`, ...(process.platform === 'linux' ? ['--no-sandbox'] : [])], { encoding: 'utf8', timeout: 20000, env: { ...process.env, LSAUDIO_SMOKE: '1' } });
  assert.ifError(result.error); assert.equal(result.status, 1, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout + result.stderr, pattern);
}
try {
  fs.writeFileSync(manifestPath, '{'); fails(/清单缺失或损坏/);
  const metadata = JSON.parse(original); metadata.arch = process.arch === 'x64' ? 'arm64' : 'x64';
  fs.writeFileSync(manifestPath, JSON.stringify(metadata)); fails(/架构与当前客户端不匹配/);
} finally { fs.writeFileSync(manifestPath, original); }
const ffmpeg = path.join(resources, 'ffmpeg', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
const saved = `${ffmpeg}.startup-test-saved`;
assert.equal(fs.existsSync(saved), false);
fs.renameSync(ffmpeg, saved);
try { fails(/FFmpeg 资源缺失/); } finally { fs.renameSync(saved, ffmpeg); }
console.log('Packaged startup failures: missing/corrupt resources and wrong architecture rejected explicitly.');
